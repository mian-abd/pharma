"""
PharmaCortex API Orchestrator.

Coordinates parallel data fetching from all microservices and assembles
the complete DrugBundle response.
"""
import asyncio
import logging
from typing import Any, Dict, List, Optional

from pydantic import BaseModel

from services.adverse_events.faers_client import FAERSSummary, get_6mo_trend
from services.ai_synthesis.rep_brief_generator import generate_rep_brief
from services.clinical_trials.trials_client import TrialSummary, get_trials
from services.drug_resolution.rxnorm_client import DrugResolutionResult, resolve_drug
from services.fda_signals.fda_client import FDASignalItem, get_fda_signals
from services.formulary.cms_parser import FormularyCoverage, get_formulary_coverage
from services.gateway.trust_score import compute_trust_score
from services.shared.cache import cache_get, cache_set, cache_track_drug
from services.shared.config import settings
from services.shared.models import TrustScoreBreakdown

logger = logging.getLogger(__name__)


class DrugBundle(BaseModel):
    """Complete data bundle returned for a drug query."""
    drug_name: str
    rxcui: str
    brand_name: str
    generic_name: str
    manufacturer: str
    drug_class: str
    indication: str
    patent_expiry: Optional[str]
    nnt_trial: Optional[float]
    nnt_realworld: Optional[float]
    arr_trial: Optional[float]
    rrr_trial: Optional[float]
    pivot_trial_name: Optional[str]

    trust_score: float
    trust_score_breakdown: dict

    faers: Optional[dict]
    trials: List[dict]
    formulary: List[dict]
    fda_signals: List[dict]
    rep_brief: Optional[dict]

    source_statuses: Dict[str, str]


async def build_drug_bundle(drug_name: str) -> Optional[DrugBundle]:
    """
    Main entry point: resolve drug, check bundle cache, fetch all data in parallel.
    """
    # Step 1: Resolve drug name to RXCUI
    resolution = await resolve_drug(drug_name)
    if not resolution:
        logger.warning("Could not resolve drug: %s", drug_name)
        return None

    rxcui = resolution.rxcui

    # Step 2: Check bundle cache
    bundle_cache_key = f"drug:{rxcui}:bundle"
    cached_bundle = await cache_get(bundle_cache_key)
    if cached_bundle:
        logger.debug("Bundle cache hit for rxcui=%s", rxcui)
        return DrugBundle(**cached_bundle)

    # Step 3: Parallel fetch all data sources
    source_statuses: Dict[str, str] = {}

    results = await asyncio.gather(
        get_6mo_trend(rxcui, resolution.generic_name or drug_name),
        get_trials(rxcui, resolution.generic_name or drug_name),
        get_formulary_coverage(rxcui, drug_name),
        get_fda_signals(rxcui, drug_name),
        return_exceptions=True,
    )

    faers_result, trials_result, formulary_result, fda_result = results

    # Handle exceptions from individual services gracefully
    faers: Optional[FAERSSummary] = None
    if isinstance(faers_result, Exception):
        logger.error("FAERS service error: %s", faers_result)
        source_statuses["faers"] = "unavailable"
    else:
        faers = faers_result
        source_statuses["faers"] = "live"

    trials: List[TrialSummary] = []
    if isinstance(trials_result, Exception):
        logger.error("Trials service error: %s", trials_result)
        source_statuses["clinical_trials"] = "unavailable"
    else:
        trials = trials_result or []
        source_statuses["clinical_trials"] = "live"

    formulary: List[FormularyCoverage] = []
    if isinstance(formulary_result, Exception):
        logger.error("Formulary service error: %s", formulary_result)
        source_statuses["formulary"] = "unavailable"
    else:
        formulary = formulary_result or []
        source_statuses["formulary"] = "live"

    fda_signals: List[FDASignalItem] = []
    if isinstance(fda_result, Exception):
        logger.error("FDA signals service error: %s", fda_result)
        source_statuses["fda_signals"] = "unavailable"
    else:
        fda_signals = fda_result or []
        source_statuses["fda_signals"] = "live"

    # Step 4: Generate Rep Brief (check cache first)
    drug_data_for_brief = _build_brief_input(resolution, faers, trials, fda_signals)
    rep_brief_model = await generate_rep_brief(drug_data_for_brief)
    rep_brief_dict = None
    if rep_brief_model:
        source_statuses["ai_synthesis"] = "live"
        rep_brief_dict = {
            "will_say": rep_brief_model.will_say,
            "reality": rep_brief_model.reality,
            "power_questions": rep_brief_model.power_questions,
            "study_limitations": rep_brief_model.study_limitations,
            "pivot_trial_used": rep_brief_model.pivot_trial_used,
            "absolute_vs_relative_note": rep_brief_model.absolute_vs_relative_note,
            "generation_latency_ms": rep_brief_model.generation_latency_ms,
        }
    else:
        source_statuses["ai_synthesis"] = "unavailable"

    # Step 5: Compute Trust Score
    trust_score, breakdown = _compute_score(faers, trials, formulary, resolution)

    # Step 6: Assemble bundle
    bundle = DrugBundle(
        drug_name=drug_name,
        rxcui=rxcui,
        brand_name=resolution.brand_name,
        generic_name=resolution.generic_name,
        manufacturer="",
        drug_class=resolution.drug_class,
        indication="",
        patent_expiry=None,
        nnt_trial=None,
        nnt_realworld=None,
        arr_trial=None,
        rrr_trial=None,
        pivot_trial_name=rep_brief_dict.get("pivot_trial_used") if rep_brief_dict else None,
        trust_score=trust_score,
        trust_score_breakdown=breakdown.model_dump(),
        faers=faers.model_dump() if faers else None,
        trials=[t.model_dump() for t in trials],
        formulary=[f.model_dump() for f in formulary],
        fda_signals=[s.model_dump() for s in fda_signals],
        rep_brief=rep_brief_dict,
        source_statuses=source_statuses,
    )

    # Step 7: Cache the full bundle
    await cache_set(bundle_cache_key, bundle.model_dump(), ttl=settings.ttl_bundle)

    # Step 8: Track this drug for background refresh jobs
    await cache_track_drug(rxcui, resolution.generic_name or drug_name, resolution.brand_name)

    return bundle


def _build_brief_input(
    resolution: DrugResolutionResult,
    faers: Optional[FAERSSummary],
    trials: List[TrialSummary],
    fda_signals: List[FDASignalItem],
) -> Dict[str, Any]:
    """Assemble data dict for Rep Brief generator."""
    industry_trials = sum(1 for t in trials if t.industry_sponsored)
    active_trials = sum(1 for t in trials if t.status.upper() in ("RECRUITING", "ACTIVE", "NOT YET RECRUITING"))

    faers_summary = ""
    if faers:
        if faers.signal_flag:
            faers_summary = f"Signal detected (PRR={faers.proportional_reporting_ratio:.1f}). Trend: {faers.trend_direction}."
        else:
            faers_summary = f"No significant signal. Trend: {faers.trend_direction}."

    fda_summary = ""
    if fda_signals:
        types = [s.signal_type for s in fda_signals[:3]]
        fda_summary = ", ".join(set(types))
    else:
        fda_summary = "No recent FDA alerts"

    return {
        "rxcui": resolution.rxcui,
        "brand_name": resolution.brand_name,
        "generic_name": resolution.generic_name,
        "drug_class": resolution.drug_class,
        "indication": "See FDA label",
        "manufacturer": "See drug label",
        "approval_year": "N/A",
        "pivot_trial_name": "Pivotal Phase 3 Trial",
        "nnt_trial": None,
        "nnt_realworld": None,
        "arr_trial": None,
        "rrr_trial": None,
        "patent_expiry": "N/A",
        "faers_signals_summary": faers_summary,
        "fda_alerts_summary": fda_summary,
        "active_trials_count": active_trials,
        "industry_trial_count": industry_trials,
        "total_trials": len(trials),
    }


def _compute_score(
    faers: Optional[FAERSSummary],
    trials: List[TrialSummary],
    formulary: List[FormularyCoverage],
    resolution: DrugResolutionResult,
) -> tuple[float, TrustScoreBreakdown]:
    """Calculate trust score from available data."""
    serious_ratio = faers.serious_ratio if faers else 0.0
    signal_flag = faers.signal_flag if faers else False

    completed_p3 = sum(
        1 for t in trials
        if "3" in t.phase and t.status.upper() == "COMPLETED"
    )

    tier1 = sum(1 for f in formulary if f.tier == "1")
    tier2 = sum(1 for f in formulary if f.tier == "2")
    tier3 = sum(1 for f in formulary if f.tier == "3")
    pa_count = sum(1 for f in formulary if f.prior_auth_required)

    return compute_trust_score(
        nnt_trial=None,
        arr_trial=None,
        nnt_realworld=None,
        completed_phase3_trials=completed_p3,
        serious_report_ratio=serious_ratio,
        signal_flag=signal_flag,
        tier1_payers=tier1,
        tier2_payers=tier2,
        tier3_payers=tier3,
        pa_count=pa_count,
    )
