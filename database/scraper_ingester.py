"""Forwarding module for scrapers.ingester (Backward compatibility)."""

import warnings
warnings.warn("database.scraper_ingester has been moved to scrapers.ingester", DeprecationWarning, stacklevel=2)

from scrapers.ingester import (
    ingest_mandi_records as ingest_scraped_mandi_data,
    ingest_weather_records as generate_seed_weather_advisories,
    run_full_ingestion,
)
from scrapers.mandi_scraper import BENCHMARK_MANDI_FEEDS as SEED_MANDI_RECORDS

__all__ = [
    "ingest_scraped_mandi_data",
    "generate_seed_weather_advisories",
    "run_full_ingestion",
    "SEED_MANDI_RECORDS",
]
