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
    CRITICAL: Never deletes records if it would purge the last remaining good data.
    NEVER deletes mandi_price_history within KS_HISTORY_DAYS (default 400).
    """
    import os
    use_pg = is_postgres_active()
    deleted_counts = {"mandi_prices": 0, "weather_advisories": 0, "audit_logs": 0, "mandi_price_history": 0}
    history_retention_days = int(os.getenv("KS_HISTORY_DAYS", "400"))

    with get_db_cursor() as cur:
        # Check current count first
        cur.execute("SELECT COUNT(*) AS c FROM mandi_prices;")
        row = cur.fetchone()
        total_mandi = row["c"] if isinstance(row, dict) else row[0]

        if use_pg:
            # Only prune if there are newer records to prevent purging the last good data
            cur.execute(
                "SELECT COUNT(*) AS c FROM mandi_prices WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '%s hours';"
                % hours_retention
            )
            recent_row = cur.fetchone()
            recent_count = recent_row["c"] if isinstance(recent_row, dict) else recent_row[0]

            if recent_count > 0 and total_mandi > recent_count:
                cur.execute(
                    "DELETE FROM mandi_prices WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '%s hours';"
                    % hours_retention
                )
                deleted_counts["mandi_prices"] = cur.rowcount

            # Prune audit logs older than 7 days
            cur.execute("DELETE FROM scraper_audit_logs WHERE executed_at < CURRENT_TIMESTAMP - INTERVAL '7 days';")
            deleted_counts["audit_logs"] = cur.rowcount

            # Prune history ONLY if older than KS_HISTORY_DAYS (default 400 days)
            cur.execute(
                "DELETE FROM mandi_price_history WHERE arrival_date < (CURRENT_DATE - INTERVAL '%s days');"
                % history_retention_days
            )
            deleted_counts["mandi_price_history"] = cur.rowcount
        else:
            cur.execute("SELECT COUNT(*) AS c FROM mandi_prices WHERE created_at >= datetime('now', '-%d hours');" % hours_retention)
            recent_row = cur.fetchone()
            recent_count = recent_row["c"] if isinstance(recent_row, dict) else recent_row[0]

            if recent_count > 0 and total_mandi > recent_count:
                cur.execute("DELETE FROM mandi_prices WHERE created_at < datetime('now', '-%d hours');" % hours_retention)
                deleted_counts["mandi_prices"] = cur.rowcount
            cur.execute("DELETE FROM scraper_audit_logs WHERE executed_at < datetime('now', '-7 days');")
            deleted_counts["audit_logs"] = cur.rowcount

            # Prune history ONLY if older than KS_HISTORY_DAYS (default 400 days)
            cur.execute("DELETE FROM mandi_price_history WHERE arrival_date < date('now', '-%d days');" % history_retention_days)
            deleted_counts["mandi_price_history"] = cur.rowcount

    logger.info("Pruned previous cycles (history retained for %d days): %s", history_retention_days, deleted_counts)
    return deleted_counts


def ingest_mandi_records(records: list[dict[str, Any]]) -> int:
    """Upserts mandi arrivals and prices into mandi_prices and mandi_price_history."""
    inserted = 0
    use_pg = is_postgres_active()
    placeholder = "%s" if use_pg else "?"

    with get_db_cursor() as cur:
        for r in records:
            modal_qtl = float(r["modal_price_qtl"])
            modal_kg = round(modal_qtl / 100.0, 1)
            raw_data = json.dumps(r.get("raw_payload", {}))
            source = r.get("source", "OPEN_MANDI_API")
            arrival_quintals = float(r.get("arrival_quintals", 0.0))
            min_qtl = float(r["min_price_qtl"])
            max_qtl = float(r["max_price_qtl"])
            variety = r.get("variety", "FAQ")
            grade = r.get("grade", "Standard")
            fetched_at = r.get("fetched_at", datetime.datetime.now(datetime.timezone.utc).isoformat())

            # 1. Upsert into mandi_prices (active live cache)
            if use_pg:
                query_prices = f"""
                INSERT INTO mandi_prices (
                    state, district, market, commodity, variety, grade,
                    arrival_date, arrival_quintals, min_price_qtl, max_price_qtl,
                    modal_price_qtl, modal_price_kg, source, raw_payload
                ) VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder},
                          {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder},
                          {placeholder}, {placeholder}::jsonb)
                ON CONFLICT (market, commodity, variety, arrival_date) DO UPDATE SET
                    state = EXCLUDED.state,
                    district = EXCLUDED.district,
                    grade = EXCLUDED.grade,
                    arrival_quintals = EXCLUDED.arrival_quintals,
                    min_price_qtl = EXCLUDED.min_price_qtl,
                    max_price_qtl = EXCLUDED.max_price_qtl,
                    modal_price_qtl = EXCLUDED.modal_price_qtl,
                    modal_price_kg = EXCLUDED.modal_price_kg,
                    source = EXCLUDED.source,
                    raw_payload = EXCLUDED.raw_payload,
                    updated_at = CURRENT_TIMESTAMP;
                """
            else:
                query_prices = f"""
                INSERT INTO mandi_prices (
                    state, district, market, commodity, variety, grade,
                    arrival_date, arrival_quintals, min_price_qtl, max_price_qtl,
                    modal_price_qtl, modal_price_kg, source, raw_payload
                ) VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder},
                          {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder},
                          {placeholder}, {placeholder})
                ON CONFLICT(market, commodity, variety, arrival_date) DO UPDATE SET
                    state = excluded.state,
                    district = excluded.district,
                    grade = excluded.grade,
                    arrival_quintals = excluded.arrival_quintals,
                    min_price_qtl = excluded.min_price_qtl,
                    max_price_qtl = excluded.max_price_qtl,
                    modal_price_qtl = excluded.modal_price_qtl,
                    modal_price_kg = excluded.modal_price_kg,
                    source = excluded.source,
                    raw_payload = excluded.raw_payload,
                    updated_at = datetime('now');
                """

            cur.execute(query_prices, (
                r["state"], r["district"], r["market"], r["commodity"],
                variety, grade,
                r["arrival_date"], arrival_quintals,
                min_qtl, max_qtl,
                modal_qtl, modal_kg, source,
                raw_data
            ))

            # 2. Upsert into mandi_price_history (never purged by 6h cycles)
            if use_pg:
                query_hist = f"""
                INSERT INTO mandi_price_history (
                    market, district, state, commodity, variety, arrival_date,
                    min_price_qtl, max_price_qtl, modal_price_qtl, arrival_quintals,
                    source, fetched_at
                ) VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder},
                          {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})
                ON CONFLICT (market, commodity, variety, arrival_date) DO UPDATE SET
                    min_price_qtl = EXCLUDED.min_price_qtl,
                    max_price_qtl = EXCLUDED.max_price_qtl,
                    modal_price_qtl = EXCLUDED.modal_price_qtl,
                    arrival_quintals = EXCLUDED.arrival_quintals,
                    source = EXCLUDED.source,
                    fetched_at = EXCLUDED.fetched_at;
                """
            else:
                query_hist = f"""
                INSERT INTO mandi_price_history (
                    market, district, state, commodity, variety, arrival_date,
                    min_price_qtl, max_price_qtl, modal_price_qtl, arrival_quintals,
                    source, fetched_at
                ) VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder},
                          {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})
                ON CONFLICT(market, commodity, variety, arrival_date) DO UPDATE SET
                    min_price_qtl = excluded.min_price_qtl,
                    max_price_qtl = excluded.max_price_qtl,
                    modal_price_qtl = excluded.modal_price_qtl,
                    arrival_quintals = excluded.arrival_quintals,
                    source = excluded.source,
                    fetched_at = excluded.fetched_at;
                """

            cur.execute(query_hist, (
                r["market"], r["district"], r["state"], r["commodity"],
                variety, r["arrival_date"],
                min_qtl, max_qtl, modal_qtl, arrival_quintals,
                source, fetched_at
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
    """Executes end-to-end scraper ingestion, DB upsert, and cache invalidation.
    CRITICAL: Last good data is never deleted if a scrape fails.
    """
    start_time = time.time()
    init_database()
    use_pg = is_postgres_active()
    placeholder = "%s" if use_pg else "?"

    try:
        # 1. Scrape & Ingest new data first
        mandi_records = scrape_mandi_prices()
        weather_records = fetch_weather_advisories()
        scheme_records = scrape_govt_policies()
        live_today_res = todays_live_scraper.run_scrape_and_ingest()

        mandi_count = ingest_mandi_records(mandi_records)
        weather_count = ingest_weather_records(weather_records)
        scheme_count = ingest_govt_schemes(scheme_records)
        live_today_count = live_today_res.get("crops_ingested", 0)

        # 2. Prune previous cycle data ONLY after new data has been successfully ingested
        pruned = prune_stale_data(hours_retention=6)

        # 3. Cache Invalidation
        invalidate_redis_cache()

        duration = round(time.time() - start_time, 4)

        # 4. Audit Log (SUCCESS)
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

        logger.info(
            "Ingestion completed: %d mandis, %d weather, %d schemes, %d live today crops (pruned %s) in %.2fs",
            mandi_count, weather_count, scheme_count, live_today_count, pruned, duration
        )

        # Fail if zero valid mandi rows were stored
        if mandi_count == 0:
            logger.error("Scraper ingestion stored zero valid mandi rows!")
            raise RuntimeError("Zero valid mandi rows were stored from active price sources.")

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
    except Exception as exc:
        duration = round(time.time() - start_time, 4)
        logger.error("Scraper ingestion failed; existing data preserved: %s", exc)
        try:
            with get_db_cursor() as cur:
                cur.execute(f"""
                INSERT INTO scraper_audit_logs (
                    source_name, target_commodity, records_scraped, records_upserted, duration_seconds, status, error_message
                ) VALUES ({placeholder}, {placeholder}, 0, 0, {placeholder}, 'FAILED', {placeholder});
                """, ("ALL_SCRAPERS_ORCHESTRATOR", "FAILED_INGESTION", duration, str(exc)[:500]))
        except Exception:
            pass
        return {
            "status": "FAILED",
            "error": str(exc),
            "stale": True,
            "duration_seconds": duration,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    res = run_full_ingestion()
    print("Ingestion result:", res)
    if res.get("status") != "SUCCESS" or res.get("mandi_records", 0) == 0:
        logger.error("Ingestion failed: zero valid rows stored. Exiting non-zero.")
        sys.exit(1)

