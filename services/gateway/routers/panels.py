"""
Panelized drug data routers.

Each panel endpoint has its own cache key and TTL, enabling independent
loading on the frontend with stale-while-revalidate semantics.

Endpoints:
  GET /api/drug/{rxcui}/core
  GET /api/drug/{rxcui}/safety
  GET /api/drug/{rxcui}/trials
  GET /api/drug/{rxcui}/access
  GET /api/drug/{rxcui}/influence
  GET /api/drug/{rxcui}/ml       (feature-flagged)
"""
import asyncio
import logging
import re
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Path, Query

from services.adverse_events.faers_client import get_6mo_trend
from services.ai_synthesis.trial_predictor import predict_trial_outcomes
from services.clinical_trials.trials_client import get_trials
from services.dailymed.dailymed_client import get_label_history, get_label_metadata
from services.fda_signals.fda_client import get_fda_signals
from services.fda_signals.shortage_client import get_shortage_status
from services.formulary.cms_parser import get_formulary_coverage
from services.open_payments.payments_client import get_influence_panel
from services.shared.cache import cache_get, cache_set, cache_delete
from services.shared.config import settings
from services.shared.drug_name_validation import is_valid_drug_query
from services.shared.panel_models import (
    AccessPanel,
    DrugCorePanel,
    InfluencePanel,
    MLInsightsPanel,
    SafetyPanel,
    TrialsPanel,
    TrialsSummary,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["panels"])

_RXCUI_RE = re.compile(r'^\d+$')


def _validate_rxcui(rxcui: str) -> None:
    if not _RXCUI_RE.match(rxcui):
        raise HTTPException(status_code=400, detail="RXCUI must be numeric.")


# ---------------------------------------------------------------------------
# Core Panel
# ---------------------------------------------------------------------------

@router.get("/drug/{rxcui}/core", response_model=DrugCorePanel)
async def get_core_panel(
    rxcui: str = Path(..., description="Drug RXCUI"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
) -> DrugCorePanel:
    """
    Fast initial paint panel: drug identity, trust score, label metadata.
    Target: <120ms from warm Redis cache.
    """
    _validate_rxcui(rxcui)
    cache_key = f"panel:{rxcui}:core"
    cached = await cache_get(cache_key)

    if cached:
        # Trigger background refresh if approaching stale (TTL < 10 min)
        background_tasks.add_task(_maybe_refresh_core, rxcui, cache_key)
        return DrugCorePanel(**cached)

    panel = await _build_core_panel(rxcui)
    await cache_set(cache_key, panel.model_dump(), ttl=settings.ttl_panels)
    return panel


# ---------------------------------------------------------------------------
# Safety Panel
# ---------------------------------------------------------------------------

@router.get("/drug/{rxcui}/safety", response_model=SafetyPanel)
async def get_safety_panel(
    rxcui: str = Path(..., description="Drug RXCUI"),
    drug_name: str = Query("", description="Drug name for label lookups"),
) -> SafetyPanel:
    """
    FAERS adverse events, FDA signals, DailyMed label history, shortage status.
    """
    _validate_rxcui(rxcui)
    if drug_name and not is_valid_drug_query(drug_name.strip()):
        raise HTTPException(status_code=400, detail="Invalid drug name.")

    cache_key = f"panel:{rxcui}:safety"
    cached = await cache_get(cache_key)
    if cached:
        return SafetyPanel(**cached)

    panel = await _build_safety_panel(rxcui, drug_name or rxcui)
    await cache_set(cache_key, panel.model_dump(), ttl=settings.ttl_panels)
    return panel


# ---------------------------------------------------------------------------
# Trials Panel
# ---------------------------------------------------------------------------

@router.get("/drug/{rxcui}/trials", response_model=TrialsPanel)
async def get_trials_panel(
    rxcui: str = Path(..., description="Drug RXCUI"),
    drug_name: str = Query("", description="Drug name"),
) -> TrialsPanel:
    """
    Clinical trials board with phase/status summary metrics.
    """
    _validate_rxcui(rxcui)
    cache_key = f"panel:{rxcui}:trials"
    cached = await cache_get(cache_key)
    if cached:
        return TrialsPanel(**cached)

    panel = await _build_trials_panel(rxcui, drug_name or rxcui)
    await cache_set(cache_key, panel.model_dump(), ttl=settings.ttl_panels)
    return panel


# ---------------------------------------------------------------------------
# Access Panel (Formulary)
# ---------------------------------------------------------------------------

@router.get("/drug/{rxcui}/access", response_model=AccessPanel)
async def get_access_panel(
    rxcui: str = Path(..., description="Drug RXCUI"),
    drug_name: str = Query("", description="Drug name"),
) -> AccessPanel:
    """
    Formulary tier, prior auth, step therapy across payer types.
    """
    _validate_rxcui(rxcui)
    cache_key = f"panel:{rxcui}:access"
    cached = await cache_get(cache_key)
    if cached:
        return AccessPanel(**cached)

    panel = await _build_access_panel(rxcui, drug_name or rxcui)
    await cache_set(cache_key, panel.model_dump(), ttl=settings.ttl_formulary)
    return panel


# ---------------------------------------------------------------------------
# Influence Panel (Open Payments)
# ---------------------------------------------------------------------------

@router.get("/drug/{rxcui}/influence", response_model=InfluencePanel)
async def get_influence_panel_endpoint(
    rxcui: str = Path(..., description="Drug RXCUI"),
    drug_name: str = Query("", description="Drug name"),
    drug_class: str = Query("", description="Drug class for payment profile"),
) -> InfluencePanel:
    """
    CMS Open Payments / Sunshine Act aggregated influence data.
    Shows pharma payments to physicians by specialty and company.
    """
    if not settings.feature_open_payments:
        raise HTTPException(status_code=404, detail="Open Payments feature not enabled.")

    _validate_rxcui(rxcui)
    cache_key = f"panel:{rxcui}:influence"
    cached = await cache_get(cache_key)
    if cached:
        return InfluencePanel(**cached)

    panel = await get_influence_panel(rxcui, drug_name or rxcui, drug_class)
    await cache_set(cache_key, panel.model_dump(), ttl=settings.ttl_influence)
    return panel


# ---------------------------------------------------------------------------
# ML Insights Panel (feature-flagged)
# ---------------------------------------------------------------------------

@router.get("/drug/{rxcui}/ml", response_model=MLInsightsPanel)
async def get_ml_panel(
    rxcui: str = Path(..., description="Drug RXCUI"),
    drug_name: str = Query("", description="Drug name"),
    drug_class: str = Query("", description="Drug class"),
) -> MLInsightsPanel:
    """
    ML insights: trial success probability predictions and similar drugs.
    Feature-flagged via FEATURE_ML_INSIGHTS env var.
    """
    _validate_rxcui(rxcui)
    cache_key = f"panel:{rxcui}:ml"
    cached = await cache_get(cache_key)
    if cached:
        return MLInsightsPanel(**cached)

    if not settings.feature_ml_insights:
        panel = MLInsightsPanel(
            rxcui=rxcui, trial_predictions=[], similar_drugs=[], feature_flag_enabled=False
        )
        await cache_set(cache_key, panel.model_dump(), ttl=settings.ttl_panels)
        return panel

    trials = await get_trials(rxcui, drug_name or rxcui)
    panel = predict_trial_outcomes(
        [t.model_dump() for t in trials], rxcui, drug_class
    )
    await cache_set(cache_key, panel.model_dump(), ttl=settings.ttl_panels)
    return panel


# ---------------------------------------------------------------------------
# Panel build helpers
# ---------------------------------------------------------------------------

async def _build_core_panel(rxcui: str) -> DrugCorePanel:
    """Build the core panel; pulls from RxNorm cache and label metadata."""
    # Try to get from existing bundle cache first
    bundle_data = await cache_get(f"drug:{rxcui}:bundle")
    label_meta = await get_label_metadata(rxcui, rxcui)

    if bundle_data:
        trust_score = bundle_data.get("trust_score", 0.0)
        breakdown = bundle_data.get("trust_score_breakdown", {})
        faers = bundle_data.get("faers") or {}
        shortage = await get_shortage_status(rxcui, bundle_data.get("drug_name", rxcui))
        return DrugCorePanel(
            rxcui=rxcui,
            brand_name=bundle_data.get("brand_name", ""),
            generic_name=bundle_data.get("generic_name", ""),
            manufacturer=label_meta.get("manufacturer") or bundle_data.get("manufacturer", ""),
            drug_class=bundle_data.get("drug_class", ""),
            indication=label_meta.get("indication") or bundle_data.get("indication", ""),
            atc_code=None,
            patent_expiry=bundle_data.get("patent_expiry"),
            synonyms=[],
            approval_date=label_meta.get("approval_date"),
            nnt_trial=bundle_data.get("nnt_trial"),
            nnt_realworld=bundle_data.get("nnt_realworld"),
            arr_trial=bundle_data.get("arr_trial"),
            rrr_trial=bundle_data.get("rrr_trial"),
            pivot_trial_name=bundle_data.get("pivot_trial_name"),
            trust_score=trust_score,
            trust_score_breakdown=breakdown,
            label_update_count=label_meta.get("update_count", 0),
            label_last_updated=label_meta.get("last_updated"),
            has_black_box=label_meta.get("has_black_box", False) or faers.get("signal_flag", False),
            shortage_active=shortage.status == "active",
            source_status="live",
        )

    # Minimal fallback
    shortage = await get_shortage_status(rxcui, rxcui)
    return DrugCorePanel(
        rxcui=rxcui,
        brand_name="",
        generic_name="",
        manufacturer=label_meta.get("manufacturer", ""),
        drug_class="",
        indication=label_meta.get("indication", ""),
        atc_code=None,
        patent_expiry=None,
        synonyms=[],
        approval_date=label_meta.get("approval_date"),
        nnt_trial=None,
        nnt_realworld=None,
        arr_trial=None,
        rrr_trial=None,
        pivot_trial_name=None,
        trust_score=0.0,
        trust_score_breakdown={},
        label_update_count=label_meta.get("update_count", 0),
        label_last_updated=label_meta.get("last_updated"),
        has_black_box=label_meta.get("has_black_box", False),
        shortage_active=shortage.status == "active",
        source_status="partial",
    )


async def _build_safety_panel(rxcui: str, drug_name: str) -> SafetyPanel:
    """Build safety panel in parallel: FAERS + FDA signals + label history + shortage."""
    faers_task = asyncio.create_task(get_6mo_trend(rxcui, drug_name))
    signals_task = asyncio.create_task(get_fda_signals(rxcui, drug_name))
    history_task = asyncio.create_task(get_label_history(rxcui, drug_name))
    shortage_task = asyncio.create_task(get_shortage_status(rxcui, drug_name))

    faers_result, signals_result, history_result, shortage_result = await asyncio.gather(
        faers_task, signals_task, history_task, shortage_task,
        return_exceptions=True,
    )

    statuses: dict = {}
    faers_data = None
    if not isinstance(faers_result, Exception):
        faers_data = faers_result.model_dump() if faers_result else None
        statuses["faers"] = "live"
    else:
        statuses["faers"] = "unavailable"
        logger.error("FAERS error in safety panel: %s", faers_result)

    signals = []
    if not isinstance(signals_result, Exception):
        signals = [s.model_dump() for s in (signals_result or [])]
        statuses["fda_signals"] = "live"
    else:
        statuses["fda_signals"] = "unavailable"

    history = []
    if not isinstance(history_result, Exception):
        history = [h.model_dump() for h in (history_result or [])]
        statuses["label_history"] = "live"
    else:
        statuses["label_history"] = "unavailable"

    shortage = None
    if not isinstance(shortage_result, Exception) and shortage_result:
        shortage = shortage_result.model_dump()
        statuses["shortage"] = "live"
    else:
        statuses["shortage"] = "unavailable"

    return SafetyPanel(
        rxcui=rxcui,
        faers=faers_data,
        fda_signals=signals,
        label_history=history,
        shortage_status=shortage,
        source_statuses=statuses,
    )


async def _build_trials_panel(rxcui: str, drug_name: str) -> TrialsPanel:
    """Build trials panel with computed summary metrics."""
    try:
        trials = await get_trials(rxcui, drug_name)
        total = len(trials)
        active = sum(1 for t in trials if t.status.upper() in ("RECRUITING", "ACTIVE, NOT RECRUITING", "ACTIVE"))
        completed = sum(1 for t in trials if t.status.upper() == "COMPLETED")
        phase3 = sum(1 for t in trials if "3" in t.phase and t.status.upper() == "COMPLETED")
        industry = sum(1 for t in trials if t.industry_sponsored)
        has_results = sum(1 for t in trials if t.has_results)

        summary = TrialsSummary(
            total=total,
            active=active,
            completed=completed,
            phase3_completed=phase3,
            industry_pct=round((industry / total * 100) if total > 0 else 0.0, 1),
            has_results_pct=round((has_results / total * 100) if total > 0 else 0.0, 1),
        )

        return TrialsPanel(
            rxcui=rxcui,
            trials=[t.model_dump() for t in trials],
            summary=summary,
            source_status="live",
        )
    except Exception as exc:
        logger.error("Trials panel build error: %s", exc)
        return TrialsPanel(
            rxcui=rxcui,
            trials=[],
            summary=TrialsSummary(total=0, active=0, completed=0, phase3_completed=0, industry_pct=0.0, has_results_pct=0.0),
            source_status="unavailable",
        )


async def _build_access_panel(rxcui: str, drug_name: str) -> AccessPanel:
    """Build formulary access panel with tier distribution metrics."""
    try:
        formulary = await get_formulary_coverage(rxcui, drug_name)
        tier_dist: dict = {}
        pa_count = 0
        step_count = 0

        for fc in formulary:
            tier_dist[fc.tier] = tier_dist.get(fc.tier, 0) + 1
            if fc.prior_auth_required:
                pa_count += 1
            if fc.step_therapy_required:
                step_count += 1

        n = len(formulary)
        return AccessPanel(
            rxcui=rxcui,
            formulary=[f.model_dump() for f in formulary],
            pa_rate=round(pa_count / n if n else 0.0, 2),
            step_therapy_rate=round(step_count / n if n else 0.0, 2),
            tier_distribution=tier_dist,
            source_status="live",
        )
    except Exception as exc:
        logger.error("Access panel build error: %s", exc)
        return AccessPanel(
            rxcui=rxcui, formulary=[], pa_rate=0.0,
            step_therapy_rate=0.0, tier_distribution={}, source_status="unavailable",
        )


async def _maybe_refresh_core(rxcui: str, cache_key: str) -> None:
    """Background task: proactively refresh core panel if stale."""
    try:
        panel = await _build_core_panel(rxcui)
        await cache_set(cache_key, panel.model_dump(), ttl=settings.ttl_panels)
    except Exception as exc:
        logger.debug("Background core refresh failed for rxcui=%s: %s", rxcui, exc)
