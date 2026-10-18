"""Comprehensive System & Live API Verification Suite for Kisan Sethu.

Tests all active subsystem endpoints:
- Core Health & Readiness Probes
- Mandi Live Rates, Prices & Today's Search
- Weather Advisories & Cold Storages
- CIBRC Pesticide Search & Validation
- Crop Doctor SSE Consultation & Q&A
- Farmer Profiles & Geolocation Resolution
"""

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from fastapi.testclient import TestClient
from app.main import app

def run_system_verification():
    client = TestClient(app)
    results = []
    failures = []

    def check(name, method, url, status_expected, json_body=None, validator=None):
        try:
            if method == "GET":
                resp = client.get(url)
            elif method == "POST":
                resp = client.post(url, json=json_body)
            else:
                resp = client.request(method, url)

            passed = (resp.status_code == status_expected) if isinstance(status_expected, int) else (resp.status_code in status_expected)
            detail = ""
            if passed and validator:
                try:
                    passed, detail = validator(resp)
                except Exception as ex:
                    passed = False
                    detail = f"Validator error: {ex}"

            status_str = "PASS" if passed else "FAIL"
            res_entry = {
                "name": name,
                "endpoint": f"{method} {url}",
                "status_code": resp.status_code,
                "passed": passed,
                "detail": detail or ("OK" if passed else f"Expected {status_expected}, got {resp.status_code} ({resp.text[:120]})")
            }
            results.append(res_entry)
            if not passed:
                failures.append(res_entry)
        except Exception as e:
            res_entry = {
                "name": name,
                "endpoint": f"{method} {url}",
                "status_code": "ERROR",
                "passed": False,
                "detail": str(e)
            }
            results.append(res_entry)
            failures.append(res_entry)

    # 1. Health & Readiness
    check(
        "Health Probe", "GET", "/v1/health", 200,
        validator=lambda r: (r.json().get("status") == "ok", f"status={r.json().get('status')}")
    )
    check(
        "Readiness Probe", "GET", "/v1/health/ready", (200, 503),
        validator=lambda r: (
            "cibrc_records" in r.json() or "error" in r.json(),
            f"mandi_stale={r.json().get('mandi_data', {}).get('stale')}, cibrc_records={r.json().get('cibrc_records')}"
        )
    )
    check(
        "Robots TXT", "GET", "/robots.txt", 200,
        validator=lambda r: ("User-agent" in r.text, "Robots.txt served")
    )

    # 2. Mandi Rates & Prices
    check(
        "Prices Retrieval (V1 Prices)", "GET", "/v1/prices?commodity=Tomato&state=Andhra%20Pradesh", 200,
        validator=lambda r: ("prices" in r.json() and "trend" in r.json(), f"prices count={len(r.json().get('prices', []))}")
    )
    check(
        "DB Mandi Rates", "GET", "/v1/db/mandi-rates?commodity=Tomato&limit=10", 200,
        validator=lambda r: (r.json().get("status") == "success", f"count={r.json().get('count')}")
    )
    check(
        "Live Today Prices", "GET", "/v1/db/live-today/prices?limit=5", 200,
        validator=lambda r: (r.json().get("status") == "success", f"count={r.json().get('count')}")
    )
    check(
        "Live Today All Crops (Chips)", "GET", "/v1/db/live-today/all-crops", 200,
        validator=lambda r: (r.json().get("status") == "success" and len(r.json().get("crops", [])) > 0, f"crops={len(r.json().get('crops', []))}")
    )
    check(
        "Live Today Universal Crop Search", "GET", "/v1/db/live-today/crop-search?q=Tomato", 200,
        validator=lambda r: (r.json().get("status") in ("success", "real_time_open_mandi_api", "live_data"), f"status={r.json().get('status')}, commodity={r.json().get('commodity')}")
    )

    # 3. Weather Advisories & Cold Storages & Govt Schemes
    check(
        "Weather Advisories", "GET", "/v1/db/weather-advisories", 200,
        validator=lambda r: (r.json().get("status") == "success", f"count={r.json().get('count')}")
    )
    check(
        "Cold Storage Directory", "GET", "/v1/db/cold-storages?limit=5", 200,
        validator=lambda r: (r.json().get("status") == "success", f"count={r.json().get('count')}")
    )
    check(
        "Government Schemes", "GET", "/v1/db/govt-schemes", 200,
        validator=lambda r: (r.json().get("status") == "success", f"count={r.json().get('count')}")
    )

    # 4. CIBRC Pesticide Search
    check(
        "CIBRC Pesticide Search", "GET", "/v1/db/pesticides/cibrc/search?q=chlorantraniliprole", 200,
        validator=lambda r: (r.json().get("status") == "success", f"matches={r.json().get('count')}")
    )

    # 5. Crop Doctor SSE Endpoint
    check(
        "Crop Doctor SSE Stream", "POST", "/v1/doctor/ask", 200,
        json_body={"question": "What is the recommended pesticide for tomato fruit borer?", "crop": "tomato", "lang": "en"},
        validator=lambda r: ("event: event" in r.text or "event: done" in r.text or "data:" in r.text, "SSE stream response verified")
    )

    # 6. Ask Q&A RAG Endpoint
    check(
        "Farmer Q&A RAG", "POST", "/v1/ask", 200,
        json_body={"query": "What is the tomato price today?", "location": "Madanapalle", "commodity": "Tomato", "lang": "en"},
        validator=lambda r: (r.json().get("status") == "success" and bool(r.json().get("answer")), f"answer preview: {r.json().get('answer', '')[:50]}...")
    )

    # 7. Farmer & Region Endpoints
    check(
        "Crops Catalog", "GET", "/v1/crops", 200,
        validator=lambda r: (isinstance(r.json(), list) and len(r.json()) > 0, f"crops count={len(r.json()) if isinstance(r.json(), list) else 0}")
    )
    check(
        "Region Resolve", "GET", "/v1/regions/resolve?lat=13.6288&lon=79.4192", 200,
        validator=lambda r: ("region_id" in r.json() or "mandis" in r.json(), f"resolved={r.json()}")
    )
    check(
        "Farmer Demo Accounts", "GET", "/v1/farmer/demo-accounts", 200,
        validator=lambda r: ("accounts" in r.json() and len(r.json()["accounts"]) > 0, f"demo accounts={len(r.json().get('accounts', []))}")
    )

    # Print Formatted Report
    print("\n" + "=" * 80)
    print("KISAN-SETHU SYSTEM & LIVE API VERIFICATION REPORT")
    print("=" * 80)
    for r in results:
        tag = "[PASS]" if r["passed"] else "[FAIL]"
        print(f"{tag:<7} [{r['status_code']}] {r['name']:<32} | {r['endpoint']}")
        print(f"         -> {r['detail']}")
    print("=" * 80)
    print(f"Total Tests: {len(results)} | Passed: {len(results) - len(failures)} | Failed: {len(failures)}")
    print("=" * 80)
    return len(failures) == 0

if __name__ == "__main__":
    success = run_system_verification()
    sys.exit(0 if success else 1)
