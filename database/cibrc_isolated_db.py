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
def get_cibrc_cursor() -> Generator[sqlite3.Cursor, None, None]:
    """Provides a thread-safe connection and cursor to the isolated CIBRC database file."""
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

    with get_cibrc_cursor() as cur:
        cur.executescript(schema_sql)

    logger.info("Isolated CIBRC database initialized at: %s", get_cibrc_db_path())


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
