"""Production-grade Database Connection Manager for Kisan-Sethu.

Supports:
1. PostgreSQL 16+ as primary database (Connection Pooling, JSONB, Unstructured payloads, pgvector).
2. Intelligent Resilient Fallback: If PostgreSQL is temporarily unreachable or offline during local dev,
   gracefully falls back to local SQLite with schema compatibility, logging clear diagnostics.
"""

import os
import sys
import json
import logging
from pathlib import Path
from typing import Any, Generator
from contextlib import contextmanager

logger = logging.getLogger("KisanSethuDB")

CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent
LOCAL_DB_PATH = CURRENT_DIR / "kisan_sethu.db"

try:
    from dotenv import load_dotenv
    _env_path = PROJECT_ROOT / "backend" / ".env"
    if _env_path.exists():
        load_dotenv(_env_path, override=True)
except Exception as _e:
    logger.debug("dotenv load error: %s", _e)


def resolve_postgres_url() -> str:
    """Resolves PostgreSQL connection string from either KS_DATABASE_URL or discrete fields."""
    url = os.getenv("KS_DATABASE_URL", os.getenv("DATABASE_URL", "")).strip()

    # Check if discrete parameters are provided
    server = os.getenv("POSTGRES_SERVER", os.getenv("POSTGRES_HOST", "")).strip()
    user = os.getenv("POSTGRES_USER", "").strip()
    password = os.getenv("POSTGRES_PASSWORD", "").strip()
    db = os.getenv("POSTGRES_DB", "").strip()
    port = os.getenv("POSTGRES_PORT", "5432").strip()

    if server and user and db:
        auth = f"{user}:{password}" if password else user
        ssl = "?sslmode=require" if ("neon.tech" in server or "supabase" in server or os.getenv("POSTGRES_SSL", "").lower() == "true") else ""
        constructed = f"postgresql://{auth}@{server}:{port}/{db}{ssl}"
        return constructed

    if url:
        return url

    return "postgresql://postgres:postgres@localhost:5432/kisan_sethu"


# PostgreSQL Configuration
PG_DATABASE_URL = resolve_postgres_url()

# Global pool handles
_PG_POOL: Any = None
_USING_POSTGRES: bool = False


def _init_pg_pool():
    global _PG_POOL, _USING_POSTGRES
    try:
        import psycopg2
        from psycopg2.pool import ThreadedConnectionPool
        from psycopg2.extras import RealDictCursor

        logger.info("Connecting to PostgreSQL at: %s", PG_DATABASE_URL.split("@")[-1])
        _PG_POOL = ThreadedConnectionPool(
            minconn=1,
            maxconn=20,
            dsn=PG_DATABASE_URL,
            cursor_factory=RealDictCursor
        )
        # Test connection
        conn = _PG_POOL.getconn()
        with conn.cursor() as cur:
            cur.execute("SELECT 1;")
        _PG_POOL.putconn(conn)
        _USING_POSTGRES = True
        logger.info("Successfully established PostgreSQL connection pool.")
    except Exception as e:
        _USING_POSTGRES = False
        _PG_POOL = None
        logger.warning(
            "PostgreSQL is offline or unavailable (%s). Falling back to resilient SQLite database at %s.",
            str(e),
            LOCAL_DB_PATH
        )


# Initialize on import
_init_pg_pool()


def is_postgres_active() -> bool:
    """Check if PostgreSQL is the active database engine."""
    return _USING_POSTGRES


@contextmanager
def get_db_cursor() -> Generator[Any, None, None]:
    """Context manager yielding a thread-safe database cursor with dict-like row access.
    
    Automatically commits on success and rolls back on exception.
    Works transparently whether backed by PostgreSQL or fallback SQLite.
    """
    global _USING_POSTGRES, _PG_POOL

    if _USING_POSTGRES and _PG_POOL:
        conn = None
        try:
            conn = _PG_POOL.getconn()
            with conn.cursor() as cursor:
                yield cursor
            conn.commit()
        except Exception:
            if conn:
                conn.rollback()
            raise
        finally:
            if conn:
                _PG_POOL.putconn(conn)
    else:
        # SQLite fallback
        import sqlite3
        conn = sqlite3.connect(
            str(LOCAL_DB_PATH),
            check_same_thread=False,
            timeout=30.0
        )
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        try:
            yield cursor
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()


def execute_query(query: str, params: tuple | list | None = None) -> list[dict[str, Any]]:
    """Execute a read query and return results as a list of dictionaries."""
    params = params or ()
    with get_db_cursor() as cur:
        # Convert %s placeholders to ? if using SQLite
        if not _USING_POSTGRES:
            query = query.replace("%s", "?")
        cur.execute(query, params)
        rows = cur.fetchall()
        if not rows:
            return []
        # PostgreSQL RealDictCursor returns dicts; SQLite Row requires dict(r)
        return [dict(r) for r in rows]


def execute_mutation(query: str, params: tuple | list | None = None) -> int:
    """Execute an INSERT/UPDATE/DELETE mutation and return affected row count."""
    params = params or ()
    with get_db_cursor() as cur:
        if not _USING_POSTGRES:
            query = query.replace("%s", "?")
        cur.execute(query, params)
        return cur.rowcount if hasattr(cur, "rowcount") else 1


def init_database() -> None:
    """Initialize database tables using schema.sql as single source of truth."""
    schema_file = CURRENT_DIR / "schema.sql"
    seed_file = CURRENT_DIR / "seed.sql"

    if _USING_POSTGRES and schema_file.exists():
        try:
            with open(schema_file, "r", encoding="utf-8") as f:
                schema_sql = f.read()
            with get_db_cursor() as cur:
                cur.execute(schema_sql)
                try:
                    cur.execute("ALTER TABLE farmer_profiles ADD COLUMN IF NOT EXISTS firebase_uid VARCHAR(128);")
                    cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_farmer_profiles_uid ON farmer_profiles (firebase_uid);")
                    try:
                        cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
                        cur.execute("ALTER TABLE cibrc_pesticide_registry ADD COLUMN IF NOT EXISTS embedding vector(768);")
                    except Exception:
                        cur.execute("ALTER TABLE cibrc_pesticide_registry ADD COLUMN IF NOT EXISTS embedding text;")
                except Exception:
                    pass
            logger.info("PostgreSQL schema successfully initialized from schema.sql.")

            if seed_file.exists():
                with open(seed_file, "r", encoding="utf-8") as f:
                    seed_sql = f.read()
                with get_db_cursor() as cur:
                    cur.execute(seed_sql)
                logger.info("PostgreSQL seed data successfully applied.")
            return
        except Exception as e:
            logger.error("Failed to run PostgreSQL schema.sql/seed.sql: %s", e)

    # Initialize all SQLite tables (including price_alerts and farmer_profiles with firebase_uid)
    from .db import init_sqlite_tables
    init_sqlite_tables()
    logger.info("SQLite schema successfully initialized.")
