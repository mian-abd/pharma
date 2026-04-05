"""ClinicalTrials.gov API v2 client for trial data retrieval and filtering."""
import logging
from datetime import datetime, timezone
from typing import List, Optional

from pydantic import BaseModel

from services.shared.cache import cache_get, cache_set
from services.shared.config import settings
from services.shared.http_client import fetch_with_retry

logger = logging.getLogger(__name__)

CTGOV_BASE = settings.clinicaltrials_base_url

_FIELDS = ",".join([
    "NCTId", "BriefTitle", "Phase", "OverallStatus", "EnrollmentCount",
    "LeadSponsorName", "LeadSponsorClass", "PrimaryOutcomeMeasure",
    "PrimaryOutcomeDescription", "StartDate", "PrimaryCompletionDate",
    "Condition", "InterventionName", "HasResults",
])


class TrialSummary(BaseModel):
    nct_id: str
    title: str
    phase: str
    status: str
    enrollment: Optional[int]
    sponsor: str
    industry_sponsored: bool
    primary_outcome: str
    primary_outcome_result: Optional[str]
    start_date: Optional[str]
    completion_date: Optional[str]
    conditions: List[str]
    interventions: List[str]
    has_results: bool


async def get_trials(rxcui: str, drug_name: str) -> List[TrialSummary]:
    """
    Fetch all registered clinical trials for a drug from ClinicalTrials.gov v2.
    Cached for 24 hours.
    """
    cache_key = f"drug:{rxcui}:trials"
    cached = await cache_get(cache_key)
    if cached is not None:
        return [TrialSummary(**t) for t in cached]

    url = f"{CTGOV_BASE}/studies"
    params = {
        "query.intr": drug_name,
        "pageSize": "20",
        "fields": _FIELDS,
    }
    data = await fetch_with_retry(url, params=params, max_retries=1, base_delay=0.2, timeout_seconds=4.0)
    trials: List[TrialSummary] = []

    if data:
        studies = data.get("studies", [])
        for study in studies:
            proto = study.get("protocolSection", {})
            trial = _parse_study(proto)
            if trial:
                trials.append(trial)

    await cache_set(cache_key, [t.model_dump() for t in trials], ttl=settings.ttl_trials)
    return trials


def _parse_study(proto: dict) -> Optional[TrialSummary]:
    """Parse a ClinicalTrials.gov v2 study protocol section into a TrialSummary."""
    try:
        id_mod = proto.get("identificationModule", {})
        status_mod = proto.get("statusModule", {})
        design_mod = proto.get("designModule", {})
        sponsor_mod = proto.get("sponsorCollaboratorsModule", {})
        outcomes_mod = proto.get("outcomesModule", {})
        conds_mod = proto.get("conditionsModule", {})
        interventions_mod = proto.get("armsInterventionsModule", {})

        nct_id = id_mod.get("nctId", "")
        if not nct_id:
            return None

        sponsor_info = sponsor_mod.get("leadSponsor", {})
        sponsor_class = sponsor_info.get("sponsorClass", "")
        industry_sponsored = sponsor_class.upper() == "INDUSTRY"

        primary_outcomes = outcomes_mod.get("primaryOutcomes", [])
        primary_outcome = primary_outcomes[0].get("measure", "") if primary_outcomes else ""

        interventions = interventions_mod.get("interventions", [])
        intervention_names = [i.get("name", "") for i in interventions if i.get("name")]

        return TrialSummary(
            nct_id=nct_id,
            title=id_mod.get("briefTitle", ""),
            phase=", ".join(design_mod.get("phases", [])),
            status=status_mod.get("overallStatus", ""),
            enrollment=design_mod.get("enrollmentInfo", {}).get("count"),
            sponsor=sponsor_info.get("name", ""),
            industry_sponsored=industry_sponsored,
            primary_outcome=primary_outcome,
            primary_outcome_result=None,  # Fetched separately for completed trials
            start_date=status_mod.get("startDateStruct", {}).get("date"),
            completion_date=status_mod.get("primaryCompletionDateStruct", {}).get("date"),
            conditions=conds_mod.get("conditions", []),
            interventions=intervention_names,
            has_results=study_has_results(proto),
        )
    except Exception as exc:
        logger.warning("Failed to parse study: %s", exc)
        return None


def study_has_results(proto: dict) -> bool:
    """Check if study has posted results."""
    results_section = proto.get("resultsSection", {})
    return bool(results_section)


def filter_trials(
    trials: List[TrialSummary],
    phases: Optional[List[str]] = None,
    statuses: Optional[List[str]] = None,
    industry_only: Optional[bool] = None,
) -> List[TrialSummary]:
    """Filter trials by phase, status, and/or sponsor type."""
    result = trials
    if phases:
        phases_lower = [p.lower() for p in phases]
        result = [t for t in result if any(p in t.phase.lower() for p in phases_lower)]
    if statuses:
        statuses_lower = [s.lower() for s in statuses]
        result = [t for t in result if t.status.lower() in statuses_lower]
    if industry_only is not None:
        result = [t for t in result if t.industry_sponsored == industry_only]
    return result
