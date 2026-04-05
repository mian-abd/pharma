"""Supply chain pressure index from FDA enforcement + shortage data."""
from __future__ import annotations

import asyncio
import logging
from typing import List

from services.shared.cache import cache_get, cache_set
from services.shared.config import settings
from services.shared.http_client import fetch_with_retry

logger = logging.getLogger(__name__)

OPENFDA_BASE = settings.openfda_base_url


async def _fetch_recent_recalls(days: int = 90, limit: int = 100) -> List[dict]:
    """Fetch recent drug recalls from openFDA enforcement."""
    from datetime import date, timedelta
    cutoff = (date.today() - timedelta(days=days)).strftime("%Y%m%d")
    url = f"{OPENFDA_BASE}/drug/enforcement.json"
    try:
        data = await fetch_with_retry(
            url,
            params={
                "search": f"report_date:[{cutoff}+TO+99991231]",
                "limit": str(limit),
                "sort": "report_date:desc",
            },
            max_retries=2,
            base_delay=0.5,
            timeout_seconds=6.0,
        )
        return data.get("results", []) if data else []
    except Exception as exc:
        logger.warning("Enforcement fetch failed: %s", exc)
        return []


async def _count_active_shortages() -> int:
    """Query openFDA for recent shortage enforcement records."""
    url = f"{OPENFDA_BASE}/drug/enforcement.json"
    try:
        data = await fetch_with_retry(
            url,
            params={
                "search": "reason_for_recall:shortage",
                "count": "status.exact",
                "limit": "5",
            },
            max_retries=1,
            base_delay=0.3,
            timeout_seconds=5.0,
        )
        if data and data.get("results"):
            return sum(r.get("count", 0) for r in data["results"] if r.get("term", "").upper() == "ONGOING")
    except Exception:
        pass
    return 0


def _compute_pressure(recalls: List[dict], shortage_count: int) -> float:
    """
    Compute a 0-100 supply pressure index from recall severity and shortage count.
    Class I = 3 pts, Class II = 2 pts, Class III = 1 pt, shortage = 5 pts.
    Normalized to 100.
    """
    score = min(shortage_count * 5, 30)
    class_scores = {"Class I": 3, "Class II": 2, "Class III": 1}
    for recall in recalls[:50]:
        cls = recall.get("classification", "")
        score += class_scores.get(cls, 0)
    return min(round(score / 3, 1), 100.0)


async def get_supply_chain_status() -> dict:
    """
    Build supply chain pressure index from live FDA data.
    Returns dict suitable for the HubSupplyChain panel.
    Cached for 1 hour.
    """
    cache_key = "supply_chain:status"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    recalls, shortage_count = await asyncio.gather(
        _fetch_recent_recalls(),
        _count_active_shortages(),
        return_exceptions=True,
    )
    if isinstance(recalls, Exception):
        recalls = []
    if isinstance(shortage_count, Exception):
        shortage_count = 0

    pressure_index = _compute_pressure(recalls, shortage_count)

    # Build top affected products from recall data
    affected: List[dict] = []
    seen: set[str] = set()
    for recall in recalls[:20]:
        product = recall.get("product_description", "Unknown")[:60]
        cls = recall.get("classification", "Class III")
        reason = recall.get("reason_for_recall", "")[:120]
        date_str = recall.get("report_date", "")
        if len(date_str) == 8:
            date_str = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:]}"
        key = product[:30].lower()
        if key not in seen:
            seen.add(key)
            affected.append({
                "name": product,
                "classification": cls,
                "reason": reason,
                "date": date_str,
                "is_shortage": "shortage" in reason.lower(),
            })

    result = {
        "pressure_index": pressure_index,
        "recall_count_90d": len(recalls),
        "shortage_signals": shortage_count,
        "affected_products": affected[:10],
        "source_status": "live",
    }
    await cache_set(cache_key, result, ttl=3600)
    return result
