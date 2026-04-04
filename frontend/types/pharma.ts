// PharmaCortex TypeScript interfaces -- matching backend DrugBundle response

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

export interface RepBriefData {
  will_say: string[];
  reality: string[];
  power_questions: string[];
  study_limitations: string;
  pivot_trial_used: string | null;
  absolute_vs_relative_note: string;
  generation_latency_ms: number | null;
}

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

export interface AutocompleteResult {
  suggestions: string[];
}

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'down';
  apis: Record<string, 'live' | 'degraded' | 'down'>;
  version: string;
}
