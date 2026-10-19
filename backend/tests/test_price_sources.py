"""Unit tests for APMC Mandi Price Sources, Validation, Rate Limiting, and Honest Live-Today Search."""

from __future__ import annotations

import json
import sys
import time
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from scrapers.price_sources import (
    OpenMandiApiSource,
    RateLimiter,
    ValidationStats,
    validate_price_record,
)
from scrapers.todays_live_page_scraper import search_live_today_crop

from app.main import app

client = TestClient(app)


def test_valid_price_record_passes():
    """Verify that a compliant row passes validation."""
    today = date(2026, 10, 18)
    stats = ValidationStats()
    raw = {
        "market": "Guntur APMC Yard",
        "district": "Guntur",
        "state": "Andhra Pradesh",
        "commodity": "Tomato",
        "variety": "Hybrid",
        "grade": "FAQ",
        "arrival_date": "2026-10-18",
        "arrival_quintals": "150.0",
        "min_price": "2200",
        "max_price": "2800",
        "modal_price": "2500"
    }

    rec = validate_price_record(raw, stats, today_utc=today)
    assert rec is not None
    assert rec.commodity == "Tomato"
    assert rec.market == "Guntur APMC Yard"
    assert rec.modal_price_qtl == 2500.0
    assert rec.modal_price_kg == 25.0
    assert rec.arrival_date == "2026-10-18"
    assert stats.valid_count == 1
    assert stats.rejected_count == 0


def test_junk_price_0_01_rejected():
    """Verify that test/junk prices like 0.01 INR are rejected."""
    today = date(2026, 10, 18)
    stats = ValidationStats()
    raw = {
        "market": "Patti Mandi",
        "commodity": "Tomato",
        "arrival_date": "2026-10-18",
        "modal_price": 0.01,
        "min_price": 0.01,
        "max_price": 0.01
    }

    rec = validate_price_record(raw, stats, today_utc=today)
    assert rec is None
    assert stats.rejected_count == 1
    assert stats.rejections_by_reason.get("REJECT_PRICE_OUT_OF_BOUNDS") == 1


def test_negative_price_rejected():
    """Verify negative prices are rejected."""
    today = date(2026, 10, 18)
    stats = ValidationStats()
    raw = {
        "market": "Kolar APMC",
        "commodity": "Onion",
        "arrival_date": "2026-10-18",
        "modal_price": -500.0
    }

    rec = validate_price_record(raw, stats, today_utc=today)
    assert rec is None
    assert stats.rejected_count == 1
    assert stats.rejections_by_reason.get("REJECT_PRICE_OUT_OF_BOUNDS") == 1


def test_future_date_rejected():
    """Verify that future dates beyond 1 day timezone skew are rejected."""
    today = date(2026, 10, 18)
    stats = ValidationStats()
    future_date = (today + timedelta(days=5)).isoformat()
    raw = {
        "market": "Bowenpally",
        "commodity": "Potato",
        "arrival_date": future_date,
        "modal_price": 1800.0
    }

    rec = validate_price_record(raw, stats, today_utc=today)
    assert rec is None
    assert stats.rejected_count == 1
    assert stats.rejections_by_reason.get("REJECT_FUTURE_DATE") == 1


def test_30_day_old_date_rejected():
    """Verify that dates older than 7 days from UTC today are rejected."""
    today = date(2026, 10, 18)
    stats = ValidationStats()
    old_date = (today - timedelta(days=30)).isoformat()
    raw = {
        "market": "Bowenpally",
        "commodity": "Potato",
        "arrival_date": old_date,
        "modal_price": 1800.0
    }

    rec = validate_price_record(raw, stats, today_utc=today)
    assert rec is None
    assert stats.rejected_count == 1
    assert stats.rejections_by_reason.get("REJECT_STALE_DATE_OVER_7D") == 1


def test_min_max_inverted_rejected():
    """Verify that records where min_price > modal_price or modal_price > max_price are rejected."""
    today = date(2026, 10, 18)
    stats = ValidationStats()
    raw = {
        "market": "Madanapalle",
        "commodity": "Tomato",
        "arrival_date": "2026-10-18",
        "min_price": 3000.0,
        "modal_price": 2000.0,
        "max_price": 2500.0
    }

    rec = validate_price_record(raw, stats, today_utc=today)
    assert rec is None
    assert stats.rejected_count == 1
    assert stats.rejections_by_reason.get("REJECT_MIN_MAX_INVERTED") == 1


def test_rate_limiter_throttles():
    """Verify that RateLimiter limits requests and records timestamps."""
    limiter = RateLimiter(max_requests=2, window_seconds=1)
    t0 = time.time()
    limiter.acquire()
    limiter.acquire()
    # 3rd acquire must wait for the 1-second window
    limiter.acquire()
    t1 = time.time()
    assert (t1 - t0) >= 0.8


def test_open_mandi_api_mocked_http():
    """Verify OpenMandiApiSource fetches and validates without hitting live network."""
    today_str = datetime.now(UTC).date().isoformat()
    fake_api_response = {
        "success": True,
        "data": [
            {
                "market": "Kolar APMC",
                "district": "Kolar",
                "state": "Karnataka",
                "commodity": "Tomato",
                "variety": "Local",
                "grade": "FAQ",
                "arrival_date": today_str,
                "modal_price": 2400.0,
                "min_price": 2000.0,
                "max_price": 2600.0
            },
            {
                "market": "Junk Mandi",
                "commodity": "Tomato",
                "arrival_date": today_str,
                "modal_price": 0.01  # Junk row that must be filtered out
            }
        ]
    }

    mock_resp = MagicMock()
    mock_resp.status = 200
    mock_resp.read.return_value = json.dumps(fake_api_response).encode("utf-8")
    mock_resp.__enter__.return_value = mock_resp

    with patch("urllib.request.urlopen", return_value=mock_resp):
        stats = ValidationStats()
        source = OpenMandiApiSource(stats=stats)
        results = source.fetch("Tomato")

        assert len(results) == 1
        assert results[0].market == "Kolar APMC"
        assert results[0].modal_price_qtl == 2400.0
        assert stats.valid_count == 1
        assert stats.rejected_count == 1


def test_search_live_today_crop_no_data():
    """Verify that searching an unindexed crop returns status: 'no_data' - NEVER a synthesized price."""
    with patch("scrapers.todays_live_page_scraper.get_db_cursor") as mock_cursor:
        cur_instance = MagicMock()
        cur_instance.fetchone.return_value = None
        cur_instance.fetchall.return_value = []
        cur_instance.__enter__.return_value = cur_instance
        mock_cursor.return_value = cur_instance

        with patch("scrapers.price_sources.OpenMandiApiSource.fetch", return_value=[]):
            res = search_live_today_crop("Cotton")
            # Must return honest no_data, never synthesize prices
            assert res.get("status") == "no_data"
            assert "Cotton" in res.get("commodity", "")
            assert "No live mandi prices available" in res.get("message", "")


def test_health_ready_mandi_telemetry():
    """Verify GET /v1/health/ready includes mandi_data telemetry."""
    with patch("database.cibrc_isolated_db.get_cibrc_row_count", return_value=50):
        with patch("database.connection.get_db_cursor") as mock_cursor:
            cur_instance = MagicMock()
            cur_instance.fetchone.return_value = {"max_date": "2026-10-18", "total": 120}
            cur_instance.fetchall.return_value = [{"source": "AGMARKNET"}]
            cur_instance.__enter__.return_value = cur_instance
            mock_cursor.return_value = cur_instance

            response = client.get("/v1/health/ready")
            assert response.status_code == 200
            data = response.json()
            assert data["ready"] is True
            assert "mandi_data" in data
            m_data = data["mandi_data"]
            assert m_data["latest_arrival_date"] == "2026-10-18"
            assert m_data["total_records"] == 120
            assert "AGMARKNET" in m_data["sources_active"]
            assert m_data["stale"] is False
