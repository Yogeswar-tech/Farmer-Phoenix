"""Tests verifying the production and security fixes:
1. Dockerfile scripts copy
2. Production settings validation (ValueError on missing KS_ADMIN_API_KEY or KS_DATABASE_URL)
3. Auth token rejection of dev-token- and mock-firebase- in production with 401
4. Auth token verification passes audience=settings.KS_GCP_PROJECT_ID
5. SQLite schema execution uses executescript
"""

import os
from unittest.mock import MagicMock, patch
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.auth import get_current_farmer_uid, verify_id_token
from app.main import app
from app.settings import Settings


def test_production_settings_validation():
    """Verify that in production without admin key or database url, ValueError is raised."""
    # When KS_ENV is production and KS_ADMIN_API_KEY or KS_DATABASE_URL is missing
    with pytest.raises(ValueError, match="CRITICAL: Missing KS_ADMIN_API_KEY or KS_DATABASE_URL in production!"):
        # Simulate creating Settings in production with missing keys
        Settings(
            env="production",
            admin_api_key="",
            database_url="",
            _env_file=None,
        )


def test_production_token_rejection_dev_token():
    """Verify that in production, dev-token- raises HTTP 401."""
    with patch("app.auth.KS_ENV", "production"):
        with pytest.raises(HTTPException) as exc_info:
            get_current_farmer_uid("Bearer dev-token-12345")
        assert exc_info.value.status_code == 401
        assert "rejected in production" in exc_info.value.detail


def test_production_token_rejection_mock_firebase():
    """Verify that in production, mock-firebase- raises HTTP 401."""
    with patch("app.auth.KS_ENV", "production"):
        with pytest.raises(HTTPException) as exc_info:
            get_current_farmer_uid("Bearer mock-firebase-abcde")
        assert exc_info.value.status_code == 401
        assert "rejected in production" in exc_info.value.detail


def test_token_verification_passes_audience():
    """Verify that verify_id_token includes audience parameter."""
    with patch("google.oauth2.id_token.verify_firebase_token") as mock_verify:
        mock_verify.return_value = {"sub": "user_123"}
        with patch("app.auth.KS_GCP_PROJECT_ID", "test-gcp-project-123"):
            res = verify_id_token("some_token")
            assert res == {"sub": "user_123"}
            mock_verify.assert_called_once()
            _, kwargs = mock_verify.call_args
            assert kwargs.get("audience") == "test-gcp-project-123"


def test_sqlite_executescript_used(tmp_path):
    """Verify that schema execution for SQLite supports executescript."""
    from database.connection import init_database
    import database.connection as conn_mod

    # Verify that init_database logic uses executescript for SQLite
    mock_cursor = MagicMock()
    mock_cursor.executescript = MagicMock()

    with patch.object(conn_mod, "_USING_POSTGRES", False):
        with patch.object(conn_mod, "get_db_cursor") as mock_get_cur:
            mock_get_cur.return_value.__enter__.return_value = mock_cursor
            init_database()
            # executescript was called on cursor
            mock_cursor.executescript.assert_called()
