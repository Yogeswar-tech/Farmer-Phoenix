"""Test all newly added backend endpoints:
1. Crop Doctor diseases and diagnose
2. Soil Doctor health card and recommendations
3. Mandi Logistics calculation and corridors
4. Price Alert subscription and retrieval
5. Farmer Profile login and fetch
"""
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))
project_root = backend_dir.parent
sys.path.insert(0, str(project_root))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from fastapi.testclient import TestClient
from app.main import app

def test_new_endpoints():
    client = TestClient(app)
    
    # 1. Crop Doctor
    res = client.get("/v1/db/crops/tomato/diseases?lang=hi")
    assert res.status_code == 200, f"Crop diseases failed: {res.text}"
    print("[PASS] GET /v1/db/crops/tomato/diseases:", res.json()["diseases"][0]["disease_name"])

    res = client.post("/v1/db/crop-doctor/diagnose", json={
        "crop_key": "chilli",
        "symptoms": "leaves curling up, flower drop",
        "location_id": "guntur",
        "lang": "en"
    })
    assert res.status_code == 200, f"Crop diagnose failed: {res.text}"
    print("[PASS] POST /v1/db/crop-doctor/diagnose:", res.json()["disease_name"], "| severity:", res.json()["severity"])

    # 2. Soil Doctor
    res = client.get("/v1/db/soil/health-card?location_id=guntur&lang=te")
    assert res.status_code == 200, f"Soil health card failed: {res.text}"
    print("[PASS] GET /v1/db/soil/health-card:", res.json()["district"], "| pH:", res.json()["ph"])

    res = client.post("/v1/db/soil/recommend", json={
        "crop_key": "chilli",
        "acres": 2.0,
        "location_id": "guntur",
        "lang": "en"
    })
    assert res.status_code == 200, f"Soil recommend failed: {res.text}"
    print("[PASS] POST /v1/db/soil/recommend:", res.json()["fertilizer_requirements"])

    # 3. Logistics
    res = client.post("/v1/db/logistics/calculate", json={
        "crop_key": "chilli",
        "load_quintals": 50,
        "vehicle_type": "tractor",
        "distance_km": 48,
        "lang": "en"
    })
    assert res.status_code == 200, f"Logistics calculate failed: {res.text}"
    print("[PASS] POST /v1/db/logistics/calculate: Net Profit =", res.json()["financials"]["net_profit"], "| Verdict =", res.json()["verdict"][:40])

    res = client.get("/v1/db/logistics/corridors?lang=hi")
    assert res.status_code == 200, f"Logistics corridors failed: {res.text}"
    print("[PASS] GET /v1/db/logistics/corridors:", len(res.json()["corridors"]), "corridors found")

    # 4. Price Alerts
    res = client.post("/v1/db/price-alerts/subscribe", json={
        "phone_number": "9876543210",
        "crop_key": "chilli",
        "crop_name": "Teja Chilli",
        "target_price": 14500.0,
        "channel": "whatsapp",
        "mandi_name": "Guntur Mirchi Yard"
    })
    assert res.status_code == 200, f"Price alert subscribe failed: {res.text}"
    print("[PASS] POST /v1/db/price-alerts/subscribe:", res.json()["message"])

    res = client.get("/v1/db/price-alerts?phone_number=9876543210")
    assert res.status_code == 200, f"Price alert fetch failed: {res.text}"
    print("[PASS] GET /v1/db/price-alerts: Found", res.json()["count"], "active alerts")

    # 5. Farmer Profile
    res = client.post("/v1/farmer/login-otp", json={
        "phone_number": "9876543210",
        "farmer_name": "Ramu Patel",
        "otp": "1234",
        "preferred_lang": "hi",
        "district": "Guntur"
    })
    assert res.status_code == 200, f"Farmer login failed: {res.text}"
    print("[PASS] POST /v1/farmer/login-otp:", res.json()["profile"]["farmer_name"])

    res = client.get("/v1/farmer/profile?phone_number=9876543210")
    assert res.status_code == 200, f"Farmer profile fetch failed: {res.text}"
    print("[PASS] GET /v1/farmer/profile:", res.json()["profile"]["farmer_name"], "| Lang:", res.json()["profile"]["preferred_lang"])

    print("\nALL NEW ENDPOINTS TESTED AND PASSED WITH 200 OK!")

if __name__ == "__main__":
    test_new_endpoints()
