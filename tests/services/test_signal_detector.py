"""Tests for PRR calculation and trend detection."""
import pytest
from services.adverse_events.signal_detector import (
    calculate_prr,
    detect_trend,
    is_signal,
    compute_serious_ratio,
)


class TestCalculatePRR:
    def test_normal_prr(self):
        prr = calculate_prr(50, 1000, 500, 100000)
        # drug_proportion = 50/1000 = 0.05
        # background = 500/100000 = 0.005
        # PRR = 0.05/0.005 = 10.0
        assert abs(prr - 10.0) < 0.01

    def test_zero_total_drug_reports_returns_none(self):
        assert calculate_prr(5, 0, 500, 100000) is None

    def test_zero_all_reports_returns_none(self):
        assert calculate_prr(5, 100, 500, 0) is None

    def test_zero_background_returns_none(self):
        assert calculate_prr(5, 100, 0, 100000) is None

    def test_prr_below_threshold(self):
        prr = calculate_prr(10, 1000, 100, 10000)
        # Both proportions are 0.01, PRR = 1.0
        assert abs(prr - 1.0) < 0.01


class TestIsSignal:
    def test_signal_above_threshold(self):
        assert is_signal(3.5, 10) is True

    def test_no_signal_low_prr(self):
        assert is_signal(1.5, 10) is False

    def test_no_signal_low_count(self):
        assert is_signal(3.5, 2) is False

    def test_no_signal_none_prr(self):
        assert is_signal(None, 10) is False


class TestDetectTrend:
    def test_increasing_trend(self):
        # Recent months much higher than prior
        counts = [10, 12, 11, 50, 55, 60]
        assert detect_trend(counts) == "increasing"

    def test_decreasing_trend(self):
        counts = [50, 55, 60, 10, 12, 11]
        assert detect_trend(counts) == "decreasing"

    def test_stable_trend(self):
        counts = [10, 11, 10, 11, 10, 11]
        assert detect_trend(counts) == "stable"

    def test_too_few_months(self):
        assert detect_trend([10, 20, 15]) == "stable"


class TestSeriousRatio:
    def test_normal_ratio(self):
        assert compute_serious_ratio(30, 100) == 0.3

    def test_zero_total(self):
        assert compute_serious_ratio(0, 0) == 0.0


class TestTrialFilter:
    def test_filter_by_phase(self):
        from services.clinical_trials.trials_client import filter_trials, TrialSummary
        trials = [
            TrialSummary(nct_id="NCT001", title="Trial A", phase="PHASE3", status="COMPLETED",
                         enrollment=500, sponsor="Pfizer", industry_sponsored=True,
                         primary_outcome="HbA1c", primary_outcome_result=None,
                         start_date=None, completion_date=None, conditions=[], interventions=[], has_results=True),
            TrialSummary(nct_id="NCT002", title="Trial B", phase="PHASE2", status="RECRUITING",
                         enrollment=100, sponsor="NIH", industry_sponsored=False,
                         primary_outcome="BP", primary_outcome_result=None,
                         start_date=None, completion_date=None, conditions=[], interventions=[], has_results=False),
        ]
        p3_trials = filter_trials(trials, phases=["phase3"])
        assert len(p3_trials) == 1
        assert p3_trials[0].nct_id == "NCT001"

    def test_filter_by_status(self):
        from services.clinical_trials.trials_client import filter_trials, TrialSummary
        trials = [
            TrialSummary(nct_id="NCT001", title="A", phase="PHASE3", status="COMPLETED",
                         enrollment=None, sponsor="S", industry_sponsored=True,
                         primary_outcome="", primary_outcome_result=None,
                         start_date=None, completion_date=None, conditions=[], interventions=[], has_results=False),
            TrialSummary(nct_id="NCT002", title="B", phase="PHASE2", status="RECRUITING",
                         enrollment=None, sponsor="S", industry_sponsored=False,
                         primary_outcome="", primary_outcome_result=None,
                         start_date=None, completion_date=None, conditions=[], interventions=[], has_results=False),
        ]
        completed = filter_trials(trials, statuses=["completed"])
        assert len(completed) == 1
        assert completed[0].nct_id == "NCT001"


class TestFDAClassification:
    def test_recall_classified_as_safety(self):
        from services.fda_signals.fda_client import _classify_recall
        item = {"classification": "Class I", "reason_for_recall": "contamination"}
        assert _classify_recall(item) == "SAFETY"

    def test_shortage_classified(self):
        from services.fda_signals.fda_client import _classify_recall
        item = {"classification": "", "reason_for_recall": "drug shortage reported"}
        assert _classify_recall(item) == "SHORTAGE"

    def test_has_black_box(self):
        from services.fda_signals.fda_client import _has_black_box
        label = {"boxed_warning": ["WARNING: Serious cardiovascular events"]}
        assert _has_black_box(label) is True

    def test_no_black_box(self):
        from services.fda_signals.fda_client import _has_black_box
        label = {"indications_and_usage": ["For treatment of..."]}
        assert _has_black_box(label) is False


class TestCMSParser:
    def test_tier_copay_map(self):
        from services.formulary.cms_parser import _TIER_COPAY_MAP
        assert "1" in _TIER_COPAY_MAP
        assert "6" in _TIER_COPAY_MAP
        assert _TIER_COPAY_MAP["1"][0] <= _TIER_COPAY_MAP["1"][1]

    def test_estimated_coverage_returns_4_payers(self):
        from services.formulary.cms_parser import _get_estimated_coverage
        coverage = _get_estimated_coverage("857005")
        assert len(coverage) == 4
        payers = {c.payer_category for c in coverage}
        assert "medicare_d" in payers
        assert "medicaid" in payers
        assert "commercial" in payers
        assert "uninsured" in payers

    def test_parse_cms_csv_missing_rxcui_column(self):
        import io
        from services.formulary.cms_parser import parse_cms_csv
        csv_data = b"DRUG_NAME,TIER\nOzempic,3\n"
        result = parse_cms_csv(csv_data, "857005")
        # Falls back to estimated coverage
        assert len(result) == 4


class TestRepBriefPrompts:
    def test_system_prompt_not_empty(self):
        from services.ai_synthesis.prompts import SYSTEM_PROMPT
        assert len(SYSTEM_PROMPT) > 100

    def test_user_template_formatting(self):
        from services.ai_synthesis.prompts import USER_PROMPT_TEMPLATE
        filled = USER_PROMPT_TEMPLATE.format(
            brand_name="Ozempic", generic_name="semaglutide",
            drug_class="GLP-1 agonist", indication="Type 2 diabetes",
            manufacturer="Novo Nordisk", approval_year="2017",
            pivot_trial_name="SUSTAIN-6", nnt_trial=87, nnt_realworld=130,
            arr_trial=2.3, rrr_trial=26, patent_expiry="2032",
            faers_signals_summary="Nausea in 20% of patients",
            fda_alerts_summary="No recent alerts",
            active_trials_count=3, industry_trial_count=5, total_trials=8,
        )
        assert "Ozempic" in filled
        assert "semaglutide" in filled
        assert "SUSTAIN-6" in filled
        assert "power_questions" in filled

    def test_prompt_version(self):
        from services.ai_synthesis.prompts import PROMPT_VERSION
        assert PROMPT_VERSION.startswith("v")
