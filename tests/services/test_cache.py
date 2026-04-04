"""Unit tests for cache helper -- mocking Redis to avoid live connection."""
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from services.shared.cache import cache_get, cache_set, cache_delete, cache_exists


@pytest.fixture
def mock_redis():
    with patch("services.shared.cache.get_client") as mock_factory:
        client = AsyncMock()
        mock_factory.return_value = client
        yield client


@pytest.mark.asyncio
async def test_cache_get_hit(mock_redis):
    mock_redis.get.return_value = json.dumps({"drug": "ozempic"})
    result = await cache_get("test:key")
    assert result == {"drug": "ozempic"}
    mock_redis.get.assert_called_once_with("test:key")


@pytest.mark.asyncio
async def test_cache_get_miss(mock_redis):
    mock_redis.get.return_value = None
    result = await cache_get("missing:key")
    assert result is None


@pytest.mark.asyncio
async def test_cache_get_returns_none_on_error(mock_redis):
    mock_redis.get.side_effect = Exception("Redis down")
    result = await cache_get("bad:key")
    assert result is None


@pytest.mark.asyncio
async def test_cache_set_success(mock_redis):
    mock_redis.setex.return_value = True
    result = await cache_set("test:key", {"value": 42}, ttl=3600)
    assert result is True
    mock_redis.setex.assert_called_once()
    args = mock_redis.setex.call_args[0]
    assert args[0] == "test:key"
    assert args[1] == 3600
    assert json.loads(args[2]) == {"value": 42}


@pytest.mark.asyncio
async def test_cache_set_returns_false_on_error(mock_redis):
    mock_redis.setex.side_effect = Exception("connection refused")
    result = await cache_set("key", {}, ttl=60)
    assert result is False


@pytest.mark.asyncio
async def test_cache_delete(mock_redis):
    mock_redis.delete.return_value = 1
    result = await cache_delete("some:key")
    assert result is True
    mock_redis.delete.assert_called_once_with("some:key")


@pytest.mark.asyncio
async def test_cache_exists_true(mock_redis):
    mock_redis.exists.return_value = 1
    assert await cache_exists("existing:key") is True


@pytest.mark.asyncio
async def test_cache_exists_false(mock_redis):
    mock_redis.exists.return_value = 0
    assert await cache_exists("nonexistent:key") is False
