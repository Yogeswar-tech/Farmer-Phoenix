"""High-Level Cache Service and Decorators for Kisan-Sethu.

Provides:
- JSON-aware caching (`get_json`, `set_json`)
- Pattern-based cache invalidation (`invalidate_pattern("mandi:*")`)
- `@cached` route decorator for FastAPI endpoints with smart cache key generation.
"""

import functools
import json
import logging
from collections.abc import Callable
from typing import Any

from app.cache.redis_client import get_redis_client

logger = logging.getLogger("CacheService")


class CacheService:
    """High-level caching service managing data serialization and TTLs."""

    def __init__(self) -> None:
        self.client = get_redis_client()

    def get_json(self, key: str) -> Any | None:
        """Fetch and deserialize JSON from cache. Returns None on cache miss."""
        raw = self.client.get(key)
        if not raw:
            return None
        try:
            return json.loads(raw)
        except Exception as e:
            logger.warning("Failed to decode JSON from cache key '%s': %s", key, e)
            return None

    def set_json(self, key: str, value: Any, ttl_seconds: int = 3600) -> bool:
        """Serialize data to JSON and store in cache with TTL."""
        try:
            payload = json.dumps(value, default=str)
            return self.client.set(key, payload, ex=ttl_seconds)
        except Exception as e:
            logger.warning("Failed to write to cache key '%s': %s", key, e)
            return False

    def delete(self, key: str) -> bool:
        """Delete a single key from cache."""
        return bool(self.client.delete(key))

    def invalidate_pattern(self, pattern: str) -> int:
        """Invalidate all keys matching a pattern (e.g. 'mandi:*', 'weather:*')."""
        try:
            keys = self.client.keys(pattern)
            if not keys:
                return 0
            count = self.client.delete(*keys)
            logger.info("Invalidated %d cache keys matching pattern '%s'", count, pattern)
            return count
        except Exception as e:
            logger.warning("Failed to invalidate cache pattern '%s': %s", pattern, e)
            return 0

    def health(self) -> dict[str, Any]:
        """Return cache health status."""
        return {
            "is_redis": self.client.is_connected,
            "engine": "Redis 7 Server" if self.client.is_connected else "In-Memory LRU Fallback",
            "status": "healthy" if self.client.ping() else "degraded"
        }


# Global singleton instance
cache_service = CacheService()


def cached(prefix: str, ttl_seconds: int = 900) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """Decorator to cache API response in Redis with TTL.
    
    Generates deterministic cache key from route prefix and function keyword arguments.
    Adds `_cached: True` metadata to response dictionary.
    """
    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            # Build deterministic cache key from parameters
            sorted_args = "_".join(f"{k}={v}" for k, v in sorted(kwargs.items()) if v is not None)
            cache_key = f"{prefix}:{sorted_args}" if sorted_args else prefix

            cached_data = cache_service.get_json(cache_key)
            if cached_data is not None:
                if isinstance(cached_data, dict):
                    cached_data["_cached"] = True
                    cached_data["_cache_engine"] = "redis" if cache_service.client.is_connected else "memory"
                return cached_data

            # Cache miss: execute underlying function
            result = func(*args, **kwargs)

            # Store in cache
            if result is not None:
                cache_service.set_json(cache_key, result, ttl_seconds=ttl_seconds)

            if isinstance(result, dict):
                result["_cached"] = False
                result["_cache_engine"] = "redis" if cache_service.client.is_connected else "memory"
            return result

        return wrapper
    return decorator
