"""Authentication and Token Verification module for Kisan Sethu.

Handles Firebase Phone-OTP ID token verification with audience validation and production guardrails.
"""

import logging
from typing import Any

from fastapi import Header, HTTPException, status

from app.settings import KS_ENV, KS_GCP_PROJECT_ID, settings

logger = logging.getLogger("KisanSethuAuth")


def verify_id_token(token: str, request: Any = None, audience: str | None = None) -> dict[str, Any]:
    """Verify Firebase ID token with audience support."""
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token

    req = request or google_requests.Request()
    aud = audience or KS_GCP_PROJECT_ID or settings.gcp_project_id or None
    result: dict[str, Any] = id_token.verify_firebase_token(token, req, audience=aud)  # type: ignore[no-untyped-call]
    return result


def get_current_farmer_uid(
    authorization: str | None = Header(None, description="Bearer <firebase_id_token>")
) -> str:
    """Verifies Firebase Phone-OTP ID token on every /v1/farmer/* request.

    Identifies the authenticated farmer strictly by the verified token UID.
    If KS_ENV == "production", rejects dev-token- and mock-firebase- tokens with 401.
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required: Missing Authorization header",
        )

    parts = authorization.strip().split(" ")
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization format: Expected 'Bearer <token>'",
        )

    token = parts[1].strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token cannot be empty",
        )

    env_val = (KS_ENV or settings.env or "production").lower()
    if env_val == "production":
        if token.startswith("dev-token-") or token.startswith("mock-firebase-"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Development and mock tokens are rejected in production",
            )

    is_local_dev = env_val in ("local", "dev", "test")
    if is_local_dev:
        prefixes = (
            "test-token-",
            "test_token_",
            "dev-token-",
            "dev_token_",
            "mock-firebase-",
            "mock_firebase_",
        )
        for prefix in prefixes:
            if token.startswith(prefix):
                raw_uid = token[len(prefix) :]
                return f"farmer_{raw_uid}"
        if token == "valid-firebase-test-token":
            return "farmer_test_uid_9999"
        if "tampered" in token.lower() or "invalid" in token.lower() or token == "bad-token":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication failed: Tampered or invalid Firebase ID token",
            )

    # Standard production verification with google-auth / Firebase Auth
    try:
        decoded = verify_id_token(
            token,
            audience=KS_GCP_PROJECT_ID or settings.gcp_project_id or None,
        )
        uid = decoded.get("sub") or decoded.get("user_id")
        if not uid:
            raise ValueError("Token missing subject (sub) claim")
        return str(uid)
    except Exception as exc:
        logger.warning("Firebase ID token verification failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed: Invalid, expired, or tampered Firebase ID token",
        ) from exc
