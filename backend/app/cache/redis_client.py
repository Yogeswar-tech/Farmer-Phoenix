"""Production Redis Client & Resilient In-Memory Fallback Cache.

Features:
1. Redis 7 connection pool with configurable URL (`KS_REDIS_URL`).
2. Automatic In-Memory Fallback: If Redis daemon is not running during local dev,
   gracefully falls back to a thread-safe in-memory cache without application crashes.
3. Health check monitoring and connection lifecycle management.
"""

import os
import time
import json
import logging
from typing import Any, Optional
from threading import Lock

logger = logging.getLogger("KisanSethuRedis")

try:
    from dotenv import load_dotenv
    from pathlib import Path
    _env_path = Path(__file__).resolve().parent.parent.parent / ".env"
    if _env_path.exists():
        load_dotenv(_env_path)
except Exception:
    pass


def resolve_redis_url() -> str:
    url = os.getenv("KS_REDIS_URL", os.getenv("REDIS_URL", "")).strip()
    host = os.getenv("REDIS_HOST", os.getenv("REDIS_SERVER", "")).strip()
    password = os.getenv("REDIS_PASSWORD", "").strip()
    port = os.getenv("REDIS_PORT", "6379").strip()

    if host:
        auth = f":{password}@" if password else ""
        scheme = "rediss" if "upstash.io" in host or os.getenv("REDIS_SSL", "").lower() == "true" else "redis"
        return f"{scheme}://{auth}{host}:{port}/0"

    if url:
        return url

    return "redis://localhost:6379/0"


REDIS_URL = resolve_redis_url()


class InMemoryFallbackCache:
    """Thread-safe in-memory key-value cache with TTL expiration.
    
    Used when Redis is not running so backend development and offline testing work seamlessly.
    """

    def __init__(self):
        self._store: dict[str, tuple[str, float]] = {}
        self._lock = Lock()

    def get(self, key: str) -> Optional[str]:
        with self._lock:
            item = self._store.get(key)
            if not item:
                return None
            val, expiry = item
            if expiry > 0 and time.time() > expiry:
                del self._store[key]
                return None
            return val

    def set(self, key: str, value: str, ex: Optional[int] = None) -> bool:
        with self._lock:
            expiry = time.time() + ex if ex else 0.0
            self._store[key] = (value, expiry)
            return True

    def delete(self, *keys: str) -> int:
        with self._lock:
            count = 0
            for k in keys:
                if k in self._store:
                    del self._store[k]
                    count += 1
            return count

    def keys(self, pattern: str = "*") -> list[str]:
        with self._lock:
            prefix = pattern.replace("*", "")
            now = time.time()
            valid = []
            for k, (v, exp) in list(self._store.items()):
                if exp > 0 and now > exp:
                    del self._store[k]
                elif k.startswith(prefix):
                    valid.append(k)
            return valid

    def ping(self) -> bool:
        return True


class RedisClientWrapper:
    """Singleton wrapper providing unified access to Redis or Fallback cache."""

    def __init__(self):
        self._client: Any = None
        self._is_redis_connected: bool = False
        self._fallback: InMemoryFallbackCache = InMemoryFallbackCache()
        self._initialize()

    def _initialize(self):
        try:
            import redis
            pool = redis.ConnectionPool.from_url(
                REDIS_URL,
                decode_responses=True,
                socket_timeout=2.0,
                socket_connect_timeout=2.0,
                max_connections=20
            )
            client = redis.Redis(connection_pool=pool)
            client.ping()
            self._client = client
            self._is_redis_connected = True
            logger.info("Connected to Redis cache server at: %s", REDIS_URL)
        except Exception as e:
            self._client = self._fallback
            self._is_redis_connected = False
            logger.warning(
                "Redis server offline or unavailable (%s). Falling back to resilient in-memory cache.",
                e
            )

    @property
    def is_connected(self) -> bool:
        return self._is_redis_connected

    def get(self, key: str) -> Optional[str]:
        try:
            return self._client.get(key)
        except Exception as e:
            logger.debug("Redis get error for key '%s': %s", key, e)
            return self._fallback.get(key)

    def set(self, key: str, value: str, ex: Optional[int] = None) -> bool:
        try:
            return bool(self._client.set(key, value, ex=ex))
        except Exception as e:
            logger.debug("Redis set error for key '%s': %s", key, e)
            return self._fallback.set(key, value, ex=ex)

    def delete(self, *keys: str) -> int:
        try:
            return int(self._client.delete(*keys))
        except Exception:
            return self._fallback.delete(*keys)

    def keys(self, pattern: str = "*") -> list[str]:
        try:
            return list(self._client.keys(pattern))
        except Exception:
            return self._fallback.keys(pattern)

    def ping(self) -> bool:
        try:
            return bool(self._client.ping())
        except Exception:
            return False


# Global singleton instance
redis_client = RedisClientWrapper()


def get_redis_client() -> RedisClientWrapper:
    """Return the global Redis client wrapper."""
    return redis_client
