"""Integration test script to audit every endpoint in Kisan Sethu."""
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))
project_root = backend_dir.parent
sys.path.insert(0, str(project_root))

from fastapi.testclient import TestClient
from app.main import app

def run_tests():
    client = TestClient(app)
    endpoints = [
        ("GET", "/v1/health", None),
        ("GET", "/v1/db/mandi-rates?commodity=Chilli&limit=5", None),
        ("GET", "/v1/db/weather-advisories?location_id=guntur&limit=5", None),
        ("GET", "/v1/db/cold-storages?district=Guntur", None),
        ("GET", "/v1/db/govt-schemes?category=LOAN", None),
        ("GET", "/v1/db/climate-prediction?location_id=guntur&days=7", None),
        ("GET", "/v1/db/climate-locations?q=Guntur", None),
        ("GET", "/v1/db/climate-reverse-geocode?lat=16.3&lng=80.4", None),
        ("GET", "/v1/db/crops/search?q=Apple", None),
        ("GET", "/v1/db/crops/apple/pesticides", None),
        ("GET", "/v1/db/pesticides/search?q=Mancozeb", None),
        ("GET", "/v1/db/pesticides/suitability?pesticide_id=mancozeb&crop=apple", None),
        ("GET", "/v1/db/sync-status", None),
        ("GET", "/v1/prices?commodity=Tomato", None),
        ("GET", "/v1/crops", None),
        ("POST", "/v1/ask", {"question": "What is the chilli price in Guntur?", "lang": "en"}),
    ]

    print("=================== ENDPOINT AUDIT RESULTS ===================")
    for method, path, body in endpoints:
        try:
            if method == "POST":
                res = client.post(path, json=body)
            else:
                res = client.get(path)
            
            data = res.json() if res.status_code == 200 else res.text
            summary = list(data.keys()) if isinstance(data, dict) else f"{len(data)} items"
            print(f"[PASS] {method:4} {path:60} => {res.status_code} | {summary}")
        except Exception as exc:
            print(f"[FAIL] {method:4} {path:60} => ERROR: {exc}")
    print("==============================================================")

if __name__ == "__main__":
    run_tests()
