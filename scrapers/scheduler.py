"""Recurring 6-Hour Background Scraper Scheduler for Kisan-Sethu.

Automates:
1. Every 6 hours: Ingests Agmarknet / APMC mandi arrivals and modal ₹/kg rates.
2. Every 6 hours: Ingests 7-day operational weather forecasts & spray warnings.
3. Every 6 hours: Refreshes government policies, subsidies & 4% KCC loans.
4. Automatically invalidates Redis cache keys so users see fresh data.
5. Records execution telemetry into `scraper_audit_logs`.
"""

import sys
import time
import logging
from pathlib import Path

# Ensure project root is in sys.path
CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from scrapers.ingester import run_full_ingestion

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [6H-Scheduler] %(message)s",
)
logger = logging.getLogger("ScraperScheduler")

INTERVAL_SECONDS = 6 * 60 * 60  # 6 hours (21,600 seconds)


def run_forever():
    """Continuous daemon loop running ingestion every 6 hours."""
    logger.info("Starting Kisan-Sethu 6-hour recurring scraper daemon...")
    while True:
        try:
            logger.info("Executing periodic 6-hour ingestion cycle...")
            result = run_full_ingestion()
            logger.info("Cycle finished successfully: %s", result)
        except Exception as e:
            logger.error("Scraper cycle failed with error: %s", e, exc_info=True)

        logger.info("Sleeping for %d seconds (next run in 6 hours)...", INTERVAL_SECONDS)
        time.sleep(INTERVAL_SECONDS)


if __name__ == "__main__":
    run_forever()
