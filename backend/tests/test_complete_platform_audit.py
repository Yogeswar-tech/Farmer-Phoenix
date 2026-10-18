"""Comprehensive End-to-End Platform Integration Test for Kisan Sethu.

Audits EVERY module across:
1. Live APMC Mandi Rates & Terminal
2. 7-16 Day Operational Weather & Spraying Calendar
3. Pesticides CIBRC Directory & Knapsack Dosage Doctor
4. AI Crop Doctor Pathology Diagnostics & Live Rain Warning
5. Soil Doctor Precision NPK Fertilizer Calculator
6. Mandi Logistics & Inter-Market Transport Arbitrage
7. Government Schemes & 4% KCC Subsidies
8. Cold Storage Directory & Space Booking
9. Price Alert Subscriptions & Database Persistence
10. Farmer Authentication & Persistent Profile Sync
11. AI Multilingual Mitra RAG Voice/Text Assistant
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

def run_complete_audit():
    client = TestClient(app)
    
    test_cases = [
        # (Module, Method, Path, Payload, ExpectedKey)
        ("1. Health", "GET", "/v1/health", None, "status"),
        ("2. Mandi Rates", "GET", "/v1/db/mandi-rates?commodity=Chilli&limit=5", None, "data"),
        ("3. Weather Advisories", "GET", "/v1/db/weather-advisories?location_id=guntur&limit=5", None, "data"),
        ("4. Climate Prediction", "GET", "/v1/db/climate-prediction?location_id=guntur&days=7", None, "forecast_7days"),
        ("5. Climate Locations", "GET", "/v1/db/climate-locations?q=Guntur", None, "locations"),
        ("6. Reverse Geocoding", "GET", "/v1/db/climate-reverse-geocode?lat=16.3&lng=80.4", None, "location"),
        ("7. Master Crops", "GET", "/v1/db/crops/search?q=Apple", None, "crops"),
        ("8. Crop Pesticides", "GET", "/v1/db/crops/apple/pesticides", None, "data"),
        ("9. Pesticide Search", "GET", "/v1/db/pesticides/search?q=Mancozeb", None, "results"),
        ("10. Pesticide Doctor", "GET", "/v1/db/pesticides/suitability?pesticide_id=mancozeb&crop=apple", None, "knapsack_calculator"),
        ("11. Crop Doctor Diseases", "GET", "/v1/db/crops/tomato/diseases?lang=hi", None, "diseases"),
        ("12. Crop Doctor Diagnose", "POST", "/v1/db/crop-doctor/diagnose", {
            "crop_key": "chilli",
            "symptoms": "leaves curl upwards",
            "location_id": "guntur",
            "lang": "en"
        }, "chemical_treatment"),
        ("13. Soil Health Card", "GET", "/v1/db/soil/health-card?location_id=guntur&lang=te", None, "soil_type"),
        ("14. Soil Precision Recs", "POST", "/v1/db/soil/recommend", {
            "crop_key": "chilli",
            "acres": 1.5,
            "location_id": "guntur",
            "lang": "en"
        }, "fertilizer_requirements"),
        ("15. Logistics ROI", "POST", "/v1/db/logistics/calculate", {
            "crop_key": "chilli",
            "load_quintals": 50,
            "vehicle_type": "tractor",
            "distance_km": 48,
            "lang": "en"
        }, "financials"),
        ("16. Logistics Corridors", "GET", "/v1/db/logistics/corridors?lang=en", None, "corridors"),
        ("17. Cold Storage", "GET", "/v1/db/cold-storages?district=Guntur", None, "facilities"),
        ("18. Govt Schemes", "GET", "/v1/db/govt-schemes?category=LOAN", None, "schemes"),
        ("19. Price Alert Subscribe", "POST", "/v1/db/price-alerts/subscribe", {
            "phone_number": "9123456780",
            "crop_key": "chilli",
            "crop_name": "Guntur Red Chilli",
            "target_price": 14200.0,
            "channel": "whatsapp"
        }, "alert_id"),
        ("20. Price Alerts Fetch", "GET", "/v1/db/price-alerts?phone_number=9123456780", None, "alerts"),
        ("21. Farmer Profile Login", "POST", "/v1/farmer/login-otp", {
            "phone_number": "9123456780",
            "farmer_name": "Sita Ram",
            "otp": "1234",
            "preferred_lang": "hi",
            "district": "Guntur"
        }, "profile"),
        ("22. Farmer Profile Fetch", "GET", "/v1/farmer/profile?phone_number=9123456780", None, "profile"),
        ("23. Sync Freshness Telemetry", "GET", "/v1/db/sync-status", None, "total_records"),
        ("24. AI Mitra Assistant", "POST", "/v1/ask", {"question": "Chilli price in Guntur", "lang": "en"}, "answer")
    ]

    print("\n======================= KISAN SETHU PLATFORM AUDIT =======================")
    passed = 0
    for module, method, path, payload, exp_key in test_cases:
        try:
            if method == "POST":
                res = client.post(path, json=payload)
            else:
                res = client.get(path)
            
            assert res.status_code == 200, f"HTTP {res.status_code}: {res.text}"
            data = res.json()
            assert exp_key in data, f"Key '{exp_key}' missing in response"
            print(f"[OK] {module:30} => {method:4} {path[:42]:42} [PASS]")
            passed += 1
        except Exception as exc:
            print(f"[FAIL] {module:30} => ERROR: {exc}")

    print("==========================================================================")
    print(f"RESULTS: {passed}/{len(test_cases)} modules passed with active backend integration!")
    assert passed == len(test_cases), "Some modules failed backend audit."

if __name__ == "__main__":
    run_complete_audit()
