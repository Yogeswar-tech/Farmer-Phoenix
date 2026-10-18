import sys
from pathlib import Path
from unittest.mock import patch
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BACKEND_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.main import app

client = TestClient(app)


def test_v1_health_ok():
    """Verify standard /v1/health liveness probe."""
    response = client.get("/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_ready_returns_200_when_seeded():
    """Verify ready -> 200 when CIBRC registry has > 0 rows."""
    with patch("database.cibrc_isolated_db.get_cibrc_row_count", return_value=85):
        response = client.get("/v1/health/ready")
        assert response.status_code == 200
        data = response.json()
        assert data["ready"] is True
        assert data["cibrc_records"] == 85
        assert data["status"] == "ready"


def test_ready_returns_503_when_registry_empty():
    """Verify ready -> 503 when registry is empty (0 rows)."""
    with patch("database.cibrc_isolated_db.get_cibrc_row_count", return_value=0):
        response = client.get("/v1/health/ready")
        assert response.status_code == 503
        data = response.json()
        assert data["ready"] is False
        assert "empty" in data["error"].lower()


def test_ready_returns_503_when_db_unreachable():
    """Verify ready -> 503 when database is unreachable / connection fails."""
    with patch("database.cibrc_isolated_db.get_cibrc_row_count", side_effect=Exception("Database unreachable")):
        response = client.get("/v1/health/ready")
        assert response.status_code == 503
        data = response.json()
        assert data["ready"] is False
        assert "Database unreachable" in data["error"]


def test_unknown_v1_route_returns_json_404():
    """Verify any unknown /v1 route returns strict JSON 404 {"detail": "Not found"}."""
    response = client.get("/v1/unknown-route-1234")
    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/json")
    assert response.json() == {"detail": "Not found"}

    post_resp = client.post("/v1/another-unknown-route", json={"key": "val"})
    assert post_resp.status_code == 404
    assert post_resp.headers["content-type"].startswith("application/json")
    assert post_resp.json() == {"detail": "Not found"}


def test_robots_txt_static_file():
    """Verify /robots.txt returns static crawler rules."""
    response = client.get("/robots.txt")
    assert response.status_code == 200
    assert "Disallow: /v1/" in response.text
    assert "User-agent: *" in response.text


if __name__ == "__main__":
    print("[*] Running test_v1_health_ok...")
    test_v1_health_ok()
    print("[+] test_v1_health_ok passed.")

    print("[*] Running test_ready_returns_200_when_seeded...")
    test_ready_returns_200_when_seeded()
    print("[+] test_ready_returns_200_when_seeded passed.")

    print("[*] Running test_ready_returns_503_when_registry_empty...")
    test_ready_returns_503_when_registry_empty()
    print("[+] test_ready_returns_503_when_registry_empty passed.")

    print("[*] Running test_ready_returns_503_when_db_unreachable...")
    test_ready_returns_503_when_db_unreachable()
    print("[+] test_ready_returns_503_when_db_unreachable passed.")

    print("[*] Running test_unknown_v1_route_returns_json_404...")
    test_unknown_v1_route_returns_json_404()
    print("[+] test_unknown_v1_route_returns_json_404 passed.")

    print("[*] Running test_robots_txt_static_file...")
    test_robots_txt_static_file()
    print("[+] test_robots_txt_static_file passed.")

    print("\n[SUCCESS] All cibrc readiness, routes, and robots.txt tests passed!")
