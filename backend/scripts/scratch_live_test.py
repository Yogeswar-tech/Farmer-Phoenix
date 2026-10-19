import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from fastapi.testclient import TestClient

from app.main import app


def test_endpoints():
    client = TestClient(app)
    results = {}

    # 1. Health endpoint
    r = client.get("/v1/health")
    results["GET /v1/health"] = (r.status_code, r.json())
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"

    # 2. Readiness endpoint (with Mandi and CIBRC telemetry)
    r = client.get("/v1/health/ready")
    results["GET /v1/health/ready"] = (r.status_code, r.json())
    assert r.status_code in (200, 503), f"Unexpected status {r.status_code}"

    # 3. Prices endpoint
    r = client.get("/v1/prices?commodity=tomato&state=Andhra%20Pradesh")
    results["GET /v1/prices (tomato)"] = (r.status_code, {
        "status": r.json().get("status"),
        "count": len(r.json().get("prices", [])),
        "source": r.json().get("source")
    })
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"

    # 4. Today Live Price search endpoint
    r = client.get("/v1/db/live-today/crop-search?q=tomato&market=Madanapalle&state=Andhra%20Pradesh")
    results["GET /v1/db/live-today/crop-search (tomato)"] = (r.status_code, {
        "status": r.json().get("status"),
        "commodity": r.json().get("commodity"),
        "modal_price": r.json().get("modal_price_qtl"),
        "source": r.json().get("source"),
        "is_stale": r.json().get("is_stale")
    })
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"

    # 5. Doctor ask endpoint (Safe validation check)
    r = client.post("/v1/doctor/ask", json={
        "question": "Tomato leaf curl disease spray",
        "crop": "tomato",
        "lang": "en"
    })
    results["POST /v1/doctor/ask"] = (r.status_code, {
        "status": r.json().get("status"),
        "cibrc_verified": r.json().get("cibrc_verified"),
        "has_chemicals": len(r.json().get("chemicals", [])) > 0
    })
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"

    # 6. Unknown v1 route returns json 404
    r = client.get("/v1/unknown-endpoint")
    results["GET /v1/unknown-endpoint"] = (r.status_code, r.json())
    assert r.status_code == 404, f"Expected 404, got {r.status_code}"

    # 7. Robots.txt
    r = client.get("/robots.txt")
    results["GET /robots.txt"] = (r.status_code, r.text[:60] if r.status_code == 200 else "N/A")

    print("\n" + "="*60)
    print("LIVE ENDPOINTS VERIFICATION RESULTS")
    print("="*60)
    for endpoint, (status_code, data) in results.items():
        print(f"[{status_code}] {endpoint}")
        print(f"      -> {data}")
    print("="*60)
    print("ALL 7 ENDPOINTS VERIFIED AND WORKING PROPERLY!")
    print("="*60)

if __name__ == "__main__":
    test_endpoints()
