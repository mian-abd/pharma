"""Proportional Reporting Ratio (PRR) calculation and trend detection for FAERS data."""
import logging
from typing import List, Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)


def calculate_prr(
    drug_reaction_count: int,
    total_drug_reports: int,
    all_reaction_count: int,
    all_reports: int,
) -> Optional[float]:
    """
    Calculate Proportional Reporting Ratio (PRR).

    PRR = (drug_reaction / total_drug_reports) / (all_reaction / all_reports)

    A PRR > 2 with count > 3 indicates a potential safety signal.
    Returns None if calculation is not possible (zero denominators).
    """
    if total_drug_reports == 0 or all_reports == 0 or all_reaction_count == 0:
        return None

    drug_proportion = drug_reaction_count / total_drug_reports
    background_proportion = all_reaction_count / all_reports

    if background_proportion == 0:
        return None

    return drug_proportion / background_proportion


def is_signal(prr: Optional[float], count: int, prr_threshold: float = 2.0, min_count: int = 3) -> bool:
    """Flag a signal if PRR exceeds threshold AND minimum count met."""
    if prr is None:
        return False
    return prr > prr_threshold and count > min_count


def detect_trend(monthly_counts: List[int]) -> str:
    """
    Determine trend direction from a list of monthly report counts.

    Compares last 3 months to previous 3 months using linear regression slope.
    Returns "increasing", "decreasing", or "stable".
    """
    if len(monthly_counts) < 4:
        return "stable"

    try:
        recent = monthly_counts[-3:]
        prior = monthly_counts[-6:-3] if len(monthly_counts) >= 6 else monthly_counts[:len(monthly_counts) - 3]

        recent_mean = np.mean(recent)
        prior_mean = np.mean(prior)

        if prior_mean == 0:
            return "stable"

        change_pct = (recent_mean - prior_mean) / prior_mean

        if change_pct > 0.15:
            return "increasing"
        elif change_pct < -0.15:
            return "decreasing"
        return "stable"
    except Exception as exc:
        logger.warning("Trend detection failed: %s", exc)
        return "stable"


def compute_serious_ratio(serious_reports: int, total_reports: int) -> float:
    """Returns fraction of reports that are serious. Used in trust score."""
    if total_reports == 0:
        return 0.0
    return serious_reports / total_reports
