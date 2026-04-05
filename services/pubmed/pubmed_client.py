"""PubMed E-utilities client with seeded fallback."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from services.shared.cache import cache_get, cache_set
from services.shared.config import settings
from services.shared.dashboard_models import EvidenceSnapshot, PublicationSummary
from services.shared.demo_data import get_seed_drug
from services.shared.http_client import fetch_with_retry

logger = logging.getLogger(__name__)


def _build_query(drug_name: str, generic_name: str | None = None) -> str:
    generic_name = (generic_name or "").strip()
    if generic_name and generic_name.lower() != drug_name.lower():
        return f'("{drug_name}"[Title/Abstract]) OR ("{generic_name}"[Title/Abstract])'
    return f'"{drug_name}"[Title/Abstract]'


async def get_evidence_snapshot(drug_name: str, generic_name: str | None = None) -> EvidenceSnapshot:
    cache_key = f"evidence:{(generic_name or drug_name).lower()}"
    cached = await cache_get(cache_key)
    if cached:
        return EvidenceSnapshot(**cached)

    try:
        query = _build_query(drug_name, generic_name)
        count_12mo = await _search_count(query, last_years=1)
        count_5y = await _search_count(query, last_years=5)
        ids = await _recent_ids(query)
        recent_publications = await _fetch_summaries(ids)

        seed = get_seed_drug(generic_name or drug_name) or {}
        active_trials = int(seed.get("active_trials", 0))
        completed_phase3 = int(seed.get("completed_phase3", 0))
        has_results_pct = float(seed.get("has_results_pct", 0.0))
        velocity = min(100.0, round((count_12mo / max(count_5y, 1)) * 320.0, 1))

        snapshot = EvidenceSnapshot(
            publication_count_12mo=count_12mo,
            publication_count_5y=count_5y,
            literature_velocity_score=velocity,
            active_trials=active_trials,
            completed_phase3_trials=completed_phase3,
            has_results_pct=has_results_pct,
            recent_publications=recent_publications,
            source_status="live",
        )
    except Exception as exc:
        logger.warning("PubMed evidence snapshot fallback for %s: %s", drug_name, exc)
        snapshot = _seed_snapshot(drug_name, generic_name)

    await cache_set(cache_key, snapshot.model_dump(), ttl=settings.ttl_evidence)
    return snapshot


async def _search_count(query: str, last_years: int) -> int:
    year = datetime.now(timezone.utc).year
    start_year = year - last_years + 1
    url = f"{settings.pubmed_base_url}/esearch.fcgi"
    params: dict[str, Any] = {
        "db": "pubmed",
        "term": f"({query}) AND ({start_year}:{year}[pdat])",
        "retmode": "json",
        "retmax": "0",
        "tool": settings.pubmed_tool,
    }
    if settings.pubmed_email:
        params["email"] = settings.pubmed_email

    data = await fetch_with_retry(url, params=params, max_retries=1, base_delay=0.2)
    if not data:
        return 0
    try:
        return int(data["esearchresult"]["count"])
    except (KeyError, TypeError, ValueError):
        return 0


async def _recent_ids(query: str) -> list[str]:
    url = f"{settings.pubmed_base_url}/esearch.fcgi"
    params: dict[str, Any] = {
        "db": "pubmed",
        "term": query,
        "retmode": "json",
        "retmax": "4",
        "sort": "pub_date",
        "tool": settings.pubmed_tool,
    }
    if settings.pubmed_email:
        params["email"] = settings.pubmed_email

    data = await fetch_with_retry(url, params=params, max_retries=1, base_delay=0.2)
    if not data:
        return []
    return list(data.get("esearchresult", {}).get("idlist", []) or [])


async def _fetch_summaries(ids: list[str]) -> list[PublicationSummary]:
    if not ids:
        return []

    url = f"{settings.pubmed_base_url}/esummary.fcgi"
    params: dict[str, Any] = {
        "db": "pubmed",
        "id": ",".join(ids),
        "retmode": "json",
        "tool": settings.pubmed_tool,
    }
    if settings.pubmed_email:
        params["email"] = settings.pubmed_email

    data = await fetch_with_retry(url, params=params, max_retries=1, base_delay=0.2)
    if not data:
        return []

    result = data.get("result", {})
    publications: list[PublicationSummary] = []
    for pmid in ids:
        item = result.get(pmid, {})
        if not item:
            continue
        pub_date = item.get("pubdate", "") or item.get("sortpubdate", "")[:10]
        publications.append(
            PublicationSummary(
                pmid=pmid,
                title=item.get("title", "Recent PubMed publication"),
                journal=item.get("fulljournalname", item.get("source", "PubMed")),
                pub_date=pub_date[:10],
                source_url=f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
            )
        )
    return publications


def _seed_snapshot(drug_name: str, generic_name: str | None = None) -> EvidenceSnapshot:
    seed = get_seed_drug(generic_name or drug_name) or {}
    pub_12mo = int(seed.get("publications_12mo", 0))
    pub_5y = int(seed.get("publications_5y", max(pub_12mo, 1)))
    velocity = min(100.0, round((pub_12mo / max(pub_5y, 1)) * 320.0, 1))
    recent_publications = [
        PublicationSummary(
            pmid=f"demo-{index + 1}",
            title=title,
            journal="Seeded evidence feed",
            pub_date=str(datetime.now(timezone.utc).date()),
            source_url="https://pubmed.ncbi.nlm.nih.gov/",
        )
        for index, title in enumerate(
            [
                f"{generic_name or drug_name}: comparative effectiveness update",
                f"Safety signal synthesis for {generic_name or drug_name}",
                f"Real-world adherence and outcomes with {generic_name or drug_name}",
            ]
        )
    ]
    return EvidenceSnapshot(
        publication_count_12mo=pub_12mo,
        publication_count_5y=pub_5y,
        literature_velocity_score=velocity,
        active_trials=int(seed.get("active_trials", 0)),
        completed_phase3_trials=int(seed.get("completed_phase3", 0)),
        has_results_pct=float(seed.get("has_results_pct", 0.0)),
        recent_publications=recent_publications,
        source_status="demo",
    )
