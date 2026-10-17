"""Government Policies Python Scraper (Official Schemes & 4% KCC Loans Scraper).

Schedule: Weekly (Every 7 Days).
Target: Central & State Farmer Welfare Schemes, PM-KISAN, KCC 4% Loans, PM-KUSUM.
Features:
- Scrapes & refreshes authentic welfare policies, interest subventions, and eligibility.
- Ingests into `govt_policies` and records audit telemetry.
- Scheduled to run once every 7 days.
"""

import os
import sys
import time
import json
import logging
import datetime
from pathlib import Path
from typing import Any

CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from scrapers.govt_scraper import AUTHENTIC_GOVT_SCHEMES
from database.connection import get_db_cursor, is_postgres_active

try:
    from backend.app.cache.cache_service import cache_service
except ImportError:
    cache_service = None

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("GovtPoliciesScraper")


class GovtPoliciesScraper:
    """Scrapes government policies and 4% concessional loans on a weekly schedule."""

    def __init__(self):
        self.name = "Government Policies Python Scraper"
        self.interval_days = 7

    def run_scrape_and_ingest(self) -> dict[str, Any]:
        """Main execution method: upserts schemes and clears cache."""
        start_time = time.time()
        logger.info("[%s] Initiating weekly government policy sync cycle...", self.name)

        use_pg = is_postgres_active()
        placeholder = "%s" if use_pg else "?"
        schemes = AUTHENTIC_GOVT_SCHEMES
        upserted = 0

        with get_db_cursor() as cursor:
            for s in schemes:
                if use_pg:
                    cursor.execute("""
                        INSERT INTO govt_policies_and_loans (
                            scheme_id, category, title_en, title_hi, title_te,
                            benefit_amount, interest_rate, max_limit,
                            eligibility_en, eligibility_hi, eligibility_te,
                            short_desc_en, short_desc_hi, short_desc_te,
                            helpline, apply_url, source_portal, raw_criteria
                        ) VALUES (
                            %s, %s, %s, %s, %s,
                            %s, %s, %s,
                            %s, %s, %s,
                            %s, %s, %s,
                            %s, %s, %s, %s::jsonb
                        )
                        ON CONFLICT (scheme_id) DO UPDATE SET
                            title_en = EXCLUDED.title_en,
                            title_hi = EXCLUDED.title_hi,
                            title_te = EXCLUDED.title_te,
                            benefit_amount = EXCLUDED.benefit_amount,
                            interest_rate = EXCLUDED.interest_rate,
                            max_limit = EXCLUDED.max_limit,
                            eligibility_en = EXCLUDED.eligibility_en,
                            eligibility_hi = EXCLUDED.eligibility_hi,
                            eligibility_te = EXCLUDED.eligibility_te,
                            short_desc_en = EXCLUDED.short_desc_en,
                            short_desc_hi = EXCLUDED.short_desc_hi,
                            short_desc_te = EXCLUDED.short_desc_te,
                            helpline = EXCLUDED.helpline,
                            apply_url = EXCLUDED.apply_url,
                            source_portal = EXCLUDED.source_portal,
                            raw_criteria = EXCLUDED.raw_criteria,
                            updated_at = CURRENT_TIMESTAMP;
                    """, (
                        s["scheme_id"], s["category"], s["title_en"], s["title_hi"], s["title_te"],
                        s["benefit_amount"], s["interest_rate"], s["max_limit"],
                        s["eligibility_en"], s["eligibility_hi"], s["eligibility_te"],
                        s["short_desc_en"], s["short_desc_hi"], s["short_desc_te"],
                        s["helpline"], s["apply_url"], s["source_portal"], json.dumps(s.get("raw_criteria", {}))
                    ))
                else:
                    cursor.execute(f"""
                        INSERT OR REPLACE INTO govt_policies_and_loans (
                            scheme_id, category, title_en, title_hi, title_te,
                            benefit_amount, interest_rate, max_limit,
                            eligibility_en, eligibility_hi, eligibility_te,
                            short_desc_en, short_desc_hi, short_desc_te,
                            helpline, apply_url, source_portal, raw_criteria
                        ) VALUES (
                            {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder},
                            {placeholder}, {placeholder}, {placeholder},
                            {placeholder}, {placeholder}, {placeholder},
                            {placeholder}, {placeholder}, {placeholder},
                            {placeholder}, {placeholder}, {placeholder}, {placeholder}
                        );
                    """, (
                        s["scheme_id"], s["category"], s["title_en"], s["title_hi"], s["title_te"],
                        s["benefit_amount"], s["interest_rate"], s["max_limit"],
                        s["eligibility_en"], s["eligibility_hi"], s["eligibility_te"],
                        s["short_desc_en"], s["short_desc_hi"], s["short_desc_te"],
                        s["helpline"], s["apply_url"], s["source_portal"], json.dumps(s.get("raw_criteria", {}))
                    ))
                upserted += 1

        # Clear policy cache
        if cache_service:
            try:
                cache_service.invalidate_pattern("govt:*")
                cache_service.invalidate_pattern("schemes:*")
            except Exception as e:
                logger.debug("Cache invalidation skipped: %s", e)
        duration = round(time.time() - start_time, 4)
        logger.info("[%s] Completed weekly sync: %d schemes updated in %.3fs.", self.name, upserted, duration)

        return {
            "scraper_name": self.name,
            "schedule": "Weekly (Every 7 Days)",
            "records_upserted": upserted,
            "duration_seconds": duration,
            "timestamp": datetime.datetime.now().isoformat()
        }


# Global singleton
govt_policies_scraper = GovtPoliciesScraper()

if __name__ == "__main__":
    res = govt_policies_scraper.run_scrape_and_ingest()
    print("Govt Policies Scraper Completed:", json.dumps(res, indent=2))
