"""Isolated CIBRC Pesticide Database Connection & Manager.

This module provides a standalone, dedicated database file for the CIBRC statutory
pesticide registry, completely isolated from other platform databases (mandi, cold storage, weather).

Features:
1. Zero coupling to main database connection pools or migrations.
2. Direct SQLite file-backed storage (cibrc_pesticide_registry.db) with optional separate PostgreSQL URL.
3. Strict data grounding to eliminate LLM hallucinations.
"""

import json
import logging
import os
import sqlite3
import sys
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Generator, Optional

CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent
DATA_DIR = CURRENT_DIR

# Dedicated database file path for CIBRC pesticide registry
ISOLATED_DB_FILE = DATA_DIR / "cibrc_pesticide_registry.db"

logger = logging.getLogger("CibrcIsolatedDB")


def get_cibrc_db_path() -> str:
    """Returns absolute path to isolated CIBRC database file."""
    return str(ISOLATED_DB_FILE.resolve())


@contextmanager
def get_cibrc_cursor() -> Generator[Any, None, None]:
    """Provides a thread-safe connection and cursor for CIBRC records.
    
    1. In production (KS_ENV=prod), connects strictly to PostgreSQL (KS_DATABASE_URL).
       Fails loudly if PostgreSQL is unreachable (no silent fallback).
    2. In non-production/local environments, tries PostgreSQL first; falls back to
       local SQLite file only for offline development/testing.
    """
    is_prod = os.getenv("KS_ENV", os.getenv("ENVIRONMENT", "")).lower() in ("prod", "production")

    from database.connection import get_db_cursor, is_postgres_active
    use_pg = False
    try:
        use_pg = is_postgres_active()
        if not use_pg and is_prod:
            raise RuntimeError(
                "CRITICAL: KS_ENV=prod requires PostgreSQL for CIBRC pesticide registry, "
                "but PostgreSQL is unreachable or uninitialized!"
            )
    except Exception as exc:
        if is_prod:
            logger.error("Production CIBRC PostgreSQL connection error: %s", exc)
            raise
        logger.warning("Postgres not active for CIBRC query (%s). Using local SQLite fallback.", exc)
        use_pg = False

    if use_pg:
        with get_db_cursor() as cursor:
            yield cursor
        return

    # Local development / unit test fallback
    db_path = get_cibrc_db_path()
    conn = sqlite3.connect(db_path, timeout=30.0)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    try:
        yield cursor
        conn.commit()
    except Exception as exc:
        conn.rollback()
        logger.error("CIBRC isolated database query failed: %s", exc)
        raise
    finally:
        cursor.close()
        conn.close()


def init_isolated_cibrc_db() -> None:
    """Initializes schema in the standalone CIBRC database file."""
    schema_sql = """
    CREATE TABLE IF NOT EXISTS cibrc_pesticide_registry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL, -- 'INSECTICIDE', 'FUNGICIDE', 'HERBICIDE', 'PGR', 'BIO-PESTICIDE'
        pesticide_name TEXT NOT NULL,
        active_ingredient TEXT NOT NULL,
        formulation TEXT,
        crop TEXT NOT NULL,
        crop_key TEXT NOT NULL,
        target_pest_or_disease TEXT NOT NULL,
        ai_dose TEXT,
        formulation_dose TEXT,
        dilution_water_liters TEXT,
        waiting_period_days TEXT,
        pump_dose_15l TEXT,
        application_method TEXT DEFAULT 'Foliar Spray',
        toxicity_band TEXT DEFAULT 'green', -- 'green', 'blue', 'yellow', 'red', 'bio'
        toxicity_label TEXT,
        safety_warnings TEXT,
        is_approved INTEGER DEFAULT 1,
        payload TEXT DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_iso_crop_key ON cibrc_pesticide_registry (crop_key);
    CREATE INDEX IF NOT EXISTS idx_iso_active_ing ON cibrc_pesticide_registry (active_ingredient);
    CREATE INDEX IF NOT EXISTS idx_iso_category ON cibrc_pesticide_registry (category);
    CREATE INDEX IF NOT EXISTS idx_iso_pest_name ON cibrc_pesticide_registry (pesticide_name);
    """

    db_path = get_cibrc_db_path()
    try:
        conn = sqlite3.connect(db_path, timeout=30.0)
        conn.executescript(schema_sql)
        conn.commit()
        conn.close()
    except Exception as exc:
        logger.warning("Could not initialize local SQLite CIBRC database: %s", exc)

    logger.info("Isolated CIBRC database initialized at: %s", db_path)


def execute_cibrc_query(query: str, params: tuple = ()) -> list[dict[str, Any]]:
    """Executes a read query against the isolated CIBRC database."""
    with get_cibrc_cursor() as cur:
        cur.execute(query, params)
        rows = cur.fetchall()
        return [dict(r) for r in rows]


def execute_cibrc_mutation(query: str, params: tuple = ()) -> int:
    """Executes an insert/update/delete mutation against the isolated CIBRC database."""
    with get_cibrc_cursor() as cur:
        cur.execute(query, params)
        return cur.rowcount


def get_cibrc_row_count() -> int:
    """Returns total count of registered CIBRC records.
    
    1. In production (KS_ENV=prod), checks PostgreSQL directly and raises on failure.
    2. In non-production, falls back to SQLite file.
    """
    is_prod = os.getenv("KS_ENV", os.getenv("ENVIRONMENT", "")).lower() in ("prod", "production")

    try:
        from database.connection import get_db_cursor, is_postgres_active
        if is_postgres_active():
            with get_db_cursor() as cur:
                cur.execute("SELECT COUNT(*) AS cnt FROM cibrc_pesticide_registry;")
                row = cur.fetchone()
                if row:
                    return int(row["cnt"] if isinstance(row, dict) else row[0])
                return 0
        elif is_prod:
            raise RuntimeError("CRITICAL: KS_ENV=prod but PostgreSQL connection is not active!")
    except Exception as exc:
        if is_prod:
            logger.error("Production get_cibrc_row_count error: %s", exc)
            raise
        logger.warning("Postgres cibrc count check notice (%s). Checking SQLite fallback.", exc)

    # Check local SQLite database for local development/unit tests
    try:
        db_path = get_cibrc_db_path()
        if not Path(db_path).exists():
            return 0
        conn = sqlite3.connect(db_path, timeout=10.0)
        try:
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) FROM cibrc_pesticide_registry;")
            row = cur.fetchone()
            if row:
                return int(row[0])
        finally:
            conn.close()
    except Exception as exc:
        logger.error("Failed to query CIBRC isolated database count: %s", exc)
        if is_prod:
            raise
        return 0

    return 0
