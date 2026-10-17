"""Multi-purpose Agricultural Database Package for Kisan-Sethu.

Exports:
- PostgreSQL primary connection pool with fallback SQLite support
- Database query helpers and transaction context managers
"""

from .connection import (
    get_db_cursor,
    execute_query,
    execute_mutation,
    is_postgres_active,
    init_database,
)
from .db import get_connection, db_session

__all__ = [
    "get_db_cursor",
    "execute_query",
    "execute_mutation",
    "is_postgres_active",
    "init_database",
    "get_connection",
    "db_session",
]
