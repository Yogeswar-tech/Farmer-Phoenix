"""Tests for Google Cloud Real-Time OTP Generation & Strict Database Validation."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_send_and_verify_real_otp_success():
    """Validates real-time OTP generation and successful verification against DB."""
    phone = "9876501234"
    # 1. Send OTP
    send_resp = client.post("/v1/farmer/send-otp", json={"phone_number": phone})
    assert send_resp.status_code == 200
    send_data = send_resp.json()
    assert send_data["status"] == "success"
    assert send_data["delivery"] == "google_cloud"
    assert "otp_code" in send_data
    assert len(send_data["otp_code"]) == 6
    otp_code = send_data["otp_code"]

    # 2. Strict rejection of dummy OTP (000000)
    dummy_resp = client.post("/v1/farmer/verify-otp", json={
        "phone_number": phone,
        "otp": "000000"
    })
    assert dummy_resp.status_code == 400
    assert "Incorrect verification code" in dummy_resp.json()["detail"]

    # 3. Successful verification with genuine generated OTP
    verify_resp = client.post("/v1/farmer/verify-otp", json={
        "phone_number": phone,
        "otp": otp_code,
        "preferred_lang": "te"
    })
    assert verify_resp.status_code == 200
    verify_data = verify_resp.json()
    assert verify_data["status"] == "success"
    assert verify_data["authenticated"] is True
    assert verify_data["delivery"] == "google_cloud_verified"
    assert "token" in verify_data
    assert "profile" in verify_data


def test_verify_otp_nonexistent_phone():
    """Verify fails when no OTP was requested."""
    resp = client.post("/v1/farmer/verify-otp", json={
        "phone_number": "9999988888",
        "otp": "123456"
    })
    assert resp.status_code == 400
    assert "No OTP requested" in resp.json()["detail"]


def test_send_otp_invalid_phone():
    """Send OTP rejects invalid short numbers."""
    resp = client.post("/v1/farmer/send-otp", json={"phone_number": "123"})
    assert resp.status_code == 400
