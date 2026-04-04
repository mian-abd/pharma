"""Redis cache helper with JSON serialization and async support."""
import json
import logging
from typing import Any, Optional

import redis.asyncio as aioredis

from services.shared.config import settings

logger = logging.getLogger(__name__)

_pool: Optional[aioredis.ConnectionPool] = None


def get_pool() -> aioredis.ConnectionPool:
    global _pool
    if _pool is None:
        _pool = aioredis.ConnectionPool.from_url(
            settings.redis_url,
            max_connections=20,
            decode_responses=True,
        )
    return _pool


def get_client() -> aioredis.Redis:
    return aioredis.Redis(connection_pool=get_pool())


async def cache_get(key: str) -> Optional[Any]:
    """Retrieve and JSON-deserialize a cached value. Returns None on miss or error."""
    try:
        client = get_client()
        raw = await client.get(key)
        if raw is None:
            return None
        return json.loads(raw)
    except Exception as exc:
        logger.warning("Redis GET error for key=%s: %s", key, exc)
        return None


async def cache_set(key: str, data: Any, ttl: int) -> bool:
    """JSON-serialize and cache a value with the given TTL in seconds."""
    try:
        client = get_client()
        serialized = json.dumps(data, default=str)
        await client.setex(key, ttl, serialized)
        return True
    except Exception as exc:
        logger.warning("Redis SET error for key=%s: %s", key, exc)
        return False


async def cache_delete(key: str) -> bool:
    """Delete a cached key."""
    try:
        client = get_client()
        await client.delete(key)
        return True
    except Exception as exc:
        logger.warning("Redis DEL error for key=%s: %s", key, exc)
        return False


async def cache_exists(key: str) -> bool:
    """Check if a key exists in the cache."""
    try:
        client = get_client()
        return bool(await client.exists(key))
    except Exception:
        return False
