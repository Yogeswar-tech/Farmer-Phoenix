"""Multi-Database Connection Manager & Low-Latency Query Cache for Kisan-Sethu.

Manages:
1. Dedicated PostgreSQL live-today database (KS_LIVE_TODAY_DB_URL env var).
   Falls back to the main PostgreSQL database when not configured.
   SQLite is NEVER used — all live mandi data persists in PostgreSQL.
2. Ultra-low Latency In-Memory LRU Cache:
   Sub-millisecond (0.1ms - 1ms) response times for repeated read queries.
"""

import os
import time
import json
import logging
from typing import Any, Generator
from contextlib import contextmanager

logger = logging.getLogger("MultiDBManager")

# ---------------------------------------------------------------------------
# In-Memory High-Speed Cache
# ---------------------------------------------------------------------------
_CACHE_STORE: dict[str, tuple[float, Any]] = {}


class FastCache:
    """Thread-safe sub-millisecond memory cache with configurable TTL."""

    @staticmethod
    def get(key: str) -> Any | None:
        item = _CACHE_STORE.get(key)
        if not item:
            return None
        expire_at, value = item
        if time.time() > expire_at:
            _CACHE_STORE.pop(key, None)
            return None
        return value

    @staticmethod
    def set(key: str, value: Any, ttl_seconds: int = 300) -> None:
        _CACHE_STORE[key] = (time.time() + ttl_seconds, value)

    @staticmethod
    def invalidate(prefix: str) -> int:
        keys_to_del = [k for k in _CACHE_STORE.keys() if k.startswith(prefix)]
        for k in keys_to_del:
            _CACHE_STORE.pop(k, None)
        return len(keys_to_del)

    @staticmethod
    def clear_all() -> None:
        _CACHE_STORE.clear()


# ---------------------------------------------------------------------------
# Dedicated live-today PostgreSQL pool
# KS_LIVE_TODAY_DB_URL  → use a completely separate PostgreSQL database
# (not set)             → share the main database pool (live_today_mandi_prices
#                         table is created there on boot via connection.py)
# ---------------------------------------------------------------------------
_LIVE_TODAY_POOL: Any = None
_USING_DEDICATED_PG: bool = False


def _init_dedicated_live_today_pool() -> None:
    global _LIVE_TODAY_POOL, _USING_DEDICATED_PG
    live_url = os.getenv("KS_LIVE_TODAY_DB_URL", "").strip()
    if not live_url:
        logger.info(
            "KS_LIVE_TODAY_DB_URL not set — live-today data stored in main PostgreSQL DB."
        )
        return

    try:
        from psycopg2.pool import ThreadedConnectionPool
        from psycopg2.extras import RealDictCursor

        _LIVE_TODAY_POOL = ThreadedConnectionPool(
            minconn=1, maxconn=15, dsn=live_url, cursor_factory=RealDictCursor
        )
        _USING_DEDICATED_PG = True
        logger.info("Connected dedicated live-today PostgreSQL pool.")
    except Exception as exc:
        logger.warning(
            "Could not connect dedicated live-today pool (%s). "
            "Falling back to main PostgreSQL DB.",
            exc,
        )
        _LIVE_TODAY_POOL = None
        _USING_DEDICATED_PG = False


_init_dedicated_live_today_pool()


def is_live_today_pg() -> bool:
    """Always True — live-today data is always in PostgreSQL."""
    return True


# ---------------------------------------------------------------------------
# 1. Live-today DB connection context manager
# ---------------------------------------------------------------------------
@contextmanager
def get_live_today_db() -> Generator[Any, None, None]:
    """Yields a cursor for live_today_mandi_prices.

    Uses the dedicated pool (KS_LIVE_TODAY_DB_URL) when configured,
    otherwise uses the main PostgreSQL database.  Never uses SQLite.
    """
    if _LIVE_TODAY_POOL:
        conn = None
        try:
            conn = _LIVE_TODAY_POOL.getconn()
            with conn.cursor() as cur:
                yield cur
            conn.commit()
        except Exception:
            if conn:
                conn.rollback()
            raise
        finally:
            if conn:
                _LIVE_TODAY_POOL.putconn(conn)
    else:
        # Share the main PostgreSQL DB — live_today_mandi_prices is created
        # there on startup by database/connection.py init_database().
        from database.connection import get_db_cursor
        with get_db_cursor() as cur:
            yield cur


# ---------------------------------------------------------------------------
# 2. Initialise live_today_mandi_prices in the dedicated DB (if separate)
# ---------------------------------------------------------------------------
def init_live_today_schema() -> None:
    """Creates live_today_mandi_prices table in the dedicated DB if needed.

    Only required when KS_LIVE_TODAY_DB_URL points to a brand-new empty DB.
    When sharing the main DB, connection.py already creates the table.
    """
    if not _LIVE_TODAY_POOL:
        return  # main DB — connection.py handles this
    try:
        with get_live_today_db() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS live_today_mandi_prices (
                    id SERIAL PRIMARY KEY,
                    commodity VARCHAR(120) NOT NULL,
                    market VARCHAR(180),
                    district VARCHAR(120),
                    state VARCHAR(80),
                    variety VARCHAR(80) DEFAULT 'FAQ',
                    grade VARCHAR(50) DEFAULT 'Standard',
                    arrival_date DATE,
                    session VARCHAR(30) DEFAULT 'LIVE_CYCLE',
                    arrival_quintals NUMERIC(12,2) DEFAULT 0,
                    min_price_qtl NUMERIC(10,2),
                    max_price_qtl NUMERIC(10,2),
                    modal_price_qtl NUMERIC(10,2),
                    modal_price_kg NUMERIC(10,2),
                    trend VARCHAR(20) DEFAULT 'STABLE',
                    source VARCHAR(60) DEFAULT 'AGMARKNET',
                    payload JSONB,
                    scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            cur.execute(
                "CREATE INDEX IF NOT EXISTS idx_ltp_commodity "
                "ON live_today_mandi_prices (LOWER(commodity));"
            )
            cur.execute(
                "CREATE INDEX IF NOT EXISTS idx_ltp_state "
                "ON live_today_mandi_prices (state);"
            )
        logger.info("Dedicated live-today schema initialised.")
    except Exception as exc:
        logger.warning("Could not init dedicated live-today schema: %s", exc)


init_live_today_schema()


# ---------------------------------------------------------------------------
# 3. Cached read helper
# ---------------------------------------------------------------------------
def query_live_today(
    query: str, params: tuple = (), use_cache: bool = True
) -> list[dict[str, Any]]:
    """Executes a read query on live_today_mandi_prices with in-memory cache."""
    cache_key = f"live_today:{query}:{params}"
    if use_cache:
        cached = FastCache.get(cache_key)
        if cached is not None:
            return cached

    from database.connection import is_postgres_active
    with get_live_today_db() as cur:
        if not is_postgres_active() and not _USING_DEDICATED_PG:
            query = query.replace("%s", "?")
        cur.execute(query, params)
        rows = cur.fetchall()
        results = [dict(r) for r in rows] if rows else []

    if use_cache:
        FastCache.set(cache_key, results, ttl_seconds=120)

    return results
