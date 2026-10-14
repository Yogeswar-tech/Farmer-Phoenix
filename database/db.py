"""Database interface and compatibility layer for Kisan-Sethu.

Provides unified database access functions for FastAPI routes, scrapers, and background tasks.
Transparently routes queries to PostgreSQL (primary) or local SQLite fallback.
"""

import os
import sqlite3
import datetime
from pathlib import Path
from typing import Any, Generator
from contextlib import contextmanager

from .connection import (
    get_db_cursor,
    execute_query,
    execute_mutation,
    is_postgres_active,
    LOCAL_DB_PATH
)

DB_DIR = Path(__file__).resolve().parent
DB_FILE = LOCAL_DB_PATH


def get_connection(db_path: Path | str = DB_FILE) -> sqlite3.Connection:
    """Create a thread-safe connection to in-memory SQLite (Compatibility helper)."""
    db_target = str(db_path)
    if db_target != ":memory:":
        db_file_path = Path(db_path)
        db_file_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(
        db_target,
        check_same_thread=False,
        timeout=30.0,
        isolation_level=None
    )
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


@contextmanager
def db_session(db_path: Path | str = DB_FILE) -> Generator[sqlite3.Connection, None, None]:
    """Context manager for safe database transactions (Compatibility helper)."""
    conn = get_connection(db_path)
    try:
        conn.execute("BEGIN TRANSACTION;")
        yield conn
        conn.execute("COMMIT;")
    except Exception:
        conn.execute("ROLLBACK;")
        raise
    finally:
        conn.close()


def _ensure_column(cursor: sqlite3.Cursor, table: str, col_name: str, col_def: str) -> None:
    """Helper to add missing column to SQLite table without losing data."""
    cursor.execute(f"PRAGMA table_info({table});")
    existing_cols = [r[1] for r in cursor.fetchall()]
    if col_name not in existing_cols:
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_def};")


def init_sqlite_tables(db_path: Path | str = DB_FILE) -> None:
    """Initializes tables and auto-migrates columns in SQLite for fallback local development mode."""
    conn = get_connection(db_path)
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS mandi_prices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        state TEXT NOT NULL,
        district TEXT NOT NULL,
        market TEXT NOT NULL,
        commodity TEXT NOT NULL,
        variety TEXT DEFAULT 'FAQ',
        grade TEXT DEFAULT 'Standard',
        arrival_date TEXT NOT NULL,
        arrival_quintals REAL DEFAULT 0.0,
        min_price_qtl REAL NOT NULL,
        max_price_qtl REAL NOT NULL,
        modal_price_qtl REAL NOT NULL,
        modal_price_kg REAL NOT NULL,
        source TEXT DEFAULT 'AGMARKNET_SCRAPER',
        raw_payload TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS price_trends (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        commodity TEXT NOT NULL,
        market TEXT NOT NULL,
        state TEXT NOT NULL,
        record_date TEXT NOT NULL,
        modal_price_qtl REAL NOT NULL,
        modal_price_kg REAL NOT NULL,
        trend_direction TEXT DEFAULT 'STABLE',
        confidence_score REAL DEFAULT 0.95,
        trend_meta TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS weather_advisories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        location_id TEXT NOT NULL,
        location_name TEXT NOT NULL,
        district TEXT NOT NULL,
        state TEXT NOT NULL,
        pincode TEXT,
        forecast_date TEXT NOT NULL,
        temp_max_c REAL NOT NULL,
        temp_min_c REAL NOT NULL,
        rain_chance_pct INTEGER DEFAULT 0,
        wind_speed_kmh REAL DEFAULT 10.0,
        condition_text TEXT DEFAULT 'Sunny',
        risk_level TEXT DEFAULT 'safe',
        spray_status TEXT DEFAULT 'SAFE',
        spray_advice TEXT,
        drying_window TEXT DEFAULT 'Optimum 10 AM - 3 PM',
        radar_synced INTEGER DEFAULT 1,
        source TEXT DEFAULT 'IMD_OPEN_METEO',
        radar_data TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS cold_storages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        facility_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        district TEXT NOT NULL,
        state TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        capacity_mt INTEGER DEFAULT 5000,
        available_mt INTEGER DEFAULT 1200,
        monthly_rent_per_qtl REAL DEFAULT 120.0,
        contact_phone TEXT,
        facility_meta TEXT,
        is_active INTEGER DEFAULT 1
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS govt_policies_and_loans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scheme_id TEXT UNIQUE NOT NULL,
        category TEXT NOT NULL,
        title_en TEXT NOT NULL,
        title_hi TEXT NOT NULL,
        title_te TEXT NOT NULL,
        benefit_amount TEXT NOT NULL,
        interest_rate TEXT,
        max_limit TEXT,
        eligibility_en TEXT NOT NULL,
        eligibility_hi TEXT NOT NULL,
        eligibility_te TEXT NOT NULL,
        short_desc_en TEXT NOT NULL,
        short_desc_hi TEXT NOT NULL,
        short_desc_te TEXT NOT NULL,
        helpline TEXT NOT NULL,
        apply_url TEXT NOT NULL,
        source_portal TEXT DEFAULT 'myscheme.gov.in / pmkisan.gov.in',
        scraped_date TEXT DEFAULT (date('now')),
        raw_criteria TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS scraper_audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_name TEXT NOT NULL,
        target_commodity TEXT,
        records_scraped INTEGER DEFAULT 0,
        records_upserted INTEGER DEFAULT 0,
        duration_seconds REAL DEFAULT 0.0,
        status TEXT DEFAULT 'SUCCESS',
        error_message TEXT,
        execution_log TEXT,
        executed_at TEXT DEFAULT (datetime('now'))
    );
    """)

    # Auto-migrate columns for existing SQLite databases
    _ensure_column(cursor, "weather_advisories", "radar_data", "TEXT")
    _ensure_column(cursor, "govt_policies_and_loans", "raw_criteria", "TEXT")
    _ensure_column(cursor, "govt_policies_and_loans", "updated_at", "TEXT")
    _ensure_column(cursor, "price_trends", "trend_meta", "TEXT")
    _ensure_column(cursor, "cold_storages", "facility_meta", "TEXT")
    _ensure_column(cursor, "scraper_audit_logs", "execution_log", "TEXT")

    cursor.execute("CREATE INDEX IF NOT EXISTS idx_policies_cat ON govt_policies_and_loans (category, is_active);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_mandi_commodity ON mandi_prices (commodity, arrival_date);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_mandi_market ON mandi_prices (market, commodity);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_mandi_state_dist ON mandi_prices (state, district, commodity);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_trend_commodity_date ON price_trends (commodity, record_date);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_weather_loc_date ON weather_advisories (location_id, forecast_date);")

    conn.close()


def init_database() -> None:
    """Global database initialisation."""
    from .connection import init_database as conn_init
    conn_init()
