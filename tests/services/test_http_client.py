"""Unit tests for shared HTTP client with retry logic."""
import pytest
import httpx
from unittest.mock import AsyncMock, MagicMock, patch

from services.shared.http_client import fetch_with_retry


def make_response(status_code: int, json_data: dict = None, headers: dict = None):
    response = MagicMock(spec=httpx.Response)
    response.status_code = status_code
    response.headers = headers or {}
    response.json.return_value = json_data or {}
    if status_code >= 400:
        response.raise_for_status.side_effect = httpx.HTTPStatusError(
            f"HTTP {status_code}", request=MagicMock(), response=response
        )
    else:
        response.raise_for_status.return_value = None
    return response


@pytest.mark.asyncio
async def test_successful_get():
    mock_response = make_response(200, {"rxcui": "857005"})
    with patch("services.shared.http_client.get_client") as mock_ctx:
        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response
        mock_ctx.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_ctx.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await fetch_with_retry("https://example.com/api", params={"q": "test"})
        assert result == {"rxcui": "857005"}


@pytest.mark.asyncio
async def test_404_returns_none():
    mock_response = make_response(404)
    with patch("services.shared.http_client.get_client") as mock_ctx:
        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response
        mock_ctx.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_ctx.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await fetch_with_retry("https://example.com/notfound")
        assert result is None


@pytest.mark.asyncio
async def test_timeout_retries_and_raises():
    with patch("services.shared.http_client.get_client") as mock_ctx:
        mock_client = AsyncMock()
        mock_client.get.side_effect = httpx.TimeoutException("timed out")
        mock_ctx.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_ctx.return_value.__aexit__ = AsyncMock(return_value=False)

        with patch("asyncio.sleep", new_callable=AsyncMock):
            with pytest.raises(httpx.TimeoutException):
                await fetch_with_retry("https://example.com/slow", max_retries=2, base_delay=0.01)

        # Should have tried 2 times
        assert mock_client.get.call_count == 2


@pytest.mark.asyncio
async def test_500_retries():
    mock_response_500 = make_response(500)
    mock_response_200 = make_response(200, {"ok": True})

    with patch("services.shared.http_client.get_client") as mock_ctx:
        mock_client = AsyncMock()
        mock_client.get.side_effect = [
            httpx.HTTPStatusError("500", request=MagicMock(), response=mock_response_500),
            mock_response_200,
        ]
        mock_ctx.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_ctx.return_value.__aexit__ = AsyncMock(return_value=False)

        with patch("asyncio.sleep", new_callable=AsyncMock):
            result = await fetch_with_retry("https://example.com/flaky", max_retries=3, base_delay=0.01)

        assert result == {"ok": True}
