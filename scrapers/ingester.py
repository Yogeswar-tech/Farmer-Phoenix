"""Automated Scraper Pipeline Ingestion Engine.

1. Orchestrates Mandi, Govt Policy, and Weather Scrapers.
2. Upserts data into PostgreSQL with JSONB unstructured fields.
3. Automatically invalidates Redis cache keys so the API delivers fresh live data.
4. Logs execution metrics into `scraper_audit_logs`.
"""

import sys
import time
import json
import logging
import datetime
from pathlib import Path
from typing import Any

# Ensure project root is in sys.path
CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from database.connection import get_db_cursor, is_postgres_active, init_database
from scrapers.mandi_scraper import scrape_mandi_prices
from scrapers.govt_scraper import scrape_govt_policies
from scrapers.weather_scraper import fetch_weather_advisories
from scrapers.todays_live_page_scraper import todays_live_scraper

logger = logging.getLogger("ScraperIngester")


def invalidate_redis_cache():
    """Invalidates cached mandi rates, weather, and scheme keys in Redis."""
    try:
        from backend.app.cache.cache_service import cache_service
        cache_service.invalidate_pattern("mandi:*")
        cache_service.invalidate_pattern("weather:*")
        cache_service.invalidate_pattern("schemes:*")
        logger.info("Redis cache keys successfully invalidated after ingestion.")
    except Exception as e:
        logger.debug("Redis cache invalidation skipped: %s", e)


def prune_stale_data(hours_retention: int = 6) -> dict[str, int]:
    """Deletes scraped data older than 6 hours to maintain live freshness and save DB storage.

    1. Mandi Prices: Purges records older than 6 hours so Postgres keeps only the live window.
    2. Weather Advisories: Cleared and refreshed on every cycle.
    3. Scraper Audit Logs: Retains only the last 7 days of audit telemetry.
    """
    use_pg = is_postgres_active()
    deleted_counts = {"mandi_prices": 0, "weather_advisories": 0, "audit_logs": 0}

    with get_db_cursor() as cur:
        if use_pg:
            # 1. Prune mandi prices older than 6 hours
            cur.execute("""
            DELETE FROM mandi_prices 
            WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '%s hours';
            """ % hours_retention)
            deleted_counts["mandi_prices"] = cur.rowcount

            # 2. Prune audit logs older than 7 days
            cur.execute("""
            DELETE FROM scraper_audit_logs 
            WHERE executed_at < CURRENT_TIMESTAMP - INTERVAL '7 days';
            """)
            deleted_counts["audit_logs"] = cur.rowcount
        else:
            cur.execute("DELETE FROM mandi_prices WHERE created_at < datetime('now', '-%d hours');" % hours_retention)
            deleted_counts["mandi_prices"] = cur.rowcount
            cur.execute("DELETE FROM scraper_audit_logs WHERE executed_at < datetime('now', '-7 days');")
            deleted_counts["audit_logs"] = cur.rowcount

    logger.info("Pruned previous cycles older than %d hours: %s", hours_retention, deleted_counts)
    return deleted_counts


def ingest_mandi_records(records: list[dict[str, Any]]) -> int:
    """Upserts mandi arrivals and prices into the database."""
    inserted = 0
    use_pg = is_postgres_active()
    placeholder = "%s" if use_pg else "?"

    with get_db_cursor() as cur:
        for r in records:
            modal_qtl = float(r["modal_price_qtl"])
            modal_kg = round(modal_qtl / 100.0, 1)
            raw_data = json.dumps(r.get("raw_payload", {}))

            if use_pg:
                query = f"""
                INSERT INTO mandi_prices (
                    state, district, market, commodity, variety, grade,
                    arrival_date, arrival_quintals, min_price_qtl, max_price_qtl,
                    modal_price_qtl, modal_price_kg, source, raw_payload
                ) VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder},
                          {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder},
                          {placeholder}, {placeholder}::jsonb);
                """
            else:
                query = f"""
                INSERT INTO mandi_prices (
                    state, district, market, commodity, variety, grade,
                    arrival_date, arrival_quintals, min_price_qtl, max_price_qtl,
                    modal_price_qtl, modal_price_kg, source, raw_payload
                ) VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder},
                          {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder},
                          {placeholder}, {placeholder});
                """

            cur.execute(query, (
                r["state"], r["district"], r["market"], r["commodity"],
                r.get("variety", "FAQ"), r.get("grade", "Standard"),
                r["arrival_date"], float(r.get("arrival_quintals", 0.0)),
                float(r["min_price_qtl"]), float(r["max_price_qtl"]),
                modal_qtl, modal_kg, r.get("source", "AGMARKNET_SCRAPER"),
                raw_data
            ))
            inserted += 1

            # Insert trend tracker
            trend_q = f"""
            INSERT INTO price_trends (
                commodity, market, state, record_date, modal_price_qtl, modal_price_kg, trend_direction
            ) VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder});
            """
            cur.execute(trend_q, (
                r["commodity"], r["market"], r["state"], r["arrival_date"],
                modal_qtl, modal_kg, "UP" if modal_kg > 25.0 else "STABLE"
            ))

    return inserted


def ingest_weather_records(records: list[dict[str, Any]]) -> int:
    """Upserts weather advisories into the database."""
    inserted = 0
    use_pg = is_postgres_active()
    placeholder = "%s" if use_pg else "?"

    with get_db_cursor() as cur:
        # Clear old forecasts
        cur.execute("DELETE FROM weather_advisories;")

        for w in records:
            radar_json = json.dumps(w.get("radar_data", {}))
            if use_pg:
                query = f"""
                INSERT INTO weather_advisories (
                    location_id, location_name, district, state, pincode,
                    forecast_date, temp_max_c, temp_min_c, rain_chance_pct,
                    wind_speed_kmh, condition_text, risk_level, spray_status,
                    spray_advice, drying_window, radar_synced, source, radar_data
                ) VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder},
                          {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder},
                          {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder},
                          {placeholder}, {placeholder}, {placeholder}::jsonb);
                """
            else:
                query = f"""
                INSERT INTO weather_advisories (
                    location_id, location_name, district, state, pincode,
                    forecast_date, temp_max_c, temp_min_c, rain_chance_pct,
                    wind_speed_kmh, condition_text, risk_level, spray_status,
                    spray_advice, drying_window, radar_synced, source, radar_data
                ) VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder},
                          {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder},
                          {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder},
                          {placeholder}, {placeholder}, {placeholder});
                """

            cur.execute(query, (
                w["location_id"], w["location_name"], w["district"], w["state"], w.get("pincode"),
                w["forecast_date"], w["temp_max_c"], w["temp_min_c"], w["rain_chance_pct"],
                w["wind_speed_kmh"], w["condition_text"], w["risk_level"], w["spray_status"],
                w["spray_advice"], w["drying_window"], bool(w.get("radar_synced")),
                w.get("source", "IMD_OPEN_METEO"), radar_json
            ))
            inserted += 1

    return inserted


def ingest_govt_schemes(records: list[dict[str, Any]]) -> int:
    """Upserts government policies and 4% concessional loans."""
    upserted = 0
    use_pg = is_postgres_active()
    placeholder = "%s" if use_pg else "?"

    with get_db_cursor() as cur:
        for s in records:
            criteria_json = json.dumps(s.get("raw_criteria", {}))

            if use_pg:
                query = f"""
                INSERT INTO govt_policies_and_loans (
                    scheme_id, category, title_en, title_hi, title_te,
                    benefit_amount, interest_rate, max_limit,
                    eligibility_en, eligibility_hi, eligibility_te,
                    short_desc_en, short_desc_hi, short_desc_te,
                    helpline, apply_url, source_portal, raw_criteria
                ) VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder},
                          {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder},
                          {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder},
                          {placeholder}, {placeholder}, {placeholder}::jsonb)
                ON CONFLICT (scheme_id) DO UPDATE SET
                    benefit_amount = EXCLUDED.benefit_amount,
                    updated_at = CURRENT_TIMESTAMP;
                """
            else:
                query = f"""
                INSERT INTO govt_policies_and_loans (
                    scheme_id, category, title_en, title_hi, title_te,
                    benefit_amount, interest_rate, max_limit,
                    eligibility_en, eligibility_hi, eligibility_te,
                    short_desc_en, short_desc_hi, short_desc_te,
                    helpline, apply_url, source_portal, raw_criteria
                ) VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder},
                          {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder},
                          {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder},
                          {placeholder}, {placeholder}, {placeholder})
                ON CONFLICT (scheme_id) DO UPDATE SET
                    benefit_amount = excluded.benefit_amount,
                    updated_at = datetime('now');
                """

            cur.execute(query, (
                s["scheme_id"], s["category"], s["title_en"], s["title_hi"], s["title_te"],
                s["benefit_amount"], s.get("interest_rate"), s.get("max_limit"),
                s["eligibility_en"], s["eligibility_hi"], s["eligibility_te"],
                s["short_desc_en"], s["short_desc_hi"], s["short_desc_te"],
                s["helpline"], s["apply_url"], s.get("source_portal", "myscheme.gov.in"),
                criteria_json
            ))
            upserted += 1

    return upserted


def run_full_ingestion() -> dict[str, Any]:
    """Executes end-to-end scraper ingestion, DB upsert, and cache invalidation."""
    start_time = time.time()
    init_database()

    # 0. Prune previous cycle data older than 6 hours so PostgreSQL stays lean & fresh
    pruned = prune_stale_data(hours_retention=6)

    # 1. Scrape
    mandi_records = scrape_mandi_prices()
    weather_records = fetch_weather_advisories()
    scheme_records = scrape_govt_policies()
    live_today_res = todays_live_scraper.run_scrape_and_ingest()

    # 2. Ingest
    mandi_count = ingest_mandi_records(mandi_records)
    weather_count = ingest_weather_records(weather_records)
    scheme_count = ingest_govt_schemes(scheme_records)
    live_today_count = live_today_res.get("crops_ingested", 0)

    # 3. Cache Invalidation
    invalidate_redis_cache()

    duration = round(time.time() - start_time, 4)

    # 4. Audit Log
    use_pg = is_postgres_active()
    placeholder = "%s" if use_pg else "?"
    with get_db_cursor() as cur:
        cur.execute(f"""
        INSERT INTO scraper_audit_logs (
            source_name, target_commodity, records_scraped, records_upserted, duration_seconds, status
        ) VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder});
        """, (
            "ALL_SCRAPERS_ORCHESTRATOR", "MANDI_WEATHER_SCHEMES_LIVETODAY",
            len(mandi_records) + len(weather_records) + len(scheme_records) + live_today_count,
            mandi_count + weather_count + scheme_count + live_today_count,
            duration, "SUCCESS"
        ))

    logger.info("Ingestion completed: %d mandis, %d weather, %d schemes, %d live today crops (pruned %s) in %.2fs",
                mandi_count, weather_count, scheme_count, live_today_count, pruned, duration)

    return {
        "status": "SUCCESS",
        "mandi_records": mandi_count,
        "weather_advisories": weather_count,
        "govt_schemes": scheme_count,
        "live_today_crops": live_today_count,
        "pruned_stale_records": pruned,
        "retention_window_hours": 6,
        "duration_seconds": duration,
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    res = run_full_ingestion()
    print("Ingestion result:", res)
