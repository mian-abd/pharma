// PharmaCortex TypeScript interfaces

// ------------------------------------------------------------------ shared --
export interface TrustScoreBreakdown {
  evidence_quality: number;
  safety_signal: number;
  trial_real_gap: number;
  formulary_access: number;
}

export interface ReactionCount {
  reaction: string;
  count: number;
}

// ------------------------------------------------------------------ FAERS ---
export interface FAERSMonthlyData {
  year: number;
  month: number;
  total: number;
  serious: number;
  fatal: number;
}

export interface FAERSData {
  drug_rxcui: string;
  drug_name: string;
  monthly_data: FAERSMonthlyData[];
  top_reactions: ReactionCount[];
  proportional_reporting_ratio: number | null;
  signal_flag: boolean;
  trend_direction: 'increasing' | 'decreasing' | 'stable';
  total_6mo_reports: number;
  serious_6mo_reports: number;
  serious_ratio: number;
}

// ---------------------------------------------------------------- Trials ----
export interface TrialData {
  nct_id: string;
  title: string;
  phase: string;
  status: string;
  enrollment: number | null;
  sponsor: string;
  industry_sponsored: boolean;
  primary_outcome: string;
  primary_outcome_result: string | null;
  start_date: string | null;
  completion_date: string | null;
  conditions: string[];
  interventions: string[];
  has_results: boolean;
}

export interface TrialsSummary {
  total: number;
  active: number;
  completed: number;
  phase3_completed: number;
  industry_pct: number;
  has_results_pct: number;
}

// ------------------------------------------------------------- Formulary ----
export interface FormularyData {
  drug_rxcui: string;
  payer_category: 'medicare_d' | 'medicaid' | 'commercial' | 'uninsured';
  tier: string;
  estimated_copay_low: number | null;
  estimated_copay_high: number | null;
  prior_auth_required: boolean;
  step_therapy_required: boolean;
  quantity_limit: string | null;
  cms_data_quarter: string;
}

// ------------------------------------------------------------- FDA Signal ---
export interface FDASignalData {
  drug_rxcui: string;
  signal_date: string;
  signal_type: 'SAFETY' | 'SHORTAGE' | 'APPROVAL' | 'STUDY';
  title: string;
  description: string;
  severity: string | null;
  recall_class: string | null;
  source_url: string | null;
  fda_report_number: string | null;
  is_black_box: boolean;
}

// ----------------------------------------------------------- Label History --
export interface LabelHistoryItem {
  version: number;
  published_date: string;
  change_type: string | null;
  description: string | null;
}

// -------------------------------------------------------------- Shortage ----
export interface ShortageStatus {
  drug_name: string;
  status: 'active' | 'resolved' | 'none';
  reason: string | null;
  resolution_date: string | null;
  source_url: string | null;
}

// ---------------------------------------------------------- Rep Brief -------
export interface RepBriefData {
  will_say: string[];
  reality: string[];
  power_questions: string[];
  study_limitations: string;
  pivot_trial_used: string | null;
  absolute_vs_relative_note: string;
  generation_latency_ms: number | null;
}

// ---------------------------------------------------------- Bundle (legacy) -
export interface DrugBundle {
  drug_name: string;
  rxcui: string;
  brand_name: string;
  generic_name: string;
  manufacturer: string;
  drug_class: string;
  indication: string;
  patent_expiry: string | null;
  nnt_trial: number | null;
  nnt_realworld: number | null;
  arr_trial: number | null;
  rrr_trial: number | null;
  pivot_trial_name: string | null;
  trust_score: number;
  trust_score_breakdown: TrustScoreBreakdown;
  faers: FAERSData | null;
  trials: TrialData[];
  formulary: FormularyData[];
  fda_signals: FDASignalData[];
  rep_brief: RepBriefData | null;
  source_statuses: Record<string, 'live' | 'degraded' | 'unavailable'>;
}

// ------------------------------------------------------- Panelized types ----

export interface DrugCorePanel {
  rxcui: string;
  brand_name: string;
  generic_name: string;
  manufacturer: string;
  drug_class: string;
  indication: string;
  atc_code: string | null;
  patent_expiry: string | null;
  synonyms: string[];
  approval_date: string | null;
  nnt_trial: number | null;
  nnt_realworld: number | null;
  arr_trial: number | null;
  rrr_trial: number | null;
  pivot_trial_name: string | null;
  trust_score: number;
  trust_score_breakdown: Record<string, number>;
  label_update_count: number;
  label_last_updated: string | null;
  has_black_box: boolean;
  shortage_active: boolean;
  source_status: string;
}

export interface SafetyPanel {
  rxcui: string;
  faers: FAERSData | null;
  fda_signals: FDASignalData[];
  label_history: LabelHistoryItem[];
  shortage_status: ShortageStatus | null;
  source_statuses: Record<string, string>;
}

export interface TrialsPanel {
  rxcui: string;
  trials: TrialData[];
  summary: TrialsSummary;
  source_status: string;
}

export interface AccessPanel {
  rxcui: string;
  formulary: FormularyData[];
  pa_rate: number;
  step_therapy_rate: number;
  tier_distribution: Record<string, number>;
  source_status: string;
}

export interface InfluenceSpecialty {
  specialty: string;
  total_usd: number;
  hcp_count: number;
  avg_payment_usd: number;
  speaker_fee_pct: number;
}

export interface InfluenceCompany {
  company: string;
  total_usd: number;
  hcp_count: number;
}

export interface InfluenceYearlyTrend {
  year: number;
  total_usd: number;
  hcp_count: number;
}

export interface InfluencePanel {
  rxcui: string;
  drug_name: string;
  total_payments_usd: number;
  hcp_count: number;
  company_count: number;
  top_specialties: InfluenceSpecialty[];
  top_companies: InfluenceCompany[];
  payment_types: Array<{ type: string; total_usd: number; pct: number }>;
  yearly_trend: InfluenceYearlyTrend[];
  data_year: number;
  source_status: string;
}

export interface TrialPrediction {
  trial_nct_id: string;
  trial_title: string;
  success_probability: number;
  confidence: 'high' | 'medium' | 'low';
  key_factors: string[];
}

export interface MLInsightsPanel {
  rxcui: string;
  trial_predictions: TrialPrediction[];
  similar_drugs: Array<{
    rxcui: string;
    brand_name: string;
    generic_name: string;
    drug_class: string;
    similarity_reason: string;
  }>;
  feature_flag_enabled: boolean;
}

// ---------------------------------------------------------------- misc ------
export interface AutocompleteResult {
  suggestions: string[];
}

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'down';
  apis: Record<string, 'live' | 'degraded' | 'down'>;
  version: string;
}

export interface DashboardAlert {
  title: string;
  summary: string;
  severity: string;
  source: string;
  signal_date: string | null;
  tag: string | null;
}

export interface SourceHealthItem {
  key: string;
  label: string;
  status: string;
  detail: string | null;
}

export interface MarketRegionPoint {
  region: string;
  beneficiary_count: number;
  total_spend_usd: number;
  fill_count: number;
}

export interface MarketSnapshot {
  data_year: number;
  beneficiary_count: number;
  total_claims: number;
  total_30_day_fills: number;
  total_spend_usd: number;
  out_of_pocket_spend_usd: number;
  yoy_spend_change_pct: number;
  yoy_claim_change_pct: number;
  top_regions: MarketRegionPoint[];
  source_status: string;
}

export interface PublicationSummary {
  pmid: string;
  title: string;
  journal: string;
  pub_date: string;
  source_url: string;
}

export interface EvidenceSnapshot {
  publication_count_12mo: number;
  publication_count_5y: number;
  literature_velocity_score: number;
  active_trials: number;
  completed_phase3_trials: number;
  has_results_pct: number;
  recent_publications: PublicationSummary[];
  source_status: string;
}

export interface ApprovalSnapshot {
  sponsor_name: string;
  approval_date: string | null;
  application_number: string | null;
  dosage_form: string | null;
  route: string | null;
  source_status: string;
}

export interface PeerComparisonRow {
  rxcui: string;
  brand_name: string;
  generic_name: string;
  drug_class: string;
  trust_score: number;
  serious_ratio: number;
  shortage_active: boolean;
  black_box: boolean;
  active_trials: number;
  access_score: number;
  total_spend_usd: number;
  influence_usd: number;
  is_subject: boolean;
}

export interface PeerComparison {
  benchmark: string;
  rationale: string;
  rows: PeerComparisonRow[];
}

export interface TrendingDrug {
  name: string;
  rxcui: string;
  generic_name: string;
  drug_class: string;
  trend_score: number;
  trust_score: number;
  faers_reports: number;
  publication_count_12mo: number;
  market_spend_usd: number;
  payments_usd: number;
  shortage_active: boolean;
  trend_reason: string;
}

export interface FeaturedWatchCard {
  name: string;
  rxcui: string;
  trust_score: number;
  alert_count: number;
  summary: string;
}

export interface MarketMover {
  name: string;
  generic_name: string;
  market_spend_usd: number;
  yoy_spend_change_pct: number;
  note: string;
}

export interface NewsItem {
  title: string;
  summary: string;
  source: string;
  pub_date: string;
  source_url: string;
  tag: string;
  severity: string;
}

export interface RegulatoryEvent {
  date: string;
  event: string;
  type: string;
  source_url: string;
  source: string;
  severity: string;
}

export interface SupplyChainAffected {
  name: string;
  classification: string;
  reason: string;
  date: string;
  is_shortage: boolean;
}

export interface SupplyChainData {
  pressure_index: number;
  recall_count_90d: number;
  shortage_signals: number;
  affected_products: SupplyChainAffected[];
  source_status: string;
}

export interface DashboardHome {
  generated_at: string;
  ticker_items: string[];
  source_health: SourceHealthItem[];
  global_alerts: DashboardAlert[];
  trending_drugs: TrendingDrug[];
  featured_watchlist: FeaturedWatchCard[];
  market_movers: MarketMover[];
}

export interface DrugCommandCenter extends DrugBundle {
  generated_at: string;
  label_history: LabelHistoryItem[];
  shortage_status: ShortageStatus | null;
  market: MarketSnapshot;
  evidence: EvidenceSnapshot;
  approval: ApprovalSnapshot;
  influence: InfluencePanel;
  peer_comparison: PeerComparison;
  live_alerts: DashboardAlert[];
  source_health: SourceHealthItem[];
  trending_reason: string;
}
