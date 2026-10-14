"""Forwarding module for scrapers.govt_scraper (Backward compatibility)."""

import warnings
warnings.warn("database.govt_scraper has been moved to scrapers.govt_scraper", DeprecationWarning, stacklevel=2)

from scrapers.govt_scraper import scrape_govt_policies, AUTHENTIC_GOVT_SCHEMES
from scrapers.ingester import ingest_govt_schemes as ingest_scraped_policies

__all__ = ["scrape_govt_policies", "AUTHENTIC_GOVT_SCHEMES", "ingest_scraped_policies"]
