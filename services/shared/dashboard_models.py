"""Pydantic models for dashboard snapshot and home payloads."""
from __future__ import annotations

from typing import Dict, List, Optional

from pydantic import BaseModel


class NewsItem(BaseModel):
    title: str
    summary: str
    source: str
    pub_date: str
    source_url: str
    tag: str
    severity: str


class RegulatoryEvent(BaseModel):
    date: str
    event: str
    type: str
    source_url: str
    source: str
    severity: str


class SupplyChainStatus(BaseModel):
    pressure_index: float
    recall_count_90d: int
    shortage_signals: int
    affected_products: List[dict]
    source_status: str


class DashboardAlert(BaseModel):
    title: str
    summary: str
    severity: str
    source: str
    signal_date: Optional[str] = None
    tag: Optional[str] = None


class SourceHealthItem(BaseModel):
    key: str
    label: str
    status: str
    detail: Optional[str] = None


class MarketRegionPoint(BaseModel):
    region: str
    beneficiary_count: int
    total_spend_usd: float
    fill_count: float


class MarketSnapshot(BaseModel):
    data_year: int
    beneficiary_count: int
    total_claims: int
    total_30_day_fills: float
    total_spend_usd: float
    out_of_pocket_spend_usd: float
    yoy_spend_change_pct: float
    yoy_claim_change_pct: float
    top_regions: List[MarketRegionPoint]
    source_status: str


class PublicationSummary(BaseModel):
    pmid: str
    title: str
    journal: str
    pub_date: str
    source_url: str


class EvidenceSnapshot(BaseModel):
    publication_count_12mo: int
    publication_count_5y: int
    literature_velocity_score: float
    active_trials: int
    completed_phase3_trials: int
    has_results_pct: float
    recent_publications: List[PublicationSummary]
    source_status: str


class ApprovalSnapshot(BaseModel):
    sponsor_name: str
    approval_date: Optional[str]
    application_number: Optional[str]
    dosage_form: Optional[str]
    route: Optional[str]
    source_status: str


class PeerComparisonRow(BaseModel):
    rxcui: str
    brand_name: str
    generic_name: str
    drug_class: str
    trust_score: float
    serious_ratio: float
    shortage_active: bool
    black_box: bool
    active_trials: int
    access_score: float
    total_spend_usd: float
    influence_usd: float
    is_subject: bool = False


class PeerComparison(BaseModel):
    benchmark: str
    rationale: str
    rows: List[PeerComparisonRow]


class TrendingDrug(BaseModel):
    name: str
    rxcui: str
    generic_name: str
    drug_class: str
    trend_score: float
    trust_score: float
    faers_reports: int
    publication_count_12mo: int
    market_spend_usd: float
    payments_usd: float
    shortage_active: bool
    trend_reason: str


class FeaturedWatchCard(BaseModel):
    name: str
    rxcui: str
    trust_score: float
    alert_count: int
    summary: str


class MarketMover(BaseModel):
    name: str
    generic_name: str
    market_spend_usd: float
    yoy_spend_change_pct: float
    note: str


class DashboardHome(BaseModel):
    generated_at: str
    ticker_items: List[str]
    source_health: List[SourceHealthItem]
    global_alerts: List[DashboardAlert]
    trending_drugs: List[TrendingDrug]
    featured_watchlist: List[FeaturedWatchCard]
    market_movers: List[MarketMover]


class DrugCommandCenter(BaseModel):
    generated_at: str
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
    trust_score_breakdown: Dict[str, float]
    faers: Optional[dict]
    trials: List[dict]
    formulary: List[dict]
    fda_signals: List[dict]
    rep_brief: Optional[dict]
    source_statuses: Dict[str, str]
    label_history: List[dict]
    shortage_status: Optional[dict]
    market: MarketSnapshot
    evidence: EvidenceSnapshot
    approval: ApprovalSnapshot
    influence: dict
    peer_comparison: PeerComparison
    live_alerts: List[DashboardAlert]
    source_health: List[SourceHealthItem]
    trending_reason: str
