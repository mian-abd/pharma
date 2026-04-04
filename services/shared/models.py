from datetime import datetime, timezone
from typing import List, Optional

from beanie import Document
from pydantic import BaseModel, ConfigDict, Field
from pymongo import IndexModel, ASCENDING, DESCENDING, TEXT


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Embedded Pydantic models
# ---------------------------------------------------------------------------


class TrustScoreBreakdown(BaseModel):
    evidence_quality: float = 0.0
    safety_signal: float = 0.0
    trial_real_gap: float = 0.0
    formulary_access: float = 0.0


class ReactionCount(BaseModel):
    reaction: str
    count: int


# ---------------------------------------------------------------------------
# Drug
# ---------------------------------------------------------------------------


class Drug(Document):
    rxcui: str
    brand_name: str
    generic_name: str
    manufacturer: str = ""
    fda_approval_date: Optional[datetime] = None
    drug_class: str = ""
    indication: str = ""
    patent_expiry: Optional[str] = None
    generic_available: bool = False
    atc_code: Optional[str] = None
    rxnorm_synonyms: List[str] = Field(default_factory=list)

    nnt_trial: Optional[float] = None
    nnt_realworld: Optional[float] = None
    arr_trial: Optional[float] = None
    rrr_trial: Optional[float] = None

    trust_score: float = 0.0
    trust_score_breakdown: TrustScoreBreakdown = Field(default_factory=TrustScoreBreakdown)
    pivot_trial_name: Optional[str] = None

    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)
    data_version: str = "1.0"

    class Settings:
        name = "drugs"
        indexes = [
            IndexModel([("rxcui", ASCENDING)], unique=True),
            IndexModel([("brand_name", TEXT), ("generic_name", TEXT)]),
            IndexModel([("rxnorm_synonyms", ASCENDING)]),
        ]


# ---------------------------------------------------------------------------
# AdverseEventMonthly
# ---------------------------------------------------------------------------


class AdverseEventMonthly(Document):
    drug_rxcui: str
    period_year: int
    period_month: int
    total_reports: int = 0
    serious_reports: int = 0
    fatal_reports: int = 0
    top_reactions: List[ReactionCount] = Field(default_factory=list)
    proportional_reporting_ratio: Optional[float] = None
    trend_direction: Optional[str] = None  # "increasing" | "decreasing" | "stable"
    signal_flag: bool = False
    faers_quarter: str = ""
    created_at: datetime = Field(default_factory=_now)

    class Settings:
        name = "adverse_events"
        indexes = [
            IndexModel(
                [("drug_rxcui", ASCENDING), ("period_year", ASCENDING), ("period_month", ASCENDING)],
                unique=True,
            ),
            IndexModel([("signal_flag", ASCENDING)]),
        ]


# ---------------------------------------------------------------------------
# ClinicalTrial
# ---------------------------------------------------------------------------


class ClinicalTrial(Document):
    nct_id: str
    drug_rxcui: str
    title: str
    phase: str = ""
    status: str = ""
    enrollment: Optional[int] = None
    sponsor: str = ""
    sponsor_type: str = ""
    primary_outcome: str = ""
    primary_outcome_result: Optional[str] = None
    start_date: Optional[datetime] = None
    completion_date: Optional[datetime] = None
    conditions: List[str] = Field(default_factory=list)
    interventions: List[str] = Field(default_factory=list)
    pubmed_ids: List[str] = Field(default_factory=list)
    industry_sponsored: bool = False
    has_results: bool = False
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)

    class Settings:
        name = "clinical_trials"
        indexes = [
            IndexModel([("nct_id", ASCENDING)], unique=True),
            IndexModel([("drug_rxcui", ASCENDING), ("phase", ASCENDING), ("status", ASCENDING)]),
        ]


# ---------------------------------------------------------------------------
# Formulary
# ---------------------------------------------------------------------------


class Formulary(Document):
    drug_rxcui: str
    ndc: Optional[str] = None
    payer_category: str  # "medicare_d" | "medicaid" | "commercial" | "uninsured"
    tier: str = ""
    estimated_copay_low: Optional[float] = None
    estimated_copay_high: Optional[float] = None
    prior_auth_required: bool = False
    step_therapy_required: bool = False
    quantity_limit: Optional[str] = None
    cms_data_quarter: str = ""
    created_at: datetime = Field(default_factory=_now)

    class Settings:
        name = "formulary"
        indexes = [
            IndexModel([("drug_rxcui", ASCENDING), ("payer_category", ASCENDING)], unique=True),
        ]


# ---------------------------------------------------------------------------
# FDASignal
# ---------------------------------------------------------------------------


class FDASignal(Document):
    drug_rxcui: str
    signal_date: datetime
    signal_type: str  # "SAFETY" | "SHORTAGE" | "APPROVAL" | "STUDY"
    title: str
    description: str = ""
    severity: Optional[str] = None
    recall_class: Optional[str] = None
    source_url: Optional[str] = None
    fda_report_number: Optional[str] = None
    is_black_box: bool = False
    created_at: datetime = Field(default_factory=_now)

    class Settings:
        name = "fda_signals"
        indexes = [
            IndexModel([("drug_rxcui", ASCENDING), ("signal_date", DESCENDING)]),
            IndexModel([("signal_type", ASCENDING)]),
        ]


# ---------------------------------------------------------------------------
# RepBrief
# ---------------------------------------------------------------------------


class InputDataSnapshot(BaseModel):
    brand_name: str = ""
    generic_name: str = ""
    drug_class: str = ""
    indication: str = ""
    nnt_trial: Optional[float] = None
    nnt_realworld: Optional[float] = None
    arr_trial: Optional[float] = None
    rrr_trial: Optional[float] = None
    faers_signals_summary: str = ""
    fda_alerts_summary: str = ""
    active_trials_count: int = 0
    industry_trial_count: int = 0
    total_trials: int = 0


class RepBrief(Document):
    model_config = ConfigDict(protected_namespaces=())

    drug_rxcui: str
    model_version: str = "claude-sonnet-4-5"
    will_say: List[str] = Field(default_factory=list)
    reality: List[str] = Field(default_factory=list)
    power_questions: List[str] = Field(default_factory=list)
    study_limitations: str = ""
    pivot_trial_used: Optional[str] = None
    absolute_vs_relative_note: str = ""
    input_data_snapshot: InputDataSnapshot = Field(default_factory=InputDataSnapshot)
    prompt_version: str = "v1.0"
    generation_latency_ms: Optional[int] = None
    expires_at: datetime = Field(default_factory=_now)
    created_at: datetime = Field(default_factory=_now)

    class Settings:
        name = "rep_briefs"
        indexes = [
            IndexModel([("drug_rxcui", ASCENDING)], unique=True),
            IndexModel([("expires_at", ASCENDING)], expireAfterSeconds=0),
        ]


# ---------------------------------------------------------------------------
# All document models for Beanie initialization
# ---------------------------------------------------------------------------

ALL_MODELS = [Drug, AdverseEventMonthly, ClinicalTrial, Formulary, FDASignal, RepBrief]
