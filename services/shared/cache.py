"""Redis cache helper with JSON serialization and async support."""
import json
import logging
import time
from typing import Any, Optional

import redis.asyncio as aioredis

from services.shared.config import settings

logger = logging.getLogger(__name__)

_pool: Optional[aioredis.ConnectionPool] = None
_memory_store: dict[str, tuple[Optional[float], str]] = {}
_memory_recent_drugs: dict[str, tuple[float, str]] = {}
_redis_disabled_until = 0.0
_REDIS_COOLDOWN_SECONDS = 45.0


def _redis_available() -> bool:
    return time.time() >= _redis_disabled_until


def _mark_redis_unavailable(action: str, exc: Exception) -> None:
    global _pool, _redis_disabled_until
    _pool = None
    _redis_disabled_until = time.time() + _REDIS_COOLDOWN_SECONDS
    logger.warning(
        "Redis %s error: %s. Falling back to memory for %.0fs.",
        action,
        exc,
        _REDIS_COOLDOWN_SECONDS,
    )


def get_pool() -> aioredis.ConnectionPool:
    global _pool
    if _pool is None:
        _pool = aioredis.ConnectionPool.from_url(
            settings.redis_url,
            max_connections=20,
            decode_responses=True,
            socket_connect_timeout=0.25,
            socket_timeout=0.25,
            retry_on_timeout=False,
        )
    return _pool


def get_client() -> aioredis.Redis:
    return aioredis.Redis(connection_pool=get_pool())


def _memory_prune_expired(key: str) -> None:
    entry = _memory_store.get(key)
    if not entry:
        return
    expires_at, _ = entry
    if expires_at is not None and expires_at <= time.time():
        _memory_store.pop(key, None)


def _memory_get_raw(key: str) -> Optional[str]:
    _memory_prune_expired(key)
    entry = _memory_store.get(key)
    return entry[1] if entry else None


async def cache_get(key: str) -> Optional[Any]:
    """Retrieve and JSON-deserialize a cached value. Returns None on miss or error."""
    if not _redis_available():
        raw = _memory_get_raw(key)
        return json.loads(raw) if raw is not None else None
    try:
        client = get_client()
        raw = await client.get(key)
        if raw is None:
            raw = _memory_get_raw(key)
            if raw is None:
                return None
        return json.loads(raw)
    except Exception as exc:
        _mark_redis_unavailable(f"GET key={key}", exc)
        raw = _memory_get_raw(key)
        return json.loads(raw) if raw is not None else None


async def cache_set(key: str, data: Any, ttl: int) -> bool:
    """JSON-serialize and cache a value with the given TTL in seconds."""
    serialized = json.dumps(data, default=str)
    _memory_store[key] = (time.time() + ttl if ttl > 0 else None, serialized)
    if not _redis_available():
        return True
    try:
        client = get_client()
        await client.setex(key, ttl, serialized)
        return True
    except Exception as exc:
        _mark_redis_unavailable(f"SET key={key}", exc)
        return True


async def cache_delete(key: str) -> bool:
    """Delete a cached key."""
    _memory_store.pop(key, None)
    if not _redis_available():
        return True
    try:
        client = get_client()
        await client.delete(key)
        return True
    except Exception as exc:
        _mark_redis_unavailable(f"DEL key={key}", exc)
        return True


async def cache_exists(key: str) -> bool:
    """Check if a key exists in the cache."""
    if not _redis_available():
        return _memory_get_raw(key) is not None
    try:
        client = get_client()
        return bool(await client.exists(key))
    except Exception as exc:
        _mark_redis_unavailable(f"EXISTS key={key}", exc)
        return _memory_get_raw(key) is not None


async def cache_ttl(key: str) -> int:
    """Return remaining TTL in seconds for a key. -1 if no TTL, -2 if not found."""
    if not _redis_available():
        _memory_prune_expired(key)
        entry = _memory_store.get(key)
        if not entry:
            return -2
        expires_at, _ = entry
        if expires_at is None:
            return -1
        return max(0, int(expires_at - time.time()))
    try:
        client = get_client()
        return await client.ttl(key)
    except Exception as exc:
        _mark_redis_unavailable(f"TTL key={key}", exc)
        _memory_prune_expired(key)
        entry = _memory_store.get(key)
        if not entry:
            return -2
        expires_at, _ = entry
        if expires_at is None:
            return -1
        return max(0, int(expires_at - time.time()))


async def cache_track_drug(rxcui: str, drug_name: str, brand_name: str) -> bool:
    """
    Track a queried drug in a Redis sorted set (score = unix timestamp).
    Used by Celery refresh tasks to know which drugs to re-fetch.
    """
    payload = json.dumps({"rxcui": rxcui, "drug_name": drug_name, "brand_name": brand_name})
    _memory_recent_drugs[rxcui] = (time.time(), payload)
    if not _redis_available():
        return True
    try:
        client = get_client()
        await client.zadd("queried_drugs", {payload: time.time()})
        # Keep only the 500 most recently queried
        await client.zremrangebyrank("queried_drugs", 0, -501)
        return True
    except Exception as exc:
        _mark_redis_unavailable("TRACK queried_drugs", exc)
        return True


async def cache_get_recent_drugs(lookback_days: int = 30) -> list:
    """Return drugs queried within the last `lookback_days` days."""
    if not _redis_available():
        cutoff = time.time() - (lookback_days * 86400)
        items = []
        for _, (score, payload) in _memory_recent_drugs.items():
            if score < cutoff:
                continue
            try:
                items.append(json.loads(payload))
            except json.JSONDecodeError:
                continue
        return items
    try:
        client = get_client()
        cutoff = time.time() - (lookback_days * 86400)
        members = await client.zrangebyscore("queried_drugs", cutoff, "+inf")
        drugs = []
        for m in members:
            try:
                drugs.append(json.loads(m))
            except json.JSONDecodeError:
                pass
        return drugs
    except Exception as exc:
        _mark_redis_unavailable("ZRANGEBYSCORE queried_drugs", exc)
        cutoff = time.time() - (lookback_days * 86400)
        items = []
        for _, (score, payload) in _memory_recent_drugs.items():
            if score < cutoff:
                continue
            try:
                items.append(json.loads(payload))
            except json.JSONDecodeError:
                continue
        return items
