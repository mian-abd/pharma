"""openFDA FAERS adverse events client -- 6-month trend, top reactions, signal detection."""
import logging
from calendar import monthrange
from datetime import date, datetime, timezone
from typing import Dict, List, Optional

from pydantic import BaseModel

from services.adverse_events.signal_detector import calculate_prr, detect_trend, is_signal
from services.shared.cache import cache_get, cache_set
from services.shared.config import settings
from services.shared.http_client import fetch_with_retry
from services.shared.models import AdverseEventMonthly, ReactionCount

logger = logging.getLogger(__name__)

OPENFDA_BASE = settings.openfda_base_url


class FAERSSummary(BaseModel):
    drug_rxcui: str
    drug_name: str
    monthly_data: List[dict]
    top_reactions: List[dict]
    proportional_reporting_ratio: Optional[float]
    signal_flag: bool
    trend_direction: str
    total_6mo_reports: int
    serious_6mo_reports: int
    serious_ratio: float


async def get_6mo_trend(rxcui: str, drug_name: str) -> FAERSSummary:
    """
    Fetch 6-month rolling adverse event trend from openFDA FAERS.

    Returns empty FAERSSummary (not an error) if the drug has no reports.
    Cached for 24 hours.
    """
    cache_key = f"drug:{rxcui}:faers:monthly"
    cached = await cache_get(cache_key)
    if cached:
        return FAERSSummary(**cached)

    monthly_data = []
    total_reports = 0
    serious_reports = 0

    today = date.today()
    for i in range(6, 0, -1):
        # Go back i months from today
        month = today.month - i
        year = today.year
        while month <= 0:
            month += 12
            year -= 1

        start = date(year, month, 1)
        last_day = monthrange(year, month)[1]
        end = date(year, month, last_day)

        month_data = await _fetch_monthly_counts(drug_name, start, end)
        monthly_data.append({
            "year": year,
            "month": month,
            "total": month_data.get("total", 0),
            "serious": month_data.get("serious", 0),
            "fatal": month_data.get("fatal", 0),
        })
        total_reports += month_data.get("total", 0)
        serious_reports += month_data.get("serious", 0)

    top_reactions = await _fetch_top_reactions(drug_name)
    monthly_counts = [m["total"] for m in monthly_data]
    trend = detect_trend(monthly_counts)

    # PRR calculation (simplified -- compare drug reaction rate to background)
    prr = None
    signal = False
    if top_reactions and total_reports > 0:
        top_count = top_reactions[0].get("count", 0) if top_reactions else 0
        # background estimate: 0.1% of all reports
        prr = calculate_prr(top_count, total_reports, top_count * 10, total_reports * 100)
        signal = is_signal(prr, top_count)

    serious_ratio = serious_reports / total_reports if total_reports > 0 else 0.0

    result = FAERSSummary(
        drug_rxcui=rxcui,
        drug_name=drug_name,
        monthly_data=monthly_data,
        top_reactions=top_reactions,
        proportional_reporting_ratio=prr,
        signal_flag=signal,
        trend_direction=trend,
        total_6mo_reports=total_reports,
        serious_6mo_reports=serious_reports,
        serious_ratio=serious_ratio,
    )

    await cache_set(cache_key, result.model_dump(), ttl=settings.ttl_faers)
    return result


async def _fetch_monthly_counts(drug_name: str, start: date, end: date) -> Dict[str, int]:
    """Get total and serious report counts for a specific month."""
    date_range = f"receivedate:[{start.strftime('%Y%m%d')}+TO+{end.strftime('%Y%m%d')}]"
    search = f"patient.drug.medicinalproduct:{drug_name}+AND+{date_range}"

    url = f"{OPENFDA_BASE}/drug/event.json"
    data = await fetch_with_retry(url, params={"search": search, "count": "serious", "limit": "2"})

    total = 0
    serious = 0
    fatal = 0

    if data:
        results = data.get("results", [])
        for item in results:
            term = item.get("term", "")
            count = item.get("count", 0)
            if str(term) == "2":   # 2 = serious
                serious = count
                total += count
            elif str(term) == "1":  # 1 = not serious
                total += count

        # Fetch fatal separately
        fatal_search = f"{search}+AND+patient.reaction.reactionoutcome:5"
        fatal_data = await fetch_with_retry(url, params={"search": fatal_search, "limit": "1"})
        if fatal_data:
            fatal = fatal_data.get("meta", {}).get("results", {}).get("total", 0)

    return {"total": total, "serious": serious, "fatal": fatal}


async def _fetch_top_reactions(drug_name: str, limit: int = 10) -> List[dict]:
    """Get top adverse reactions by report count."""
    url = f"{OPENFDA_BASE}/drug/event.json"
    params = {
        "search": f"patient.drug.medicinalproduct:{drug_name}",
        "count": "patient.reaction.reactionmeddrapt.exact",
        "limit": str(limit),
    }
    data = await fetch_with_retry(url, params=params)
    if not data:
        return []

    results = data.get("results", [])
    return [{"reaction": r.get("term", ""), "count": r.get("count", 0)} for r in results]
