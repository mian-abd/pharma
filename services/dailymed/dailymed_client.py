"""DailyMed v2 API client -- SPL label history and black box warning detection."""
import logging
from typing import List, Optional

from services.shared.cache import cache_get, cache_set
from services.shared.config import settings
from services.shared.http_client import fetch_with_retry
from services.shared.panel_models import LabelHistoryItem

logger = logging.getLogger(__name__)

DAILYMED_BASE = settings.dailymed_base_url


async def get_label_history(rxcui: str, drug_name: str) -> List[LabelHistoryItem]:
    """
    Fetch SPL label version history for a drug via DailyMed.

    Strategy: resolve RXCUI -> setid via DailyMed's /spls endpoint, then
    fetch /spls/{setid}/history. Cached 24 hours.
    """
    cache_key = f"drug:{rxcui}:label_history"
    cached = await cache_get(cache_key)
    if cached is not None:
        return [LabelHistoryItem(**item) for item in cached]

    setid = await _resolve_setid(rxcui, drug_name)
    if not setid:
        await cache_set(cache_key, [], ttl=settings.ttl_label_history)
        return []

    history = await _fetch_history(setid)
    await cache_set(cache_key, [h.model_dump() for h in history], ttl=settings.ttl_label_history)
    return history


async def get_label_metadata(rxcui: str, drug_name: str) -> dict:
    """
    Return label metadata: update count, last updated date, black box presence.
    Cached as part of label history.
    """
    history = await get_label_history(rxcui, drug_name)
    label_info = await _fetch_label_info(rxcui)

    return {
        "update_count": len(history),
        "last_updated": history[0].published_date if history else None,
        "has_black_box": label_info.get("has_black_box", False),
        "indication": label_info.get("indication", ""),
        "manufacturer": label_info.get("manufacturer", ""),
        "approval_date": label_info.get("approval_date", None),
    }


async def _resolve_setid(rxcui: str, drug_name: str) -> Optional[str]:
    """Resolve a drug RXCUI to a DailyMed SET ID via /spls endpoint."""
    url = f"{DAILYMED_BASE}/spls.json"
    params = {"rxcui": rxcui, "pagesize": "1"}
    data = await fetch_with_retry(url, params=params, max_retries=1, base_delay=0.2, timeout_seconds=4.0)

    if data:
        spls = data.get("data", [])
        if spls and isinstance(spls, list) and spls[0].get("setid"):
            return spls[0]["setid"]

    # Fallback: search by drug name
    params = {"drug_name": drug_name, "pagesize": "1"}
    data = await fetch_with_retry(url, params=params, max_retries=1, base_delay=0.2, timeout_seconds=4.0)
    if data:
        spls = data.get("data", [])
        if spls and isinstance(spls, list) and spls[0].get("setid"):
            return spls[0]["setid"]

    return None


async def _fetch_history(setid: str) -> List[LabelHistoryItem]:
    """Fetch version history for a given SPL SET ID."""
    url = f"{DAILYMED_BASE}/spls/{setid}/history.json"
    data = await fetch_with_retry(url)
    if not data:
        return []

    items: List[LabelHistoryItem] = []
    history_entries = data.get("data", {}).get("history", [])
    for i, entry in enumerate(history_entries):
        version = int(entry.get("spl_version", 0))
        published = entry.get("published_date", "")
        change_type = _classify_version(version, len(history_entries))
        items.append(LabelHistoryItem(
            version=version,
            published_date=published,
            change_type=change_type,
            description=f"Label version {version} published {published}",
        ))

    # Sort descending by version
    items.sort(key=lambda x: x.version, reverse=True)
    return items


async def _fetch_label_info(rxcui: str) -> dict:
    """Fetch label info from openFDA for indication, manufacturer, approval."""
    try:
        from services.shared.http_client import fetch_with_retry as _fetch
        url = f"{settings.openfda_base_url}/drug/label.json"
        params = {"search": f"openfda.rxcui:{rxcui}", "limit": "1"}
        data = await _fetch(url, params=params, max_retries=1, base_delay=0.2, timeout_seconds=3.0)
        if not data:
            return {}

        results = data.get("results", [])
        if not results:
            return {}

        label = results[0]
        openfda = label.get("openfda", {})
        indications = label.get("indications_and_usage", [])
        has_bbw = bool(label.get("boxed_warning"))

        manufacturer_names = openfda.get("manufacturer_name", [])
        approval_dates = openfda.get("application_number", [])

        return {
            "has_black_box": has_bbw,
            "indication": indications[0][:300] if indications else "",
            "manufacturer": manufacturer_names[0] if manufacturer_names else "",
            "approval_date": None,
        }
    except Exception as exc:
        logger.debug("Label info fetch failed for rxcui=%s: %s", rxcui, exc)
        return {}


def _classify_version(version: int, total: int) -> str:
    """Classify a label version based on its position in the history."""
    if version == 1:
        return "initial_approval"
    if version == total:
        return "latest_update"
    return "safety_update" if version > total // 2 else "label_revision"
