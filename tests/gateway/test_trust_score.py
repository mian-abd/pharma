"""Tests for the Trust Score algorithm."""
import pytest
from services.gateway.trust_score import (
    compute_trust_score,
    _evidence_quality,
    _safety_signal,
    _trial_real_gap,
    _formulary_access,
)


class TestEvidenceQuality:
    def test_no_data_returns_zero(self):
        assert _evidence_quality(None, None, 0) == 0.0

    def test_nnt_adds_50(self):
        assert _evidence_quality(10.0, None, 0) == 50.0

    def test_arr_adds_30(self):
        assert _evidence_quality(None, 2.3, 0) == 30.0

    def test_phase3_adds_20(self):
        assert _evidence_quality(None, None, 1) == 20.0

    def test_all_data_returns_100(self):
        assert _evidence_quality(10.0, 2.3, 1) == 100.0

    def test_caps_at_100(self):
        assert _evidence_quality(10.0, 2.3, 5) == 100.0


class TestSafetySignal:
    def test_no_serious_no_flag(self):
        score = _safety_signal(0.0, False)
        assert score == 100.0

    def test_high_serious_ratio_reduces_score(self):
        score = _safety_signal(0.10, False)
        # 100 - (0.1 * 500) = 100 - 50 = 50
        assert abs(score - 50.0) < 0.01

    def test_signal_flag_reduces_by_10(self):
        score = _safety_signal(0.0, True)
        assert score == 90.0

    def test_cannot_go_below_zero(self):
        score = _safety_signal(1.0, True)
        assert score == 0.0


class TestTrialRealGap:
    def test_no_data_returns_50(self):
        assert _trial_real_gap(None, None) == 50.0

    def test_no_gap_returns_100(self):
        assert _trial_real_gap(10.0, 10.0) == 100.0

    def test_large_gap_reduces_score(self):
        # nnt_trial=10, nnt_realworld=20 -> gap_ratio=1.0 -> score = 100 - 200 = max(0, -100) = 0
        score = _trial_real_gap(10.0, 20.0)
        assert score == 0.0

    def test_moderate_gap(self):
        # nnt_trial=10, nnt_realworld=12 -> gap = 0.2 -> score = 100 - 40 = 60
        score = _trial_real_gap(10.0, 12.0)
        assert abs(score - 60.0) < 0.01


class TestFormularyAccess:
    def test_all_tier1_perfect_score(self):
        score = _formulary_access(4, 0, 0, 0)
        assert min(100.0, score) == 100.0

    def test_mix_of_tiers(self):
        # 25*(1+1) + 10*1 = 50 + 10 = 60
        score = _formulary_access(1, 1, 1, 0)
        assert abs(score - 60.0) < 0.01


class TestComputeTrustScore:
    def test_all_data_available(self):
        score, breakdown = compute_trust_score(
            nnt_trial=10.0, arr_trial=2.3, nnt_realworld=12.0,
            completed_phase3_trials=2,
            serious_report_ratio=0.05,
            signal_flag=False,
            tier1_payers=1, tier2_payers=1, tier3_payers=1, pa_count=0,
        )
        assert 0 <= score <= 100
        assert breakdown.evidence_quality == 100.0
        assert breakdown.safety_signal >= 0

    def test_no_data_returns_low_score(self):
        score, breakdown = compute_trust_score(
            nnt_trial=None, arr_trial=None, nnt_realworld=None,
            completed_phase3_trials=0,
            serious_report_ratio=0.0,
            signal_flag=False,
            tier1_payers=0, tier2_payers=0, tier3_payers=0, pa_count=0,
        )
        assert score >= 0
        assert breakdown.evidence_quality == 0.0

    def test_score_clamped_to_0_100(self):
        score, _ = compute_trust_score(
            nnt_trial=1.0, arr_trial=50.0, nnt_realworld=1.0,
            completed_phase3_trials=10,
            serious_report_ratio=0.0,
            signal_flag=False,
            tier1_payers=10, tier2_payers=10, tier3_payers=10, pa_count=0,
        )
        assert 0 <= score <= 100
