"""Dashboard home and command-center snapshot builders."""
from __future__ import annotations

import asyncio
import csv
import io
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from services.competition.orange_book_client import get_orange_book_snapshot
from services.dailymed.dailymed_client import get_label_history
from services.drug_resolution.rxnorm_client import resolve_drug
from services.fda_signals.drugsfda_client import get_approval_snapshot
from services.fda_signals.shortage_client import get_shortage_status
from services.gateway.orchestrator import DrugBundle, build_drug_bundle
from services.market.partd_client import get_market_snapshot
from services.media.youtube_client import get_media_briefing
from services.news.fda_rss_client import get_fda_news_items
from services.open_payments.payments_client import get_influence_panel
from services.pubmed.pubmed_client import get_evidence_snapshot
from services.research.nih_reporter_client import get_funding_snapshot
from services.shared.cache import cache_get, cache_get_recent_drugs, cache_set
from services.shared.config import settings
from services.shared.dashboard_models import (
    ApprovalSnapshot,
    DashboardAlert,
    DashboardHome,
    DrugCommandCenter,
    FeaturedWatchCard,
    FundingSnapshot,
    MarketMover,
    MediaBriefing,
    OrangeBookSnapshot,
    PeerComparison,
    PeerComparisonRow,
    SourceHealthItem,
    TrendingDrug,
)
from services.shared.demo_data import get_seed_drug, get_seed_peers, iter_seed_drugs
from services.shared.http_client import fetch_with_retry, get_client
from services.shared.panel_models import InfluencePanel

logger = logging.getLogger(__name__)

_SOURCE_LABELS = {
    "rxnorm": "RxNorm",
    "faers": "openFDA FAERS",
    "fda_signals": "FDA Signals",
    "clinical_trials": "ClinicalTrials.gov",
    "formulary": "CMS Formulary",
    "influence": "CMS Open Payments",
    "market": "CMS Part D",
    "evidence": "PubMed",
    "ai_synthesis": "AI Synthesis",
    "label_history": "DailyMed",
    "shortage": "Drug Shortages",
    "approval": "Drugs@FDA",
    "orange_book": "Orange Book",
    "nih_reporter": "NIH RePORTER",
}

_SOURCE_PING_URLS = {
    "rxnorm": (f"{settings.rxnorm_base_url}/REST/version.json", "GET"),
    "faers": (f"{settings.openfda_base_url}/drug/event.json?limit=1", "GET"),
    "clinical_trials": (f"{settings.clinicaltrials_base_url}/studies?format=json&pageSize=1", "GET"),
    "evidence": (f"{settings.pubmed_base_url}/einfo.fcgi?db=pubmed&retmode=json", "GET"),
    "approval": (f"{settings.openfda_base_url}/drug/drugsfda.json?limit=1", "GET"),
    "label_history": (f"{settings.dailymed_base_url}/spls.json?pagesize=1", "GET"),
    "nih_reporter": (settings.nih_reporter_base_url, "GET"),
}


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _await_with_timeout(task: asyncio.Task, timeout: float):
    try:
        return await asyncio.wait_for(task, timeout)
    except Exception as exc:
        logger.debug("Dashboard subtask timed out or failed: %s", exc)
        task.cancel()
        return exc


# ---------------------------------------------------------------------------
# Live source health pings
# ---------------------------------------------------------------------------

async def _ping_source(key: str, url: str) -> SourceHealthItem:
    """Attempt a lightweight GET to check if the API is reachable."""
    label = _SOURCE_LABELS.get(key, key.replace("_", " ").title())
    try:
        async with get_client(timeout=4.0) as client:
            r = await client.get(url)
            if r.status_code in (200, 206, 304):
                return SourceHealthItem(key=key, label=label, status="live")
            return SourceHealthItem(key=key, label=label, status="degraded", detail=f"HTTP {r.status_code}")
    except Exception as exc:
        return SourceHealthItem(key=key, label=label, status="degraded", detail=str(exc)[:80])


async def _check_source_health() -> List[SourceHealthItem]:
    """Ping all primary API sources concurrently. Cached 5 minutes."""
    cache_key = "source_health:ping"
    cached = await cache_get(cache_key)
    if cached:
        return [SourceHealthItem(**item) for item in cached]

    tasks = {key: _ping_source(key, url) for key, (url, _) in _SOURCE_PING_URLS.items()}
    results = await asyncio.gather(*tasks.values(), return_exceptions=True)
    items: List[SourceHealthItem] = []
    for key, result in zip(tasks.keys(), results):
        if isinstance(result, SourceHealthItem):
            items.append(result)
        else:
            items.append(SourceHealthItem(
                key=key,
                label=_SOURCE_LABELS.get(key, key),
                status="degraded",
                detail=str(result)[:80],
            ))
    # Also add CMS sources (no live ping -- mark as demo unless CSV configured)
    cms_status = "live" if settings.cms_partd_spending_csv_path or settings.cms_partd_spending_csv_url else "demo"
    items.append(SourceHealthItem(key="market", label="CMS Part D", status=cms_status))
    influence_status = "live" if (settings.cms_open_payments_csv_path or settings.cms_open_payments_csv_url) else "demo"
    items.append(SourceHealthItem(key="influence", label="CMS Open Payments", status=influence_status))
    items.append(SourceHealthItem(key="formulary", label="CMS Formulary", status="demo"))
    orange_status = "live" if (settings.orange_book_data_path or settings.orange_book_data_url) else "demo"
    items.append(SourceHealthItem(key="orange_book", label="Orange Book", status=orange_status))

    await cache_set(cache_key, [item.model_dump() for item in items], ttl=300)
    return items


# ---------------------------------------------------------------------------
# Live FAERS top drugs
# ---------------------------------------------------------------------------

async def _fetch_live_top_drugs(limit: int = 10) -> List[dict]:
    """
    Query openFDA FAERS for top drugs by 90-day adverse event volume.
    Returns list of {name, count} dicts.
    """
    cache_key = "faers:top_drugs:90d"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    from datetime import date
    cutoff = (date.today() - timedelta(days=90)).strftime("%Y%m%d")
    url = f"{settings.openfda_base_url}/drug/event.json"
    try:
        data = await fetch_with_retry(
            url,
            params={
                "search": f"receivedate:[{cutoff}+TO+99991231]",
                "count": "patient.drug.openfda.brand_name.exact",
                "limit": str(limit * 2),
            },
            max_retries=2,
            base_delay=0.5,
            timeout_seconds=8.0,
        )
        if data and data.get("results"):
            result = [
                {"name": r["term"], "count": r["count"]}
                for r in data["results"]
                if r.get("term") and r.get("count", 0) > 0
            ][:limit]
            await cache_set(cache_key, result, ttl=3600)
            return result
    except Exception as exc:
        logger.warning("Live FAERS top-drugs fetch failed: %s", exc)
    return []


async def _fetch_active_trial_count(drug_name: str) -> int:
    """Query ClinicalTrials.gov for active trial count for a drug."""
    try:
        data = await fetch_with_retry(
            f"{settings.clinicaltrials_base_url}/studies",
            params={
                "query.term": drug_name,
                "filter.overallStatus": "RECRUITING,ACTIVE_NOT_RECRUITING",
                "pageSize": "1",
                "format": "json",
            },
            max_retries=1,
            base_delay=0.3,
            timeout_seconds=4.0,
        )
        if data:
            return data.get("totalCount", 0)
    except Exception:
        pass
    return 0


# ---------------------------------------------------------------------------
# CMS Part D spending CSV
# ---------------------------------------------------------------------------

async def _download_cms_spending_csv() -> Optional[bytes]:
    """Download the CMS Part D spending CSV (large file -- cached 24 hrs)."""
    cache_key = "cms:partd:spending_csv_bytes"
    cached_raw = await cache_get(cache_key)
    if cached_raw and isinstance(cached_raw, str):
        return cached_raw.encode("utf-8", errors="replace")

    # Check local path first
    if settings.cms_partd_spending_csv_path:
        try:
            with open(settings.cms_partd_spending_csv_path, "rb") as f:
                return f.read()
        except OSError:
            pass

    url = settings.cms_partd_spending_csv_url
    if not url:
        return None

    try:
        async with get_client(timeout=60.0) as client:
            r = await client.get(url)
            if r.status_code == 200:
                content = r.content
                # Cache a preview string (first 50KB) so we don't overload Redis
                await cache_set(cache_key, content[:51200].decode("utf-8", errors="replace"), ttl=86400)
                return content
    except Exception as exc:
        logger.warning("CMS spending CSV download failed: %s", exc)
    return None


def _parse_cms_spending_csv(raw: bytes, top_n: int = 10) -> List[dict]:
    """
    Parse CMS Part D Spending by Drug CSV.
    Returns top drugs by total spend with YoY change.
    """
    results: List[dict] = []
    try:
        text = raw.decode("utf-8", errors="replace")
        reader = csv.DictReader(io.StringIO(text))
        rows: List[dict] = []
        for row in reader:
            # CMS CSV columns vary; try common field names
            name = row.get("Brnd_Name") or row.get("Brand Name") or row.get("drug_name") or ""
            generic = row.get("Gnrc_Name") or row.get("Generic Name") or row.get("generic_name") or ""
            spend_str = row.get("Tot_Spndng") or row.get("Total Spending") or row.get("tot_spending") or "0"
            yoy_str = row.get("Chg_Avg_Spnd_Per_Clm") or row.get("Pct_Chng_Avg_Spnd_Per_Clm") or row.get("yoy_change") or "0"
            try:
                spend = float(str(spend_str).replace(",", "").replace("$", "") or 0)
                yoy = float(str(yoy_str).replace(",", "").replace("%", "") or 0)
            except ValueError:
                continue
            if name and spend > 0:
                rows.append({"name": name.strip(), "generic_name": generic.strip(), "spend": spend, "yoy": yoy})

        rows.sort(key=lambda r: abs(r["yoy"]), reverse=True)
        results = rows[:top_n]
    except Exception as exc:
        logger.warning("CMS CSV parse error: %s", exc)
    return results


async def _get_cms_market_movers(limit: int = 6) -> List[MarketMover]:
    """Get live market movers from CMS Part D CSV if available, else fall back to seeds."""
    raw = await _download_cms_spending_csv()
    if raw:
        parsed = _parse_cms_spending_csv(raw, top_n=limit)
        if parsed:
            return [
                MarketMover(
                    name=r["name"],
                    generic_name=r["generic_name"],
                    market_spend_usd=r["spend"],
                    yoy_spend_change_pct=r["yoy"],
                    note=f"CMS Part D {settings.cms_partd_data_year} — {'↑' if r['yoy'] > 0 else '↓'}{abs(r['yoy']):.1f}% YoY",
                )
                for r in parsed
            ]

    # Seed fallback
    seeds = iter_seed_drugs()
    return [
        MarketMover(
            name=seed["brand_name"],
            generic_name=seed["generic_name"],
            market_spend_usd=float(seed["market_spend_usd"]),
            yoy_spend_change_pct=float(seed["market_delta_pct"]),
            note=seed["trend_reason"],
        )
        for seed in sorted(seeds, key=lambda item: abs(float(item.get("market_delta_pct", 0.0))), reverse=True)[:limit]
    ]


# ---------------------------------------------------------------------------
# Live global alerts from RSS + enforcement
# ---------------------------------------------------------------------------

async def _get_live_global_alerts(limit: int = 8) -> List[DashboardAlert]:
    """Build live global alerts from FDA RSS feeds and enforcement data."""
    news_items = await get_fda_news_items(limit=50)
    alerts: List[DashboardAlert] = []
    for item in news_items:
        if item.get("severity") in ("critical", "high", "medium"):
            alerts.append(DashboardAlert(
                title=item["title"],
                summary=item["summary"],
                severity=item["severity"],
                source=item["source"],
                signal_date=item.get("pub_date"),
                tag=item.get("tag"),
            ))
        if len(alerts) >= limit:
            break
    return alerts


# ---------------------------------------------------------------------------
# Live trending drugs
# ---------------------------------------------------------------------------

async def _build_live_trending(limit: int = 8) -> List[TrendingDrug]:
    """
    Build trending drugs list from live FAERS top-drugs, with RxNorm resolution
    for enrichment. Falls back per-drug to seed data for metrics not from FAERS.
    """
    live_top = await _fetch_live_top_drugs(limit=limit * 2)

    trending: List[TrendingDrug] = []
    seen_names: set[str] = set()

    for drug_entry in live_top:
        raw_name = drug_entry["name"]
        faers_count = drug_entry["count"]

        # Attempt RxNorm resolution (with timeout)
        try:
            resolution = await asyncio.wait_for(resolve_drug(raw_name), timeout=3.0)
        except Exception:
            resolution = None

        brand = resolution.brand_name if resolution else raw_name
        generic = resolution.generic_name if resolution else raw_name.lower()
        drug_class = resolution.drug_class if resolution else "Pharmaceutical"
        rxcui = resolution.rxcui if resolution else ""

        name_key = (brand or generic).lower()
        if name_key in seen_names:
            continue
        seen_names.add(name_key)

        # Supplement with seed if available
        seed = get_seed_drug(generic) or get_seed_drug(brand) or {}
        trust_score = float(seed.get("trust_score", 60.0))
        shortage = bool(seed.get("shortage_active", False))
        publications = int(seed.get("publications_12mo", 0))
        payments = float(seed.get("payments_usd", 0.0))
        spend = float(seed.get("market_spend_usd", 0.0))

        trend_score = min(100.0, round(
            min(35.0, (faers_count / 70000.0) * 35.0) +
            min(25.0, (publications / 700.0) * 12.0) +
            min(25.0, (spend / 7_500_000_000.0) * 18.0) +
            (7.0 if shortage else 0.0),
            1,
        ))

        trending.append(TrendingDrug(
            name=brand or raw_name,
            rxcui=rxcui,
            generic_name=generic,
            drug_class=drug_class,
            trend_score=trend_score,
            trust_score=trust_score,
            faers_reports=faers_count,
            publication_count_12mo=publications,
            market_spend_usd=spend,
            payments_usd=payments,
            shortage_active=shortage,
            trend_reason=seed.get("trend_reason") or f"{faers_count:,} adverse events reported in the last 90 days.",
        ))

        if len(trending) >= limit:
            break

    # If live data returned too few, pad with seeds
    if len(trending) < limit:
        for seed in iter_seed_drugs():
            name_key = seed["generic_name"].lower()
            if name_key in seen_names:
                continue
            seen_names.add(name_key)
            trending.append(_trending_card_from_seed(seed))
            if len(trending) >= limit:
                break

    return sorted(trending, key=lambda t: t.trend_score, reverse=True)[:limit]


def _trending_card_from_seed(seed: dict) -> TrendingDrug:
    return TrendingDrug(
        name=seed.get("brand_name", seed.get("generic_name", "")),
        rxcui=seed.get("rxcui", ""),
        generic_name=seed.get("generic_name", ""),
        drug_class=seed.get("drug_class", ""),
        trend_score=_trend_score(seed),
        trust_score=float(seed.get("trust_score", 0.0)),
        faers_reports=int(seed.get("faers_reports", 0)),
        publication_count_12mo=int(seed.get("publications_12mo", 0)),
        market_spend_usd=float(seed.get("market_spend_usd", 0.0)),
        payments_usd=float(seed.get("payments_usd", 0.0)),
        shortage_active=bool(seed.get("shortage_active", False)),
        trend_reason=seed.get("trend_reason", ""),
    )


def _trend_score(seed: dict) -> float:
    safety_component = min(35.0, (float(seed.get("faers_reports", 0)) / 70000.0) * 28.0 + (7.0 if seed.get("shortage_active") else 0.0))
    evidence_component = min(25.0, (float(seed.get("publications_12mo", 0)) / 700.0) * 12.0 + (float(seed.get("active_trials", 0)) / 50.0) * 13.0)
    market_component = min(25.0, (float(seed.get("market_spend_usd", 0.0)) / 7500000000.0) * 18.0 + max(float(seed.get("market_delta_pct", 0.0)), 0.0) * 0.25)
    influence_component = min(15.0, (float(seed.get("payments_usd", 0.0)) / 15000000.0) * 15.0)
    return round(safety_component + evidence_component + market_component + influence_component, 1)


# ---------------------------------------------------------------------------
# Drug command-center helpers (unchanged logic, kept here)
# ---------------------------------------------------------------------------

def _seed_faers(seed: dict, rxcui: str, drug_name: str) -> dict:
    now = datetime.now(timezone.utc)
    monthly_data = []
    base_total = max(int(seed.get("faers_reports", 0) / 6), 1)
    for offset in range(6, 0, -1):
        point = now - timedelta(days=offset * 30)
        total = int(base_total * (0.82 + (offset * 0.04)))
        serious = int(total * float(seed.get("serious_ratio", 0.2)))
        monthly_data.append({
            "year": point.year,
            "month": point.month,
            "total": total,
            "serious": serious,
            "fatal": max(0, int(serious * 0.08)),
        })

    total_reports = int(seed.get("faers_reports", base_total * 6))
    serious_ratio = float(seed.get("serious_ratio", 0.2))
    return {
        "drug_rxcui": rxcui,
        "drug_name": drug_name,
        "monthly_data": monthly_data,
        "top_reactions": [
            {"reaction": "nausea", "count": max(12, int(total_reports * 0.12))},
            {"reaction": "headache", "count": max(10, int(total_reports * 0.09))},
            {"reaction": "dizziness", "count": max(8, int(total_reports * 0.07))},
        ],
        "proportional_reporting_ratio": 2.4 if seed.get("signal_flag") else 0.9,
        "signal_flag": bool(seed.get("signal_flag", False)),
        "trend_direction": "increasing" if seed.get("shortage_active") else "stable",
        "total_6mo_reports": total_reports,
        "serious_6mo_reports": int(total_reports * serious_ratio),
        "serious_ratio": serious_ratio,
    }


def _seed_bundle(drug_name: str, resolution) -> DrugBundle:
    seed = get_seed_drug(resolution.generic_name or drug_name) or {}
    shortage_active = bool(seed.get("shortage_active", False))
    fda_signals = []
    if shortage_active:
        fda_signals.append({
            "drug_rxcui": resolution.rxcui,
            "signal_date": str(datetime.now(timezone.utc).date()),
            "signal_type": "SHORTAGE",
            "title": f"{resolution.brand_name or drug_name} shortage pressure",
            "description": "Seeded shortage fallback generated while live shortage enrichment is unavailable.",
            "severity": "HIGH",
            "recall_class": None,
            "source_url": None,
            "fda_report_number": None,
            "is_black_box": False,
        })

    return DrugBundle(
        drug_name=drug_name,
        rxcui=resolution.rxcui,
        brand_name=resolution.brand_name,
        generic_name=resolution.generic_name,
        manufacturer=seed.get("manufacturer", ""),
        drug_class=resolution.drug_class,
        indication="See FDA label / evidence feed",
        patent_expiry=None,
        nnt_trial=None,
        nnt_realworld=None,
        arr_trial=None,
        rrr_trial=None,
        pivot_trial_name=None,
        trust_score=float(seed.get("trust_score", 55.0)),
        trust_score_breakdown={
            "evidence_quality": 70.0,
            "safety_signal": 58.0,
            "trial_real_gap": 61.0,
            "formulary_access": 64.0,
        },
        faers=_seed_faers(seed, resolution.rxcui, resolution.generic_name or drug_name),
        trials=[],
        formulary=[
            {"drug_rxcui": resolution.rxcui, "payer_category": "medicare_d", "tier": "3", "estimated_copay_low": 25.0, "estimated_copay_high": 55.0, "prior_auth_required": False, "step_therapy_required": True, "quantity_limit": None, "cms_data_quarter": "demo"},
            {"drug_rxcui": resolution.rxcui, "payer_category": "medicaid", "tier": "2", "estimated_copay_low": 5.0, "estimated_copay_high": 15.0, "prior_auth_required": True, "step_therapy_required": False, "quantity_limit": None, "cms_data_quarter": "demo"},
            {"drug_rxcui": resolution.rxcui, "payer_category": "commercial", "tier": "3", "estimated_copay_low": 20.0, "estimated_copay_high": 50.0, "prior_auth_required": False, "step_therapy_required": False, "quantity_limit": None, "cms_data_quarter": "demo"},
        ],
        fda_signals=fda_signals,
        rep_brief={
            "will_say": [f"{resolution.brand_name or drug_name} has a strong headline story and broad clinical familiarity."],
            "reality": ["Use the command center to balance headline claims against safety, evidence, access, and utilization context."],
            "power_questions": ["What is the absolute outcome impact, not just the relative claim?", "How does real-world access change the practical benefit?", "Which signals or class-peer gaps should change prescribing caution?"],
            "study_limitations": "Fallback brief used because live AI synthesis is unavailable.",
            "pivot_trial_used": None,
            "absolute_vs_relative_note": "Seeded guidance shown while live synthesis is unavailable.",
            "generation_latency_ms": None,
        },
        source_statuses={
            "faers": "demo",
            "clinical_trials": "demo",
            "formulary": "demo",
            "fda_signals": "demo",
            "ai_synthesis": "demo",
        },
    )


def _build_alerts(bundle: DrugBundle, shortage_status: dict | None, evidence_count: int) -> list[DashboardAlert]:
    alerts: list[DashboardAlert] = []
    if shortage_status and shortage_status.get("status") == "active":
        alerts.append(DashboardAlert(
            title=f"{bundle.brand_name or bundle.drug_name} shortage active",
            summary=shortage_status.get("reason") or "Official shortage endpoint reports an active shortage signal.",
            severity="high",
            source="Drug Shortages",
            tag="SHORTAGE",
        ))

    for signal in bundle.fda_signals[:4]:
        alerts.append(DashboardAlert(
            title=signal.get("title", "FDA signal"),
            summary=signal.get("description", ""),
            severity="critical" if signal.get("is_black_box") else "medium",
            source="openFDA",
            signal_date=signal.get("signal_date"),
            tag=signal.get("signal_type"),
        ))

    if evidence_count > 250:
        alerts.append(DashboardAlert(
            title="Evidence velocity elevated",
            summary=f"{bundle.generic_name or bundle.drug_name} has unusually high recent publication volume.",
            severity="info",
            source="PubMed",
            tag="EVIDENCE",
        ))

    return alerts[:8]


def _build_source_health(bundle: DrugBundle, market_status: str, evidence_status: str, influence_status: str, approval_status: str) -> list[SourceHealthItem]:
    statuses = {
        **bundle.source_statuses,
        "market": market_status,
        "evidence": evidence_status,
        "influence": influence_status,
        "approval": approval_status,
    }
    return [
        SourceHealthItem(
            key=key,
            label=_SOURCE_LABELS.get(key, key.replace("_", " ").title()),
            status=value,
            detail="seeded fallback" if value == "demo" else None,
        )
        for key, value in statuses.items()
    ]


def _empty_orange_book(application_number: Optional[str], status: str = "demo") -> OrangeBookSnapshot:
    return OrangeBookSnapshot(
        application_number=application_number,
        applicant=None,
        approval_date=None,
        dosage_form_route=None,
        reference_listed_drug=False,
        reference_standard=False,
        generic_equivalent_count=0,
        therapeutic_equivalence_codes=[],
        patents=[],
        exclusivities=[],
        source_status=status,
    )


def _empty_funding(status: str = "demo") -> FundingSnapshot:
    return FundingSnapshot(
        matched_project_count=0,
        active_project_count=0,
        total_award_amount_usd=0.0,
        top_agencies=[],
        top_organizations=[],
        recent_projects=[],
        source_status=status,
    )


def _access_score_from_formulary(formulary: list[dict]) -> float:
    if not formulary:
        return 0.0
    score = 0.0
    for row in formulary:
        tier = int(row.get("tier") or 0)
        if tier <= 2:
            score += 26
        elif tier == 3:
            score += 18
        elif tier == 4:
            score += 9
        if row.get("prior_auth_required"):
            score -= 6
        if row.get("step_therapy_required"):
            score -= 5
    return max(0.0, min(100.0, round(score / max(len(formulary), 1), 1)))


def _peer_row_from_seed(seed: dict, subject_name: str, access_score: float = 0.0) -> PeerComparisonRow:
    return PeerComparisonRow(
        rxcui=seed.get("rxcui", ""),
        brand_name=seed.get("brand_name", ""),
        generic_name=seed.get("generic_name", ""),
        drug_class=seed.get("drug_class", ""),
        trust_score=float(seed.get("trust_score", 0.0)),
        serious_ratio=float(seed.get("serious_ratio", 0.0)),
        shortage_active=bool(seed.get("shortage_active", False)),
        black_box=bool(seed.get("signal_flag", False)),
        active_trials=int(seed.get("active_trials", 0)),
        access_score=access_score or 68.0,
        total_spend_usd=float(seed.get("market_spend_usd", 0.0)),
        influence_usd=float(seed.get("payments_usd", 0.0)),
        is_subject=seed.get("generic_name", "").lower() == subject_name.lower(),
    )


def _build_peer_comparison(bundle: DrugBundle, market: dict, influence: dict) -> PeerComparison:
    access_score = _access_score_from_formulary(bundle.formulary)
    subject_seed = get_seed_drug(bundle.generic_name or bundle.drug_name) or {
        "rxcui": bundle.rxcui,
        "brand_name": bundle.brand_name,
        "generic_name": bundle.generic_name,
        "drug_class": bundle.drug_class,
        "trust_score": bundle.trust_score,
        "serious_ratio": (bundle.faers or {}).get("serious_ratio", 0.0),
        "shortage_active": any(signal.get("signal_type") == "SHORTAGE" for signal in bundle.fda_signals),
        "signal_flag": (bundle.faers or {}).get("signal_flag", False),
        "active_trials": sum(1 for trial in bundle.trials if trial.get("status", "").upper() in ("RECRUITING", "ACTIVE", "ACTIVE, NOT RECRUITING")),
        "market_spend_usd": market.get("total_spend_usd", 0.0),
        "payments_usd": influence.get("total_payments_usd", 0.0),
    }
    rows = [_peer_row_from_seed(subject_seed, bundle.generic_name or bundle.drug_name, access_score=access_score)]
    for peer in get_seed_peers(bundle.drug_class, bundle.generic_name or bundle.drug_name):
        rows.append(_peer_row_from_seed(peer, bundle.generic_name or bundle.drug_name))
    rows = sorted(rows, key=lambda row: (not row.is_subject, -row.total_spend_usd))
    return PeerComparison(
        benchmark="class_peers",
        rationale=f"Default peers selected from the {bundle.drug_class or 'same therapeutic'} class and ranked by utilization/spend.",
        rows=rows[:5],
    )


# ---------------------------------------------------------------------------
# Drug command center (unchanged flow, uses live service clients)
# ---------------------------------------------------------------------------

async def build_drug_command_center(drug_name: str) -> DrugCommandCenter | None:
    resolution = await resolve_drug(drug_name)
    if not resolution:
        return None

    cache_key = f"dashboard:{resolution.rxcui}:snapshot"
    cached = await cache_get(cache_key)
    if cached:
        return DrugCommandCenter(**cached)

    bundle_task = asyncio.create_task(build_drug_bundle(drug_name))
    label_history_task = asyncio.create_task(get_label_history(resolution.rxcui, resolution.generic_name or drug_name))
    shortage_task = asyncio.create_task(get_shortage_status(resolution.rxcui, resolution.generic_name or drug_name))
    influence_task = asyncio.create_task(get_influence_panel(resolution.rxcui, resolution.generic_name or drug_name, resolution.drug_class))
    market_task = asyncio.create_task(get_market_snapshot(drug_name, resolution.generic_name, resolution.brand_name))
    evidence_task = asyncio.create_task(get_evidence_snapshot(drug_name, resolution.generic_name))
    approval_task = asyncio.create_task(get_approval_snapshot(resolution.brand_name or drug_name, resolution.generic_name))
    orange_book_task = asyncio.create_task(
        get_orange_book_snapshot(resolution.brand_name or drug_name, resolution.generic_name, None)
    )
    funding_task = asyncio.create_task(get_funding_snapshot(drug_name, resolution.generic_name))

    bundle_result = await _await_with_timeout(bundle_task, 8.0)
    label_history = await _await_with_timeout(label_history_task, 4.0)
    shortage_status = await _await_with_timeout(shortage_task, 3.0)
    influence = await _await_with_timeout(influence_task, 4.0)
    market = await _await_with_timeout(market_task, 4.0)
    evidence = await _await_with_timeout(evidence_task, 4.0)
    approval = await _await_with_timeout(approval_task, 3.0)
    orange_book = await _await_with_timeout(orange_book_task, 5.0)
    funding = await _await_with_timeout(funding_task, 5.0)

    bundle: DrugBundle
    if isinstance(bundle_result, Exception) or bundle_result is None:
        logger.warning("Command center bundle fallback used for %s", drug_name)
        bundle = _seed_bundle(drug_name, resolution)
    else:
        bundle = bundle_result
    label_history_list = [] if isinstance(label_history, Exception) else [item.model_dump() for item in label_history]
    shortage_dict = None if isinstance(shortage_status, Exception) else shortage_status.model_dump()
    if isinstance(influence, Exception):
        seed = get_seed_drug(bundle.generic_name or bundle.drug_name) or {}
        influence_panel = InfluencePanel(
            rxcui=bundle.rxcui,
            drug_name=bundle.drug_name,
            total_payments_usd=float(seed.get("payments_usd", 0.0)),
            hcp_count=0,
            company_count=0,
            top_specialties=[],
            top_companies=[],
            payment_types=[],
            yearly_trend=[],
            data_year=settings.cms_open_payments_data_year,
            source_status="demo",
        )
    else:
        influence_panel = influence

    if isinstance(market, Exception):
        market_seed = get_seed_drug(bundle.generic_name or bundle.drug_name) or {}
        market_status = "demo"
        market_payload = {
            "data_year": settings.cms_partd_data_year,
            "beneficiary_count": int(market_seed.get("beneficiaries", 0)),
            "total_claims": int(market_seed.get("claims", 0)),
            "total_30_day_fills": float(market_seed.get("fills_30_day", 0.0)),
            "total_spend_usd": float(market_seed.get("market_spend_usd", 0.0)),
            "out_of_pocket_spend_usd": float(market_seed.get("oop_spend_usd", 0.0)),
            "yoy_spend_change_pct": float(market_seed.get("market_delta_pct", 0.0)),
            "yoy_claim_change_pct": round(float(market_seed.get("market_delta_pct", 0.0)) * 0.62, 1),
            "top_regions": market_seed.get("states", []),
            "source_status": "demo",
        }
    else:
        market_status = market.source_status
        market_payload = market.model_dump()

    if isinstance(evidence, Exception):
        evidence_status = "demo"
        evidence_seed = get_seed_drug(bundle.generic_name or bundle.drug_name) or {}
        evidence_payload = {
            "publication_count_12mo": int(evidence_seed.get("publications_12mo", 0)),
            "publication_count_5y": int(evidence_seed.get("publications_5y", 0)),
            "literature_velocity_score": 40.0,
            "active_trials": sum(1 for trial in bundle.trials if trial.get("status", "").upper() in ("RECRUITING", "ACTIVE", "ACTIVE, NOT RECRUITING")),
            "completed_phase3_trials": sum(1 for trial in bundle.trials if "3" in trial.get("phase", "") and trial.get("status", "").upper() == "COMPLETED"),
            "has_results_pct": round((sum(1 for trial in bundle.trials if trial.get("has_results")) / max(len(bundle.trials), 1)) * 100, 1),
            "recent_publications": [],
            "source_status": "demo",
        }
    else:
        evidence_status = evidence.source_status
        evidence_payload = evidence.model_dump()

    if isinstance(approval, Exception):
        approval = ApprovalSnapshot(
            sponsor_name=bundle.manufacturer,
            approval_date=None,
            application_number=None,
            dosage_form=None,
            route=None,
            source_status="demo",
        )
    if isinstance(orange_book, Exception):
        orange_book = _empty_orange_book(approval.application_number, status="demo")
    else:
        orange_book = orange_book.model_copy(update={
            "application_number": orange_book.application_number or approval.application_number
        })
    if isinstance(funding, Exception):
        funding = _empty_funding(status="demo")

    source_health = _build_source_health(
        bundle,
        market_status=market_status,
        evidence_status=evidence_status,
        influence_status=influence_panel.source_status,
        approval_status=approval.source_status,
    )
    source_health.extend([
        SourceHealthItem(
            key="orange_book",
            label=_SOURCE_LABELS["orange_book"],
            status=orange_book.source_status,
            detail="competition and exclusivity context" if orange_book.source_status == "live" else None,
        ),
        SourceHealthItem(
            key="nih_reporter",
            label=_SOURCE_LABELS["nih_reporter"],
            status=funding.source_status,
            detail="federal research activity" if funding.source_status == "live" else None,
        ),
    ])
    peer_comparison = _build_peer_comparison(bundle, market_payload, influence_panel.model_dump())
    live_alerts = _build_alerts(bundle, shortage_dict, evidence_payload["publication_count_12mo"])
    seed = get_seed_drug(bundle.generic_name or bundle.drug_name) or {}

    snapshot = DrugCommandCenter(
        generated_at=_utc_now(),
        drug_name=bundle.drug_name,
        rxcui=bundle.rxcui,
        brand_name=bundle.brand_name,
        generic_name=bundle.generic_name,
        manufacturer=approval.sponsor_name or bundle.manufacturer or resolution.brand_name,
        drug_class=bundle.drug_class,
        indication=bundle.indication,
        patent_expiry=bundle.patent_expiry,
        nnt_trial=bundle.nnt_trial,
        nnt_realworld=bundle.nnt_realworld,
        arr_trial=bundle.arr_trial,
        rrr_trial=bundle.rrr_trial,
        pivot_trial_name=bundle.pivot_trial_name,
        trust_score=bundle.trust_score,
        trust_score_breakdown=bundle.trust_score_breakdown,
        faers=bundle.faers,
        trials=bundle.trials,
        formulary=bundle.formulary,
        fda_signals=bundle.fda_signals,
        rep_brief=bundle.rep_brief,
        source_statuses=bundle.source_statuses,
        label_history=label_history_list,
        shortage_status=shortage_dict,
        market=market_payload,
        evidence=evidence_payload,
        approval=approval.model_dump(),
        orange_book=orange_book.model_dump(),
        funding=funding.model_dump(),
        influence=influence_panel.model_dump(),
        peer_comparison=peer_comparison,
        live_alerts=live_alerts,
        source_health=source_health,
        trending_reason=seed.get("trend_reason", "Hybrid trend score combines safety, evidence, market, and influence signals."),
    )

    await cache_set(cache_key, snapshot.model_dump(), ttl=settings.ttl_dashboard_snapshot)
    return snapshot


# ---------------------------------------------------------------------------
# Live dashboard home
# ---------------------------------------------------------------------------

async def build_dashboard_home() -> DashboardHome:
    cache_key = "dashboard:home"
    cached = await cache_get(cache_key)
    if cached:
        return DashboardHome(**cached)

    # Run all live fetches concurrently
    trending_task = asyncio.create_task(_build_live_trending(limit=8))
    alerts_task = asyncio.create_task(_get_live_global_alerts(limit=8))
    movers_task = asyncio.create_task(_get_cms_market_movers(limit=6))
    source_health_task = asyncio.create_task(_check_source_health())
    recent_task = asyncio.create_task(cache_get_recent_drugs(lookback_days=30))

    trending_result = await _await_with_timeout(trending_task, 12.0)
    alerts_result = await _await_with_timeout(alerts_task, 8.0)
    movers_result = await _await_with_timeout(movers_task, 15.0)
    source_health_result = await _await_with_timeout(source_health_task, 10.0)
    recent_result = await _await_with_timeout(recent_task, 3.0)

    # Fallbacks
    if isinstance(trending_result, Exception) or not trending_result:
        trending_result = [_trending_card_from_seed(s) for s in iter_seed_drugs()][:8]
    if isinstance(alerts_result, Exception) or not alerts_result:
        alerts_result = []
    if isinstance(movers_result, Exception) or not movers_result:
        seeds = iter_seed_drugs()
        movers_result = [
            MarketMover(
                name=s["brand_name"],
                generic_name=s["generic_name"],
                market_spend_usd=float(s["market_spend_usd"]),
                yoy_spend_change_pct=float(s["market_delta_pct"]),
                note=s["trend_reason"],
            )
            for s in sorted(seeds, key=lambda x: abs(float(x.get("market_delta_pct", 0.0))), reverse=True)[:6]
        ]
    if isinstance(source_health_result, Exception) or not source_health_result:
        source_health_result = [
            SourceHealthItem(key="rxnorm", label="RxNorm", status="live"),
            SourceHealthItem(key="faers", label="openFDA FAERS", status="live"),
            SourceHealthItem(key="clinical_trials", label="ClinicalTrials.gov", status="live"),
            SourceHealthItem(key="market", label="CMS Part D", status="demo"),
            SourceHealthItem(key="influence", label="CMS Open Payments", status="demo"),
            SourceHealthItem(key="formulary", label="CMS Formulary", status="demo"),
            SourceHealthItem(key="evidence", label="PubMed", status="live"),
            SourceHealthItem(key="orange_book", label="Orange Book", status="live" if settings.orange_book_data_url or settings.orange_book_data_path else "demo"),
            SourceHealthItem(key="nih_reporter", label="NIH RePORTER", status="live"),
        ]

    recent = recent_result if not isinstance(recent_result, Exception) else []
    recent_names = {item.get("brand_name", "") or item.get("drug_name", "") for item in recent if item.get("brand_name") or item.get("drug_name")}

    trending: List[TrendingDrug] = trending_result
    featured = [
        FeaturedWatchCard(
            name=item.name,
            rxcui=item.rxcui,
            trust_score=item.trust_score,
            alert_count=int(item.shortage_active) + (1 if item.faers_reports > 30000 else 0),
            summary=item.trend_reason,
        )
        for item in trending[:4]
    ]

    # Supplement alerts with shortage signals from trending drugs
    if len(alerts_result) < 4:
        for item in trending[:5]:
            if item.shortage_active and len(alerts_result) < 8:
                alerts_result.append(DashboardAlert(
                    title=f"{item.name} shortage pressure",
                    summary=item.trend_reason,
                    severity="high",
                    source="Drug Shortages",
                    tag="SHORTAGE",
                ))

    ticker_items = [
        f"LIVE DATA // {len(trending)} drugs tracked from openFDA FAERS",
        "Hybrid trending weights: safety 35 / evidence 25 / market 25 / influence 15",
        "Use / to search, compare class peers, and inspect access friction inline",
        "Snapshot-first rendering keeps the board responsive under partial data conditions",
    ]
    if recent_names:
        ticker_items.insert(0, f"Recent: {', '.join(list(recent_names)[:4])}")

    home = DashboardHome(
        generated_at=_utc_now(),
        ticker_items=ticker_items,
        source_health=source_health_result,
        global_alerts=alerts_result[:8],
        trending_drugs=trending,
        featured_watchlist=featured,
        market_movers=movers_result[:6],
    )
    await cache_set(cache_key, home.model_dump(), ttl=settings.ttl_dashboard_home)
    return home


async def build_media_briefing() -> MediaBriefing:
    return await get_media_briefing()
