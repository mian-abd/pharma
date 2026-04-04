"""openFDA enforcement, label, and shortage signal client."""
import logging
from datetime import datetime, timezone
from typing import List, Optional

from pydantic import BaseModel

from services.shared.cache import cache_get, cache_set
from services.shared.config import settings
from services.shared.http_client import fetch_with_retry

logger = logging.getLogger(__name__)

OPENFDA_BASE = settings.openfda_base_url


class FDASignalItem(BaseModel):
    drug_rxcui: str
    signal_date: str
    signal_type: str  # SAFETY | SHORTAGE | APPROVAL | STUDY
    title: str
    description: str
    severity: Optional[str]
    recall_class: Optional[str]
    source_url: Optional[str]
    fda_report_number: Optional[str]
    is_black_box: bool


async def get_fda_signals(rxcui: str, drug_name: str) -> List[FDASignalItem]:
    """
    Fetch FDA signals for a drug: enforcement actions, label changes, shortages.
    Cached for 1 hour.
    """
    cache_key = f"drug:{rxcui}:fda_signals"
    cached = await cache_get(cache_key)
    if cached is not None:
        return [FDASignalItem(**s) for s in cached]

    signals: List[FDASignalItem] = []

    # Enforcement actions (recalls)
    enforcement = await _fetch_enforcement(rxcui, drug_name)
    signals.extend(enforcement)

    # Label changes / black box warnings
    label_signals = await _fetch_label_signals(rxcui, drug_name)
    signals.extend(label_signals)

    # Sort chronologically descending
    signals.sort(key=lambda s: s.signal_date, reverse=True)

    await cache_set(cache_key, [s.model_dump() for s in signals], ttl=settings.ttl_fda_signals)
    return signals


async def _fetch_enforcement(rxcui: str, drug_name: str) -> List[FDASignalItem]:
    """Fetch drug enforcement/recall actions from openFDA."""
    url = f"{OPENFDA_BASE}/drug/enforcement.json"
    params = {
        "search": f"openfda.rxcui:{rxcui}+OR+product_description:{drug_name}",
        "limit": "10",
        "sort": "report_date:desc",
    }
    data = await fetch_with_retry(url, params=params)
    if not data:
        return []

    signals = []
    for item in data.get("results", []):
        signal_type = _classify_recall(item)
        signals.append(FDASignalItem(
            drug_rxcui=rxcui,
            signal_date=_parse_date(item.get("report_date", "")),
            signal_type=signal_type,
            title=item.get("reason_for_recall", "")[:200],
            description=item.get("product_description", ""),
            severity=item.get("classification"),
            recall_class=item.get("classification"),
            source_url=item.get("more_code_info"),
            fda_report_number=item.get("recall_number"),
            is_black_box=False,
        ))
    return signals


async def _fetch_label_signals(rxcui: str, drug_name: str) -> List[FDASignalItem]:
    """Fetch label updates and check for black box warnings."""
    url = f"{OPENFDA_BASE}/drug/label.json"
    params = {
        "search": f"openfda.rxcui:{rxcui}",
        "limit": "5",
    }
    data = await fetch_with_retry(url, params=params)
    if not data:
        return []

    signals = []
    for item in data.get("results", []):
        is_bbw = _has_black_box(item)
        effective_time = item.get("effective_time", "")
        date_str = _parse_fda_date(effective_time)

        if is_bbw:
            signals.append(FDASignalItem(
                drug_rxcui=rxcui,
                signal_date=date_str,
                signal_type="SAFETY",
                title="Black Box Warning",
                description="; ".join(item.get("boxed_warning", ["Black box warning present"])[:1]),
                severity="CRITICAL",
                recall_class=None,
                source_url=None,
                fda_report_number=None,
                is_black_box=True,
            ))

        # Label update signal
        signals.append(FDASignalItem(
            drug_rxcui=rxcui,
            signal_date=date_str,
            signal_type="SAFETY",
            title="Drug Label Update",
            description="FDA label revision effective " + date_str,
            severity=None,
            recall_class=None,
            source_url=None,
            fda_report_number=None,
            is_black_box=is_bbw,
        ))

    return signals


def _has_black_box(label: dict) -> bool:
    """Check if an openFDA drug label has a boxed (black box) warning."""
    return bool(label.get("boxed_warning") or label.get("warnings_and_cautions"))


def _classify_recall(item: dict) -> str:
    """Classify an enforcement action into SAFETY | SHORTAGE | APPROVAL | STUDY."""
    classification = item.get("classification", "").upper()
    reason = item.get("reason_for_recall", "").lower()

    if "shortage" in reason:
        return "SHORTAGE"
    if classification in ("CLASS I", "CLASS II", "CLASS III"):
        return "SAFETY"
    return "SAFETY"


def _parse_date(date_str: str) -> str:
    """Parse FDA date formats to ISO string."""
    if not date_str:
        return datetime.now(timezone.utc).date().isoformat()
    try:
        return datetime.strptime(date_str, "%Y%m%d").date().isoformat()
    except ValueError:
        return date_str[:10] if len(date_str) >= 10 else date_str


def _parse_fda_date(date_str: str) -> str:
    """Parse openFDA effective_time format (YYYYMMDD) to ISO."""
    return _parse_date(date_str)
