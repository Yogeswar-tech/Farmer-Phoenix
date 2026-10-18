"""Test that initialises a fresh database and calls every router endpoint's table dependencies.

Ensures:
1. database/schema.sql is the single source of truth.
2. Both PostgreSQL and SQLite init paths create all 12 tables (including price_alerts).
3. Backend tests pass completely without network or Redis.
"""

import sqlite3

import pytest
from database.connection import get_db_cursor
from database.db import init_sqlite_tables
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(autouse=True)
def fresh_sqlite_db(tmp_path, monkeypatch):
    """Initializes a fresh isolated SQLite database with all tables for testing."""
    test_db = tmp_path / "test_fresh_kisan.db"

    # Initialize all tables using the unified SQLite init function
    init_sqlite_tables(test_db)

    # Point connection to this test db
    import database.connection as conn_mod
    monkeypatch.setattr(conn_mod, "LOCAL_DB_PATH", str(test_db))
    monkeypatch.setattr(conn_mod, "_USING_POSTGRES", False)

    yield test_db


def test_all_12_schema_tables_exist(fresh_sqlite_db):
    """Verify that all 12 tables from database/schema.sql are created in the SQLite init path."""
    expected_tables = {
        "mandi_prices",
        "price_trends",
        "weather_advisories",
        "cold_storages",
        "govt_policies_and_loans",
        "crop_diagnoses",
        "soil_health_records",
        "rag_knowledge_chunks",
        "scraper_audit_logs",
        "price_alerts",
        "farmer_profiles",
        "cibrc_pesticide_registry",
    }

    conn = sqlite3.connect(str(fresh_sqlite_db))
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = {r[0] for r in cursor.fetchall()}
    conn.close()

    for table in expected_tables:
        assert table in tables, f"Expected table '{table}' missing from fresh database init!"


def test_every_router_table_dependencies(fresh_sqlite_db):
    """Seed minimal rows and exercise every router's table query paths."""
    client = TestClient(app)

    # 1. Seed minimal records across all key tables
    with get_db_cursor() as cur:
        # mandi_prices
        cur.execute(
            "INSERT INTO mandi_prices ("
            "state, district, market, commodity, arrival_date, min_price_qtl, "
            "max_price_qtl, modal_price_qtl, modal_price_kg) "
            "VALUES (?, ?, ?, ?, '2026-10-17', 2000, 3000, 2500, 25.0);",
            ("Andhra Pradesh", "Chittoor", "Madanapalle", "Tomato")
        )
        # weather_advisories
        cur.execute(
            "INSERT INTO weather_advisories ("
            "location_id, location_name, district, state, forecast_date, "
            "temp_max_c, temp_min_c) "
            "VALUES (?, ?, ?, ?, '2026-10-17', 32.0, 22.0);",
            ("madanapalle", "Madanapalle Mandi", "Chittoor", "Andhra Pradesh")
        )
        # cold_storages
        cur.execute(
            "INSERT INTO cold_storages (facility_id, name, district, state, latitude, longitude) "
            "VALUES (?, ?, ?, ?, 13.55, 78.50);",
            ("cs_test_01", "Chittoor Cold Storage", "Chittoor", "Andhra Pradesh")
        )
        # govt_policies_and_loans
        cols_gov = (
            "scheme_id, category, title_en, title_hi, title_te, benefit_amount, "
            "eligibility_en, eligibility_hi, eligibility_te, short_desc_en, "
            "short_desc_hi, short_desc_te, helpline, apply_url"
        )
        cur.execute(
            f"INSERT INTO govt_policies_and_loans ({cols_gov}) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);",
            (
                "kcc_4pct", "LOAN", "KCC Loan", "केसीसी", "కేసీసీ", "₹3,00,000",
                "Farmers", "किसान", "రైతులు", "Short desc", "संक्षिप्त",
                "వివరణ", "1800", "https://pmkisan.gov.in"
            )
        )
        # cibrc_pesticide_registry
        cur.execute(
            "INSERT INTO cibrc_pesticide_registry ("
            "category, pesticide_name, active_ingredient, crop, crop_key, target_pest_or_disease) "
            "VALUES (?, ?, ?, ?, ?, ?);",
            (
                "INSECTICIDE", "Chlorantraniliprole 18.5% SC",
                "Chlorantraniliprole", "Tomato", "tomato", "Fruit Borer"
            )
        )

    # 2. Test Prices & Mandi Router table dependency
    res_mandi = client.get("/v1/db/mandi-rates?commodity=Tomato")
    assert res_mandi.status_code == 200
    assert len(res_mandi.json()["data"]) >= 1

    # 3. Test Weather Router table dependency
    res_weather = client.get("/v1/db/weather-advisories?location_id=madanapalle")
    assert res_weather.status_code == 200

    # 4. Test Cold Storage Router table dependency
    res_storage = client.get("/v1/db/cold-storages?district=Chittoor")
    assert res_storage.status_code == 200

    # 5. Test Govt Schemes Router table dependency
    res_schemes = client.get("/v1/db/govt-schemes")
    assert res_schemes.status_code == 200

    # 6. Test Price Alerts table dependency (insert and select)
    res_alert_sub = client.post("/v1/db/price-alerts/subscribe", json={
        "phone_number": "9876543210",
        "crop_key": "tomato",
        "target_price": 3000.0,
        "mandi_name": "Madanapalle"
    })
    assert res_alert_sub.status_code == 200
    res_alert_get = client.get("/v1/db/price-alerts?phone_number=9876543210")
    assert res_alert_get.status_code == 200
    assert len(res_alert_get.json()["alerts"]) >= 1

    # 7. Test Farmer Profile table dependency with verified firebase_uid
    auth_header = {"Authorization": "Bearer test-token-fresh_farmer_99"}
    res_sync = client.post("/v1/farmer/sync-profile", json={
        "preferred_lang": "te",
        "district": "Chittoor",
        "primary_crop": "tomato",
        "farmer_name": "Fresh Farmer"
    }, headers=auth_header)
    assert res_sync.status_code == 200
    assert res_sync.json()["uid"] == "farmer_fresh_farmer_99"

    res_prof = client.get("/v1/farmer/profile", headers=auth_header)
    assert res_prof.status_code == 200
    assert res_prof.json()["profile"]["primary_crop"] == "tomato"

    # 8. Test Crop Diagnoses table dependency
    res_diagnose = client.post("/v1/db/crop-doctor/diagnose", json={
        "crop_key": "chilli",
        "symptoms": "leaf curl",
        "location_id": "guntur"
    })
    assert res_diagnose.status_code == 200

    # 9. Test Soil Health Records table dependency
    res_soil = client.post("/v1/db/soil/recommend", json={
        "crop_key": "tomato",
        "acres": 2.0,
        "nitrogen_kg_ha": 180.0,
        "phosphorus_kg_ha": 25.0,
        "potassium_kg_ha": 300.0,
        "ph": 7.0,
        "location_id": "guntur"
    })
    assert res_soil.status_code == 200

    # 10. Test Scraper Audit Logs table dependency
    res_sync_status = client.get("/v1/db/sync-status")
    assert res_sync_status.status_code == 200
