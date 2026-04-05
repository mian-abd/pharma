"""Shared httpx async client factory with connection pooling, retry, and error handling."""
import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator, Dict, Optional

import httpx

logger = logging.getLogger(__name__)

# Shared limits for all clients
_DEFAULT_LIMITS = httpx.Limits(
    max_keepalive_connections=5,
    max_connections=10,
    keepalive_expiry=30.0,
)
_DEFAULT_TIMEOUT = httpx.Timeout(10.0, connect=5.0)


@asynccontextmanager
async def get_client(
    base_url: str = "",
    headers: Optional[Dict[str, str]] = None,
    timeout: Optional[httpx.Timeout | float] = None,
) -> AsyncGenerator[httpx.AsyncClient, None]:
    """Context manager yielding a configured async httpx client."""
    async with httpx.AsyncClient(
        base_url=base_url,
        headers=headers or {},
        limits=_DEFAULT_LIMITS,
        timeout=timeout or _DEFAULT_TIMEOUT,
        follow_redirects=True,
    ) as client:
        yield client


async def fetch_with_retry(
    url: str,
    params: Optional[Dict[str, Any]] = None,
    headers: Optional[Dict[str, str]] = None,
    max_retries: int = 3,
    base_delay: float = 1.0,
    timeout_seconds: Optional[float] = None,
) -> Optional[Dict[str, Any]]:
    """
    GET a URL with exponential backoff retry.

    Returns parsed JSON dict on success.
    Returns None on 404 (no data available).
    Raises httpx.HTTPStatusError for 429/500 after all retries exhausted.
    """
    last_exc: Optional[Exception] = None

    for attempt in range(max_retries):
        try:
            async with get_client(timeout=timeout_seconds or _DEFAULT_TIMEOUT) as client:
                response = await client.get(url, params=params, headers=headers)

                if response.status_code == 404:
                    logger.debug("404 for %s -- returning empty", url)
                    return None

                if response.status_code == 429:
                    retry_after = int(response.headers.get("Retry-After", base_delay * (2 ** attempt)))
                    logger.warning("Rate limited by %s, waiting %ss", url, retry_after)
                    await asyncio.sleep(retry_after)
                    continue

                response.raise_for_status()
                return response.json()

        except httpx.TimeoutException as exc:
            last_exc = exc
            delay = base_delay * (2 ** attempt)
            logger.warning("Timeout on attempt %d/%d for %s, retrying in %.1fs", attempt + 1, max_retries, url, delay)
            await asyncio.sleep(delay)

        except httpx.HTTPStatusError as exc:
            if exc.response.status_code >= 500:
                last_exc = exc
                delay = base_delay * (2 ** attempt)
                logger.warning("HTTP %d on attempt %d for %s, retrying in %.1fs", exc.response.status_code, attempt + 1, url, delay)
                await asyncio.sleep(delay)
            else:
                raise

        except httpx.RequestError as exc:
            last_exc = exc
            delay = base_delay * (2 ** attempt)
            logger.warning("Request error on attempt %d for %s: %s", attempt + 1, url, exc)
            await asyncio.sleep(delay)

    logger.error("All %d retries exhausted for %s: %s", max_retries, url, last_exc)
    if last_exc:
        raise last_exc
    raise httpx.RequestError(f"Failed after {max_retries} retries: {url}")


async def fetch_bytes_with_retry(
    url: str,
    params: Optional[Dict[str, Any]] = None,
    headers: Optional[Dict[str, str]] = None,
    max_retries: int = 2,
    base_delay: float = 0.5,
    timeout_seconds: Optional[float] = None,
) -> Optional[bytes]:
    """GET a URL and return raw bytes with the same retry semantics as JSON fetches."""
    last_exc: Optional[Exception] = None

    for attempt in range(max_retries):
        try:
            async with get_client(timeout=timeout_seconds or _DEFAULT_TIMEOUT) as client:
                response = await client.get(url, params=params, headers=headers)

                if response.status_code == 404:
                    return None

                if response.status_code == 429:
                    retry_after = int(response.headers.get("Retry-After", base_delay * (2 ** attempt)))
                    await asyncio.sleep(retry_after)
                    continue

                response.raise_for_status()
                return response.content

        except httpx.TimeoutException as exc:
            last_exc = exc
            await asyncio.sleep(base_delay * (2 ** attempt))
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code >= 500:
                last_exc = exc
                await asyncio.sleep(base_delay * (2 ** attempt))
            else:
                raise
        except httpx.RequestError as exc:
            last_exc = exc
            await asyncio.sleep(base_delay * (2 ** attempt))

    if last_exc:
        raise last_exc
    raise httpx.RequestError(f"Failed after {max_retries} retries: {url}")
