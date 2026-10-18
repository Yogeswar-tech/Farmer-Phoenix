"""Centralized Security, Rate Limiting, Admin Auth, and Firebase Token Verification.

Guarantees:
1. IP-based sliding window rate limiting (raises HTTP 429).
2. X-Admin-Key protection for internal operations (raises HTTP 401).
3. Payload limit (4 MB) & MIME type allow-list (jpeg/png/webp) for image uploads (raises 413 / 415).
4. Firebase Phone-OTP ID token verification on /v1/farmer/* (raises HTTP 401 / 403).
   Identifies users strictly by verified token UID (dev-mode bypass when KS_ENV=local).
"""

import base64
import logging
import time
from collections import defaultdict
from collections.abc import Callable
from threading import Lock

from fastapi import Header, HTTPException, Request, status

from app.settings import settings

logger = logging.getLogger("KisanSethuSecurity")

# Allowed image MIME types for agricultural diagnoses & soil health card scans
ALLOWED_IMAGE_MIMES = {"image/jpeg", "image/png", "image/webp", "image/jpg"}
MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024  # 4 MB limit


# ------------------------------------------------------------------------------
# 1. Thread-Safe Sliding Window Per-IP Rate Limiter
# ------------------------------------------------------------------------------
class InMemoryRateLimiter:
    """Per-IP sliding window rate limiter."""

    def __init__(self, requests_limit: int = 15, window_seconds: int = 60) -> None:
        self.requests_limit = requests_limit
        self.window_seconds = window_seconds
        self._history: dict[str, list[float]] = defaultdict(list)
        self._lock = Lock()

    def check_rate_limit(self, client_ip: str) -> None:
        now = time.time()
        window_start = now - self.window_seconds

        with self._lock:
            # Filter out entries older than current sliding window
            timestamps = [t for t in self._history[client_ip] if t > window_start]
            if len(timestamps) >= self.requests_limit:
                logger.warning(
                    "Rate limit exceeded for IP %s (%d requests in %ds)",
                    client_ip,
                    len(timestamps),
                    self.window_seconds
                )
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Rate limit exceeded. Too many requests. Please wait before retrying.",
                    headers={"Retry-After": str(self.window_seconds)}
                )
            timestamps.append(now)
            self._history[client_ip] = timestamps


# Default rate limiter instances
default_ask_limiter = InMemoryRateLimiter(requests_limit=15, window_seconds=60)
default_cibrc_limiter = InMemoryRateLimiter(requests_limit=15, window_seconds=60)
default_diagnose_limiter = InMemoryRateLimiter(requests_limit=15, window_seconds=60)


def rate_limit_dependency(limiter: InMemoryRateLimiter) -> Callable[[Request], None]:
    """FastAPI dependency for per-IP rate limiting."""
    def _dep(request: Request) -> None:
        client_ip = request.client.host if request.client else "127.0.0.1"
        # Respect X-Forwarded-For if deployed behind reverse proxy
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            client_ip = forwarded.split(",")[0].strip()  # first hop = real client IP
        limiter.check_rate_limit(client_ip)
    return _dep


# ------------------------------------------------------------------------------
# 2. Admin API Key Verification (X-Admin-Key)
# ------------------------------------------------------------------------------
def verify_admin_key(
    x_admin_key: str | None = Header(None, alias="X-Admin-Key", description="Admin secret key")
) -> str:
    """Enforces KS_ADMIN_API_KEY check on maintenance/ingestion endpoints."""
    expected_key = settings.admin_api_key.strip()
    if not x_admin_key or x_admin_key.strip() != expected_key:
        logger.warning(
            "Unauthorized access attempt to admin endpoint (invalid or missing X-Admin-Key)"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Invalid or missing X-Admin-Key header"
        )
    return x_admin_key


# ------------------------------------------------------------------------------
# 3. Image Payload Size (4 MB) & MIME Type Validation (413 / 415)
# ------------------------------------------------------------------------------
def validate_image_payload(
    image_base64: str | None,
    mime_type: str | None = "image/jpeg"
) -> bytes | None:
    """Validates base64 image payload:
    - Enforces MIME allow-list (jpeg/png/webp) -> HTTP 415 Unsupported Media Type.
    - Enforces 4 MB decoded limit -> HTTP 413 Payload Too Large.
    Returns decoded image bytes if provided, or None if image_base64 is empty.
    """
    if not image_base64:
        return None

    clean_mime = (mime_type or "image/jpeg").strip().lower()
    if clean_mime not in ALLOWED_IMAGE_MIMES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                f"Unsupported media type '{mime_type}'. "
                "Allowed image MIME types: image/jpeg, image/png, image/webp"
            )
        )

    raw = image_base64.strip()
    if "," in raw:
        # Strip data URL prefix if present e.g. 'data:image/jpeg;base64,...'
        prefix, raw = raw.split(",", 1)
        if "data:" in prefix and ";" in prefix:
            inferred_mime = prefix.split("data:", 1)[1].split(";", 1)[0].lower()
            if inferred_mime not in ALLOWED_IMAGE_MIMES:
                raise HTTPException(
                    status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                    detail=(
                        f"Unsupported media type '{inferred_mime}'. "
                        "Allowed image MIME types: image/jpeg, image/png, image/webp"
                    )
                )

    try:
        decoded_bytes = base64.b64decode(raw)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Malformed base64 image data"
        ) from exc

    if len(decoded_bytes) > MAX_IMAGE_SIZE_BYTES:
        mb_size = len(decoded_bytes) / (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=f"Image payload size ({mb_size:.2f} MB) exceeds maximum allowed limit of 4 MB."
        )

    return decoded_bytes


# ------------------------------------------------------------------------------
# 4. Firebase Phone-OTP Token Verification Dependency
# Canonical implementation lives in app.auth; re-exported here for router imports.
# ------------------------------------------------------------------------------
from app.auth import get_current_farmer_uid as get_current_farmer_uid  # noqa: F401

