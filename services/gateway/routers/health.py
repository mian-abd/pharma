"""Health check router -- GET /api/health."""
import asyncio
import logging
from typing import Dict

from fastapi import APIRouter

from services.shared.config import settings
from services.shared.http_client import fetch_with_retry

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])

_API_CHECKS = {
    "rxnorm": f"{settings.rxnorm_base_url}/REST/version.json",
    "openfda": f"{settings.openfda_base_url}/drug/event.json?limit=1",
    "clinicaltrials": f"{settings.clinicaltrials_base_url}/version",
}


async def _check_api(name: str, url: str) -> tuple[str, str]:
    """Ping a single external API. Returns (name, status)."""
    try:
        result = await fetch_with_retry(url, max_retries=1)
        return name, "live" if result is not None else "degraded"
    except Exception as exc:
        logger.warning("Health check failed for %s: %s", name, exc)
        return name, "down"


@router.get("/health")
async def health_check() -> Dict[str, object]:
    """
    Ping all configured external APIs and return their status.
    Returns overall status as 'ok', 'degraded', or 'down'.
    """
    checks = await asyncio.gather(
        *[_check_api(name, url) for name, url in _API_CHECKS.items()],
        return_exceptions=True,
    )

    api_statuses: Dict[str, str] = {}
    for result in checks:
        if isinstance(result, Exception):
            logger.error("Health check exception: %s", result)
        else:
            name, status = result
            api_statuses[name] = status

    all_live = all(s == "live" for s in api_statuses.values())
    any_down = any(s == "down" for s in api_statuses.values())

    if all_live:
        overall = "ok"
    elif any_down:
        overall = "degraded"
    else:
        overall = "degraded"

    return {
        "status": overall,
        "apis": api_statuses,
        "version": "1.0.0",
    }
