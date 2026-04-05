"""FDA Drug Shortage detection via openFDA enforcement + label data."""
import logging
from typing import Optional

from services.shared.cache import cache_get, cache_set
from services.shared.config import settings
from services.shared.http_client import fetch_with_retry
from services.shared.panel_models import ShortageStatus

logger = logging.getLogger(__name__)


async def get_shortage_status(rxcui: str, drug_name: str) -> ShortageStatus:
    """
    Check if a drug is currently in shortage via openFDA enforcement data.
    Cached for 1 hour.
    """
    cache_key = f"drug:{rxcui}:shortage"
    cached = await cache_get(cache_key)
    if cached is not None:
        return ShortageStatus(**cached)

    status = await _check_shortage(rxcui, drug_name)
    await cache_set(cache_key, status.model_dump(), ttl=settings.ttl_shortage)
    return status


async def _check_shortage(rxcui: str, drug_name: str) -> ShortageStatus:
    """Query the dedicated shortage endpoint, then fall back to enforcement."""
    data = await fetch_with_retry(
        settings.fda_shortage_url,
        params={"search": f'generic_name:"{drug_name}" OR brand_name:"{drug_name}"', "limit": "3"},
        max_retries=1,
        base_delay=0.3,
        timeout_seconds=3.0,
    )
    if data and data.get("results"):
        item = data["results"][0]
        status_text = str(item.get("status", "")).lower()
        is_active = any(term in status_text for term in ("active", "current", "ongoing"))
        return ShortageStatus(
            drug_name=drug_name,
            status="active" if is_active else "resolved",
            reason=item.get("shortage_reason") or item.get("reason", ""),
            resolution_date=item.get("end_date"),
            source_url=item.get("url"),
        )

    url = f"{settings.openfda_base_url}/drug/enforcement.json"
    params = {
        "search": f'(openfda.rxcui:"{rxcui}"+OR+product_description:"{drug_name}")+AND+reason_for_recall:shortage',
        "limit": "3",
        "sort": "report_date:desc",
    }
    data = await fetch_with_retry(url, params=params, max_retries=1, base_delay=0.3, timeout_seconds=3.0)

    if not data:
        return ShortageStatus(drug_name=drug_name, status="none", reason=None, resolution_date=None, source_url=None)

    results = data.get("results", [])
    if not results:
        return ShortageStatus(drug_name=drug_name, status="none", reason=None, resolution_date=None, source_url=None)

    # Take most recent shortage record
    item = results[0]
    status_str = item.get("status", "").lower()
    is_active = status_str in ("ongoing", "open", "")

    return ShortageStatus(
        drug_name=drug_name,
        status="active" if is_active else "resolved",
        reason=item.get("reason_for_recall", ""),
        resolution_date=None,
        source_url=None,
    )
