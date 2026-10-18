"""Tests for Security, Firebase Phone Auth, Rate Limiting, Admin Keys, and Payload Validation.

Tests:
1. 401: Missing token, tampered token, missing/invalid X-Admin-Key.
2. 403: Accessing or modifying another user's profile.
3. 429: Per-IP rate limiting exceeded.
4. 413: Image base64 exceeding 4 MB.
5. 415: Unsupported image MIME type (not jpeg/png/webp).
6. Security headers: Strict-Transport-Security, X-Content-Type-Options: nosniff, CSP.
"""

import base64

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.settings import settings

client = TestClient(app)


# ------------------------------------------------------------------------------
# 1. Firebase Phone-OTP & Profile Security Tests (401, 403, Success)
# ------------------------------------------------------------------------------
def test_farmer_profile_valid_token():
    """Valid token succeeds and persists minimal profile data."""
    headers = {"Authorization": "Bearer test-token-farmer_user_1"}
    res = client.post("/v1/farmer/sync-profile", json={
        "preferred_lang": "te",
        "district": "Chittoor",
        "primary_crop": "tomato"
    }, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["uid"] == "farmer_farmer_user_1"
    assert data["profile"]["district"] == "Chittoor"


def test_farmer_profile_missing_token_401():
    """Missing Authorization header fails with HTTP 401."""
    res = client.post("/v1/farmer/sync-profile", json={
        "preferred_lang": "te",
        "district": "Chittoor",
        "primary_crop": "tomato"
    })
    assert res.status_code == 401
    assert "Missing Authorization" in res.json()["detail"]


def test_farmer_profile_tampered_token_401():
    """Tampered or invalid token fails with HTTP 401."""
    headers = {"Authorization": "Bearer tampered-invalid-token-xyz"}
    res = client.post("/v1/farmer/sync-profile", json={
        "preferred_lang": "te",
        "district": "Chittoor",
        "primary_crop": "tomato"
    }, headers=headers)
    assert res.status_code == 401
    assert "Invalid" in res.json()["detail"] or "Tampered" in res.json()["detail"]


def test_accessing_another_user_profile_fails_403():
    """Attempting to access or alter another farmer's profile fails with HTTP 403."""
    headers = {"Authorization": "Bearer test-token-farmer_user_alice"}
    
    # Alice attempts to access Bob's profile
    res = client.get("/v1/farmer/profile?target_uid=farmer_farmer_user_bob", headers=headers)
    assert res.status_code == 403
    assert "Forbidden" in res.json()["detail"]

    # Alice attempts to update Bob's location
    res_loc = client.put("/v1/farmer/profile/location", json={
        "district": "Guntur",
        "target_uid": "farmer_farmer_user_bob"
    }, headers=headers)
    assert res_loc.status_code == 403

    # Alice attempts to update Bob's crop
    res_crop = client.put("/v1/farmer/profile/crop", json={
        "primary_crop": "chilli",
        "target_uid": "farmer_farmer_user_bob"
    }, headers=headers)
    assert res_crop.status_code == 403


# ------------------------------------------------------------------------------
# 2. Admin Key Protection Tests (401)
# ------------------------------------------------------------------------------
@pytest.mark.parametrize("endpoint,method,payload", [
    ("/v1/db/cache/status", "GET", None),
    ("/v1/db/cache/purge", "POST", None),
    ("/v1/db/trigger-scraper", "POST", None),
    ("/v1/db/scrapers/trigger", "POST", {"scraper_name": "today_live"}),
    ("/v1/db/live-today/refresh-6h", "POST", None),
])
def test_admin_endpoints_require_admin_key_401(endpoint, method, payload):
    """Admin endpoints without valid X-Admin-Key must return HTTP 401."""
    # 1. Missing header
    if payload:
        res_missing = client.request(method, endpoint, json=payload)
    else:
        res_missing = client.request(method, endpoint)
    assert res_missing.status_code == 401
    assert "X-Admin-Key" in res_missing.json()["detail"]

    # 2. Invalid header
    bad_headers = {"X-Admin-Key": "incorrect-secret-key"}
    if payload:
        res_bad = client.request(method, endpoint, json=payload, headers=bad_headers)
    else:
        res_bad = client.request(method, endpoint, headers=bad_headers)
    assert res_bad.status_code == 401


def test_admin_endpoint_with_valid_key_succeeds():
    """Valid X-Admin-Key grants access."""
    valid_headers = {"X-Admin-Key": settings.admin_api_key}
    res = client.get("/v1/db/cache/status", headers=valid_headers)
    assert res.status_code == 200


# ------------------------------------------------------------------------------
# 3. Payload Limit (413) & MIME Allow-List (415) Tests
# ------------------------------------------------------------------------------
def test_image_payload_unsupported_mime_415():
    """Uploading an unsupported MIME type (e.g. application/pdf, image/gif) fails with HTTP 415."""
    small_base64 = base64.b64encode(b"sample bytes").decode("utf-8")
    
    # 1. Multimodal diagnose
    res_diag = client.post("/v1/db/crop-doctor/multimodal-diagnose", json={
        "image_base64": small_base64,
        "mime_type": "application/pdf"
    })
    assert res_diag.status_code == 415
    assert "Unsupported media type" in res_diag.json()["detail"]

    # 2. Soil scan-report
    res_soil = client.post("/v1/db/soil/scan-report", json={
        "image_base64": small_base64,
        "mime_type": "image/gif"
    })
    assert res_soil.status_code == 415


def test_image_payload_too_large_413():
    """Image exceeding 4 MB decoded size fails with HTTP 413."""
    # Create 4.5 MB of dummy image payload
    large_raw = b"A" * (int(4.5 * 1024 * 1024))
    large_b64 = base64.b64encode(large_raw).decode("utf-8")

    res_diag = client.post("/v1/db/crop-doctor/multimodal-diagnose", json={
        "image_base64": large_b64,
        "mime_type": "image/jpeg"
    })
    assert res_diag.status_code == 413
    assert "exceeds maximum allowed limit of 4 MB" in res_diag.json()["detail"]

    res_soil = client.post("/v1/db/soil/scan-report", json={
        "image_base64": large_b64,
        "mime_type": "image/png"
    })
    assert res_soil.status_code == 413


# ------------------------------------------------------------------------------
# 4. Per-IP Rate Limiting Tests (429)
# ------------------------------------------------------------------------------
def test_rate_limiting_exceeded_429():
    """Making rapid requests exceeding sliding window limit returns HTTP 429."""
    from fastapi import Depends, FastAPI

    from app.core.security import InMemoryRateLimiter, rate_limit_dependency

    test_app = FastAPI()
    limiter = InMemoryRateLimiter(requests_limit=3, window_seconds=60)

    @test_app.get("/test-limit", dependencies=[Depends(rate_limit_dependency(limiter))])
    def limited_route():
        return {"status": "ok"}

    c = TestClient(test_app)
    # First 3 requests succeed
    for _ in range(3):
        r = c.get("/test-limit")
        assert r.status_code == 200

    # 4th request must fail with HTTP 429
    r_blocked = c.get("/test-limit")
    assert r_blocked.status_code == 429
    assert "Rate limit exceeded" in r_blocked.json()["detail"]
    assert "Retry-After" in r_blocked.headers


# ------------------------------------------------------------------------------
# 5. Security Headers and CORS Tests
# ------------------------------------------------------------------------------
def test_security_headers_present():
    """Verify HSTS, X-Content-Type-Options: nosniff, and CSP headers."""
    res = client.get("/v1/health")
    assert res.status_code == 200
    headers = res.headers

    assert "Strict-Transport-Security" in headers
    assert "max-age=31536000" in headers["Strict-Transport-Security"]
    assert headers.get("X-Content-Type-Options") == "nosniff"
    assert "Content-Security-Policy" in headers
    csp = headers["Content-Security-Policy"]
    assert "tile.openstreetmap.org" in csp
    assert "basemaps.cartocdn.com" in csp
