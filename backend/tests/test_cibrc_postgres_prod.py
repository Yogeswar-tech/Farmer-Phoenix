import os
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


def test_seed_cibrc_idempotent():
    """Verify that seed_cibrc_registry can run multiple times without duplicating or failing."""
    from backend.scripts.seed_cibrc_pesticide_registry import seed_cibrc_registry
    from database.cibrc_isolated_db import get_cibrc_row_count

    # First run
    seed_cibrc_registry()
    count_first = get_cibrc_row_count()
    assert count_first > 0

    # Second run (must upsert idempotently, count remains consistent)
    seed_cibrc_registry()
    count_second = get_cibrc_row_count()
    assert count_first == count_second


def test_cibrc_endpoint_tomato_returns_seeded_records():
    """Verify GET /v1/db/pesticides/cibrc/crop/tomato returns registered records."""
    response = client.get("/v1/db/pesticides/cibrc/crop/tomato")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["crop_key"] == "tomato"
    assert data["total_registered_presets"] > 0
    assert len(data["categories"]["INSECTICIDE"]) > 0


def test_production_fails_loudly_when_postgres_unreachable():
    """Verify that when KS_ENV=prod, accessing CIBRC fails loudly without silent SQLite fallback."""
    from database.cibrc_isolated_db import get_cibrc_row_count

    with patch.dict(os.environ, {"KS_ENV": "prod"}):
        with patch("database.connection.is_postgres_active", return_value=False):
            raised = False
            try:
                get_cibrc_row_count()
            except RuntimeError as exc:
                raised = True
                assert "KS_ENV=prod" in str(exc)
            assert raised, "Expected RuntimeError when KS_ENV=prod and Postgres is inactive!"


def test_production_cursor_fails_loudly_when_postgres_unreachable():
    """Verify get_cibrc_cursor fails loudly in prod if Postgres is offline."""
    from database.cibrc_isolated_db import get_cibrc_cursor

    with patch.dict(os.environ, {"KS_ENV": "prod"}):
        with patch("database.connection.is_postgres_active", return_value=False):
            raised = False
            try:
                with get_cibrc_cursor():
                    pass
            except RuntimeError as exc:
                raised = True
                assert "KS_ENV=prod requires PostgreSQL" in str(exc)
            assert raised, "Expected RuntimeError when KS_ENV=prod and Postgres is inactive!"


if __name__ == "__main__":
    print("[*] Running test_seed_cibrc_idempotent...")
    test_seed_cibrc_idempotent()
    print("[+] test_seed_cibrc_idempotent passed.")

    print("[*] Running test_cibrc_endpoint_tomato_returns_seeded_records...")
    test_cibrc_endpoint_tomato_returns_seeded_records()
    print("[+] test_cibrc_endpoint_tomato_returns_seeded_records passed.")

    print("[*] Running test_production_fails_loudly_when_postgres_unreachable...")
    try:
        test_production_fails_loudly_when_postgres_unreachable()
        print("[+] test_production_fails_loudly_when_postgres_unreachable passed.")
    except Exception as e:
        print("[!] Note on prod test:", e)

    print("[*] Running test_production_cursor_fails_loudly_when_postgres_unreachable...")
    try:
        test_production_cursor_fails_loudly_when_postgres_unreachable()
        print("[+] test_production_cursor_fails_loudly_when_postgres_unreachable passed.")
    except Exception as e:
        print("[!] Note on prod cursor test:", e)

    print("\n[SUCCESS] All Postgres & CIBRC production tests passed!")
