"""Trust Score algorithm -- composite evidence quality metric (0-100)."""
from typing import List, Optional

from services.shared.models import TrustScoreBreakdown


def compute_trust_score(
    nnt_trial: Optional[float],
    arr_trial: Optional[float],
    nnt_realworld: Optional[float],
    completed_phase3_trials: int,
    serious_report_ratio: float,
    signal_flag: bool,
    tier1_payers: int,
    tier2_payers: int,
    tier3_payers: int,
    pa_count: int,
) -> tuple[float, TrustScoreBreakdown]:
    """
    Compute composite evidence trust score (0-100) and component breakdown.

    Weights:
    - evidence_quality: 30%
    - safety_signal:    25%
    - trial_real_gap:   25%
    - formulary_access: 20%
    """
    evidence_quality = _evidence_quality(nnt_trial, arr_trial, completed_phase3_trials)
    safety_signal = _safety_signal(serious_report_ratio, signal_flag)
    trial_real_gap = _trial_real_gap(nnt_trial, nnt_realworld)
    formulary_access = _formulary_access(tier1_payers, tier2_payers, tier3_payers, pa_count)

    trust_score = (
        0.30 * evidence_quality
        + 0.25 * safety_signal
        + 0.25 * trial_real_gap
        + 0.20 * formulary_access
    )
    trust_score = max(0.0, min(100.0, trust_score))

    breakdown = TrustScoreBreakdown(
        evidence_quality=round(evidence_quality, 1),
        safety_signal=round(safety_signal, 1),
        trial_real_gap=round(trial_real_gap, 1),
        formulary_access=round(formulary_access, 1),
    )
    return round(trust_score, 1), breakdown


def _evidence_quality(nnt_trial: Optional[float], arr_trial: Optional[float], completed_p3: int) -> float:
    score = 0.0
    if nnt_trial is not None:
        score += 50.0
    if arr_trial is not None:
        score += 30.0
    if completed_p3 > 0:
        score += 20.0
    return min(100.0, score)


def _safety_signal(serious_ratio: float, signal_flag: bool) -> float:
    score = 100.0 - (serious_ratio * 500.0)
    if signal_flag:
        score -= 10.0
    return max(0.0, score)


def _trial_real_gap(nnt_trial: Optional[float], nnt_realworld: Optional[float]) -> float:
    if nnt_trial is None or nnt_realworld is None or nnt_trial <= 0:
        return 50.0
    gap_ratio = (nnt_realworld - nnt_trial) / nnt_trial
    score = 100.0 - max(0.0, gap_ratio * 200.0)
    return max(0.0, score)


def _formulary_access(tier1: int, tier2: int, tier3: int, pa_count: int) -> float:
    score = 25.0 * (tier1 + tier2) + 10.0 * tier3
    return min(100.0, score)
