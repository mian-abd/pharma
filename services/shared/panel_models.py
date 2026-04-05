"""Panel-specific Pydantic DTOs for the panelized API architecture."""
from typing import Any, Dict, List, Optional
from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Drug Core Panel
# ---------------------------------------------------------------------------

class DrugCorePanel(BaseModel):
    rxcui: str
    brand_name: str
    generic_name: str
    manufacturer: str
    drug_class: str
    indication: str
    atc_code: Optional[str]
    patent_expiry: Optional[str]
    synonyms: List[str]
    approval_date: Optional[str]
    nnt_trial: Optional[float]
    nnt_realworld: Optional[float]
    arr_trial: Optional[float]
    rrr_trial: Optional[float]
    pivot_trial_name: Optional[str]
    trust_score: float
    trust_score_breakdown: Dict[str, float]
    label_update_count: int
    label_last_updated: Optional[str]
    has_black_box: bool
    shortage_active: bool
    source_status: str


# ---------------------------------------------------------------------------
# Safety Panel
# ---------------------------------------------------------------------------

class SafetyPanel(BaseModel):
    rxcui: str
    faers: Optional[Dict[str, Any]]
    fda_signals: List[Dict[str, Any]]
    label_history: List[Dict[str, Any]]
    shortage_status: Optional[Dict[str, Any]]
    source_statuses: Dict[str, str]


# ---------------------------------------------------------------------------
# Trials Panel
# ---------------------------------------------------------------------------

class TrialsSummary(BaseModel):
    total: int
    active: int
    completed: int
    phase3_completed: int
    industry_pct: float
    has_results_pct: float


class TrialsPanel(BaseModel):
    rxcui: str
    trials: List[Dict[str, Any]]
    summary: TrialsSummary
    source_status: str


# ---------------------------------------------------------------------------
# Access Panel (Formulary + Payer)
# ---------------------------------------------------------------------------

class AccessPanel(BaseModel):
    rxcui: str
    formulary: List[Dict[str, Any]]
    pa_rate: float
    step_therapy_rate: float
    tier_distribution: Dict[str, int]
    source_status: str


# ---------------------------------------------------------------------------
# Influence Panel (Open Payments / Sunshine Act)
# ---------------------------------------------------------------------------

class InfluencePanel(BaseModel):
    rxcui: str
    drug_name: str
    total_payments_usd: float
    hcp_count: int
    company_count: int
    top_specialties: List[Dict[str, Any]]
    top_companies: List[Dict[str, Any]]
    payment_types: List[Dict[str, Any]]
    yearly_trend: List[Dict[str, Any]]
    data_year: int
    source_status: str


# ---------------------------------------------------------------------------
# Label History Item
# ---------------------------------------------------------------------------

class LabelHistoryItem(BaseModel):
    version: int
    published_date: str
    change_type: Optional[str]
    description: Optional[str]


# ---------------------------------------------------------------------------
# Shortage Status
# ---------------------------------------------------------------------------

class ShortageStatus(BaseModel):
    drug_name: str
    status: str   # "active" | "resolved" | "none"
    reason: Optional[str]
    resolution_date: Optional[str]
    source_url: Optional[str]


# ---------------------------------------------------------------------------
# ML Insights Panel (Phase 2)
# ---------------------------------------------------------------------------

class TrialPrediction(BaseModel):
    trial_nct_id: str
    trial_title: str
    success_probability: float
    confidence: str   # "high" | "medium" | "low"
    key_factors: List[str]


class SimilarDrug(BaseModel):
    rxcui: str
    brand_name: str
    generic_name: str
    drug_class: str
    similarity_reason: str


class MLInsightsPanel(BaseModel):
    rxcui: str
    trial_predictions: List[TrialPrediction]
    similar_drugs: List[SimilarDrug]
    feature_flag_enabled: bool
