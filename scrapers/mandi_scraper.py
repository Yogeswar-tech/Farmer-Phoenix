"""Agmarknet & APMC Mandi Real-Time Price Scraper.

Targets:
- agmarknet.gov.in (Official Directorate of Marketing & Inspection, Ministry of Agriculture)
- data.gov.in Daily Mandi Price API
- State APMC Portals (Andhra Pradesh, Telangana, Maharashtra, Karnataka, Gujarat)
"""

import os
import json
import logging
import datetime
import urllib.request
import urllib.error
from typing import Any

logger = logging.getLogger("MandiScraper")

# Benchmark active crops and major mandis across India
BENCHMARK_MANDI_FEEDS = [
    {
        "state": "Andhra Pradesh",
        "district": "Guntur",
        "market": "Guntur APMC Yard",
        "commodity": "Chilli",
        "variety": "Teja / Deluxe Red",
        "grade": "Grade-A Export",
        "arrival_date": datetime.date.today().isoformat(),
        "arrival_quintals": 4200.0,
        "min_price_qtl": 13800.0,
        "max_price_qtl": 16500.0,
        "modal_price_qtl": 15200.0,
        "source": "AGMARKNET_LIVE_SCRAPER",
        "raw_payload": {
            "moisture_pct": 10.5,
            "stalkless_pct": 85,
            "color_asta": 120,
            "lot_count": 45
        }
    },
    {
        "state": "Andhra Pradesh",
        "district": "Chittoor",
        "market": "Madanapalle Mandi",
        "commodity": "Tomato",
        "variety": "Hybrid Super 10",
        "grade": "Grade-A",
        "arrival_date": datetime.date.today().isoformat(),
        "arrival_quintals": 6800.0,
        "min_price_qtl": 2200.0,
        "max_price_qtl": 2900.0,
        "modal_price_qtl": 2600.0,
        "source": "APMC_CHITTOOR_FEED",
        "raw_payload": {
            "crate_size_kg": 25,
            "firmness_index": "high",
            "arrivals_trend": "SURGING"
        }
    },
    {
        "state": "Telangana",
        "district": "Warangal",
        "market": "Warangal Enamamula Mandi",
        "commodity": "Chilli",
        "variety": "Wonder Hot",
        "grade": "FAQ",
        "arrival_date": datetime.date.today().isoformat(),
        "arrival_quintals": 3100.0,
        "min_price_qtl": 12500.0,
        "max_price_qtl": 15200.0,
        "modal_price_qtl": 14100.0,
        "source": "AGMARKNET_LIVE_SCRAPER",
        "raw_payload": {
            "moisture_pct": 12.0
        }
    },
    {
        "state": "Telangana",
        "district": "Khammam",
        "market": "Khammam APMC",
        "commodity": "Chilli",
        "variety": "Teja Special",
        "grade": "Grade-A",
        "arrival_date": datetime.date.today().isoformat(),
        "arrival_quintals": 2800.0,
        "min_price_qtl": 13200.0,
        "max_price_qtl": 15800.0,
        "modal_price_qtl": 14700.0,
        "source": "AGMARKNET_LIVE_SCRAPER",
        "raw_payload": {
            "moisture_pct": 11.2
        }
    },
    {
        "state": "Maharashtra",
        "district": "Nashik",
        "market": "Lasalgaon Mandi",
        "commodity": "Onion",
        "variety": "Purna Red",
        "grade": "Grade-A Export",
        "arrival_date": datetime.date.today().isoformat(),
        "arrival_quintals": 12500.0,
        "min_price_qtl": 2800.0,
        "max_price_qtl": 3600.0,
        "modal_price_qtl": 3250.0,
        "source": "MSAMB_SCRAPER",
        "raw_payload": {
            "size_mm": "55+",
            "dry_skin_layers": 3
        }
    },
    {
        "state": "Maharashtra",
        "district": "Pune",
        "market": "Pune Gultekdi APMC",
        "commodity": "Tomato",
        "variety": "Local Standard",
        "grade": "FAQ",
        "arrival_date": datetime.date.today().isoformat(),
        "arrival_quintals": 4500.0,
        "min_price_qtl": 1900.0,
        "max_price_qtl": 2600.0,
        "modal_price_qtl": 2300.0,
        "source": "MSAMB_SCRAPER",
        "raw_payload": {
            "crate_size_kg": 20
        }
    },
    {
        "state": "Karnataka",
        "district": "Kolar",
        "market": "Kolar APMC Yard",
        "commodity": "Tomato",
        "variety": "Hybrid Red",
        "grade": "Grade-A",
        "arrival_date": datetime.date.today().isoformat(),
        "arrival_quintals": 8900.0,
        "min_price_qtl": 2100.0,
        "max_price_qtl": 2750.0,
        "modal_price_qtl": 2450.0,
        "source": "E_NAM_SCRAPER",
        "raw_payload": {
            "export_suitable": True
        }
    },
    {
        "state": "Karnataka",
        "district": "Bangalore Urban",
        "market": "Yeshwanthpur Mandi",
        "commodity": "Potato",
        "variety": "Hassan Jyoti",
        "grade": "Grade-A",
        "arrival_date": datetime.date.today().isoformat(),
        "arrival_quintals": 5200.0,
        "min_price_qtl": 1800.0,
        "max_price_qtl": 2300.0,
        "modal_price_qtl": 2050.0,
        "source": "E_NAM_SCRAPER",
        "raw_payload": {
            "sugar_content": "low"
        }
    },
    {
        "state": "Madhya Pradesh",
        "district": "Indore",
        "market": "Indore Devi Ahilya APMC",
        "commodity": "Potato",
        "variety": "Chipsona / Kufri",
        "grade": "Processing Grade",
        "arrival_date": datetime.date.today().isoformat(),
        "arrival_quintals": 9400.0,
        "min_price_qtl": 1600.0,
        "max_price_qtl": 2100.0,
        "modal_price_qtl": 1900.0,
        "source": "AGMARKNET_LIVE_SCRAPER",
        "raw_payload": {
            "wafer_grade": True
        }
    },
    {
        "state": "Gujarat",
        "district": "Gondal",
        "market": "Gondal APMC Market Yard",
        "commodity": "Chilli",
        "variety": "Guntur Hybrid 4",
        "grade": "Grade-A",
        "arrival_date": datetime.date.today().isoformat(),
        "arrival_quintals": 3600.0,
        "min_price_qtl": 12800.0,
        "max_price_qtl": 15400.0,
        "modal_price_qtl": 14200.0,
        "source": "AGMARKNET_LIVE_SCRAPER",
        "raw_payload": {
            "pungency_shus": 35000
        }
    }
]


def fetch_live_datagov_prices(api_key: str | None = None) -> list[dict[str, Any]]:
    """Fetches real-time mandi prices via active PriceSource.
    Never returns mock/sample data in production.
    """
    from scrapers.price_sources import (
        get_active_price_source,
        get_tracked_crops,
        ValidationStats,
    )

    stats = ValidationStats()
    source = get_active_price_source(stats)
    tracked_crops = get_tracked_crops()

    records: list[dict[str, Any]] = []
    for crop in tracked_crops:
        try:
            crop_records = source.fetch(crop)
            for rec in crop_records:
                records.append({
                    "state": rec.state,
                    "district": rec.district,
                    "market": rec.market,
                    "commodity": rec.commodity,
                    "variety": rec.variety,
                    "grade": rec.grade,
                    "arrival_date": rec.arrival_date,
                    "arrival_quintals": rec.arrival_quintals,
                    "min_price_qtl": rec.min_price_qtl,
                    "max_price_qtl": rec.max_price_qtl,
                    "modal_price_qtl": rec.modal_price_qtl,
                    "source": rec.source,
                    "fetched_at": rec.fetched_at,
                    "raw_payload": rec.raw_payload
                })
        except Exception as exc:
            logger.warning("Failed fetching crop %s from source %s: %s", crop, getattr(source, "name", "unknown"), exc)

    if not records:
        if os.getenv("KS_USE_SAMPLE_DATA", "").lower() in ("true", "1"):
            logger.info("Using benchmark mandi feeds for local test (KS_USE_SAMPLE_DATA=true).")
            return BENCHMARK_MANDI_FEEDS
        logger.warning("No live mandi records retrieved from source %s. Returning empty list.", getattr(source, "name", "unknown"))
        return []

    logger.info(
        "Mandi fetch complete: %d valid records, %d rejected (reasons: %s)",
        len(records), stats.rejected_count, stats.rejections_by_reason
    )
    return records


def scrape_mandi_prices() -> list[dict[str, Any]]:
    """Entrypoint for APMC mandi pricing scraping."""
    return fetch_live_datagov_prices()

