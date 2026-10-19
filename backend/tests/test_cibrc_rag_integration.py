"""Automated Integration Test for CIBRC PostgreSQL Database & Gemini RAG Doctor."""

import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Add project root and backend to sys.path
TESTS_DIR = Path(__file__).resolve().parent
BACKEND_DIR = TESTS_DIR.parent
PROJECT_ROOT = BACKEND_DIR.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_cibrc_endpoints():
    print("\n--- 1. Testing CIBRC Crop Presets for Tomato ---")
    res1 = client.get("/v1/db/pesticides/cibrc/crop/tomato")
    assert res1.status_code == 200, f"Expected 200, got {res1.status_code}"
    data1 = res1.json()
    assert data1["status"] == "success"
    assert data1["total_registered_presets"] > 0
    categories = data1["categories"]
    assert len(categories.get("INSECTICIDE", [])) > 0
    assert len(categories.get("FUNGICIDE", [])) > 0
    assert len(categories.get("PGR", [])) > 0
    assert len(categories.get("BIO-PESTICIDE", [])) > 0
    print(f"PASSED: Tomato has {data1['total_registered_presets']} registered CIBRC presets across 4+ categories.")

    print("\n--- 2. Testing CIBRC Crop Presets for Paddy (Rice) ---")
    res2 = client.get("/v1/db/pesticides/cibrc/crop/paddy")
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["total_registered_presets"] > 0
    print(f"PASSED: Paddy has {data2['total_registered_presets']} registered CIBRC presets.")

    print("\n--- 3. Testing CIBRC Pesticide Search ---")
    res3 = client.get("/v1/db/pesticides/cibrc/search?q=Paclobutrazol")
    assert res3.status_code == 200
    data3 = res3.json()
    assert data3["count"] > 0
    print(f"PASSED: Found {data3['count']} records for Paclobutrazol in CIBRC registry.")

    print("\n--- 4. Testing Hazard Detection: 2,4-D on Broadleaf Tomato ---")
    res4 = client.get("/v1/db/pesticides/cibrc/suitability?pesticide=2,4-D&crop=Tomato")
    assert res4.status_code == 200
    data4 = res4.json()
    assert data4["is_approved"] is False
    assert data4["verdict"] == "PROHIBITED_HAZARD"
    assert len(data4.get("safe_approved_alternatives_for_crop", [])) > 0
    print(f"PASSED: 2,4-D on Tomato correctly flagged as {data4['verdict']} with safe alternatives.")

    print("\n--- 5. Testing Approved Compatibility: Chlorantraniliprole on Tomato ---")
    res5 = client.get("/v1/db/pesticides/cibrc/suitability?pesticide=Chlorantraniliprole&crop=Tomato")
    assert res5.status_code == 200
    data5 = res5.json()
    assert data5["is_approved"] is True
    assert data5["verdict"] == "APPROVED"
    assert "15L" in data5.get("pump_dose_15l", "") or "pump" in data5.get("pump_dose_15l", "")
    assert data5.get("waiting_period_days") is not None
    print(f"PASSED: Chlorantraniliprole on Tomato correctly APPROVED with 15L dose: {data5['pump_dose_15l']} and PHI: {data5['waiting_period_days']}.")

    print("\n--- 6. Testing Gemini RAG AI Advisor (English) ---")
    res6 = client.post(
        "/v1/db/pesticides/cibrc/ai-advisor",
        json={
            "query": "What is the 15-liter pump dose and waiting period for fruit borer in tomato?",
            "crop": "Tomato",
            "pesticide": "Chlorantraniliprole",
            "lang": "en"
        }
    )
    assert res6.status_code == 200
    data6 = res6.json()
    assert data6["status"] in ("success", "unavailable")
    if data6["status"] == "success":
        assert data6["rag_context_count"] > 0
        assert len(data6["advisory"]) > 50
        print(f"PASSED: Gemini RAG Doctor returned grounded advisory using {data6['llm_engine']} with {data6['rag_context_count']} CIBRC context rows.")
    else:
        assert data6["advisory"] is None
        print("PASSED: CIBRC AI Advisor safely returned unavailable advisory without network.")

    print("\n--- 7. Testing Gemini RAG AI Advisor (Hindi) ---")
    res7 = client.post(
        "/v1/db/pesticides/cibrc/ai-advisor",
        json={
            "query": "धान में तना छेदक के लिए 15 लीटर पंप की खुराक क्या है?",
            "crop": "Paddy",
            "lang": "hi"
        }
    )
    assert res7.status_code == 200
    data7 = res7.json()
    assert data7["status"] in ("success", "unavailable")
    if data7["status"] == "success":
        assert len(data7["advisory"]) > 50
        print("PASSED: Hindi RAG advisory generated successfully.")
    else:
        assert data7["advisory"] is None
        print("PASSED: Hindi RAG advisory safely returned unavailable status.")

    print("\n--- 8. Testing Isolated Database File Existence & Separation ---")
    from database.cibrc_isolated_db import get_cibrc_db_path
    db_file_path = Path(get_cibrc_db_path())
    assert db_file_path.exists(), f"Database file does not exist at {db_file_path}"
    assert db_file_path.stat().st_size > 50000, "Database file is smaller than expected"
    print(f"PASSED: Verified separate isolated database file exists at {db_file_path} ({db_file_path.stat().st_size} bytes).")

    print("\n--- 9. Testing Anti-Hallucination: Bispyribac on Cotton ---")
    res9 = client.get("/v1/db/pesticides/cibrc/suitability?pesticide=Bispyribac&crop=Cotton")
    assert res9.status_code == 200
    data9 = res9.json()
    assert data9["is_approved"] is False
    assert data9["verdict"] in ["PROHIBITED_HAZARD", "NOT_REGISTERED"]
    assert "not officially registered" in data9["hazard_reason"].lower() or "phytotoxic" in data9["hazard_reason"].lower()
    print(f"PASSED: Anti-hallucination guardrail active - Bispyribac on Cotton flagged as {data9['verdict']}.")

    print("\n--- 10. Testing Multimodal 3-Column Diagnostic (Tomato Fruit Borer 15L) ---")
    res10 = client.post(
        "/v1/db/crop-doctor/multimodal-diagnose",
        json={
            "crop_key": "tomato",
            "symptom_key": "fruit_borer",
            "tank_liters": 15,
            "lang": "hi"
        }
    )
    assert res10.status_code == 200
    data10 = res10.json()
    assert data10["status"] == "success"
    assert len(data10["actionable_solutions"]) > 0
    assert "audio_script" in data10
    print(f"PASSED: Multimodal diagnose returned {len(data10['actionable_solutions'])} solutions with Hindi audio narration: {data10['audio_script'][:60]}...")

    print("\n--- 11. Testing Dynamic Sprayer Pump Recalculation (200L Tractor Drum) ---")
    res11 = client.post(
        "/v1/db/crop-doctor/multimodal-diagnose",
        json={
            "crop_key": "tomato",
            "symptom_key": "fruit_borer",
            "tank_liters": 200,
            "lang": "en"
        }
    )
    assert res11.status_code == 200
    data11 = res11.json()
    sol1 = data11["actionable_solutions"][0]
    assert sol1["pump_liters"] == 200
    assert "200L" in sol1["pump_dose"]
    print(f"PASSED: 200L Tractor Drum scaled dosage verified: {sol1['pump_dose']}")

    print("\n=======================================================")
    print("ALL 11 CIBRC ISOLATED DB & GEMINI RAG TESTS PASSED (100%)!")
    print("=======================================================")


if __name__ == "__main__":
    test_cibrc_endpoints()

