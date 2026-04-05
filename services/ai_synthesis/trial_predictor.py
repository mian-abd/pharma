"""
Trial success probability predictor (Phase 2 ML feature).

Uses a heuristic scoring model based on validated predictors from
published meta-analyses of clinical trial outcomes. No external model
required -- fully deterministic from trial metadata.

Reference: Wong et al. (2019) "Estimation of clinical trial success rates"
Biostatistics — industry-sponsored Phase 3 oncology trials: ~57% success rate;
non-oncology: ~67%. Phase 2: ~36%. Phase 1: ~63%.
"""
import logging
from typing import List

from services.shared.panel_models import MLInsightsPanel, SimilarDrug, TrialPrediction

logger = logging.getLogger(__name__)

# Phase-based baseline success rates (Wong et al. 2019 + Hay et al. 2014)
_PHASE_BASE_RATES = {
    "phase 1": 0.63,
    "phase 2": 0.36,
    "phase 3": 0.58,
    "phase 4": 0.80,
    "phase 1/phase 2": 0.45,
    "phase 2/phase 3": 0.48,
    "": 0.40,
}

_POSITIVE_SIGNALS = [
    ("has_results", 0.12, "Trial has posted results"),
    ("industry_sponsored", 0.07, "Industry-sponsored (higher completion rate)"),
    ("large_enrollment", 0.08, "Large enrollment (>1000 patients)"),
    ("completed", 0.15, "Trial completed"),
]

_NEGATIVE_SIGNALS = [
    ("terminated", -0.30, "Trial was terminated early"),
    ("withdrawn", -0.25, "Trial was withdrawn"),
    ("small_enrollment", -0.05, "Small enrollment (<50 patients)"),
]


def predict_trial_outcomes(trials: list, rxcui: str, drug_class: str = "") -> MLInsightsPanel:
    """
    Predict success probability for each trial based on metadata.
    Returns an MLInsightsPanel with predictions and similar drug suggestions.
    """
    predictions: List[TrialPrediction] = []

    for trial in trials[:10]:  # Cap at 10 predictions for performance
        if not isinstance(trial, dict):
            trial = trial if hasattr(trial, "__dict__") else {}

        phase = str(trial.get("phase", "")).lower()
        status = str(trial.get("status", "")).lower()
        enrollment = trial.get("enrollment") or 0
        has_results = bool(trial.get("has_results", False))
        industry = bool(trial.get("industry_sponsored", False))
        nct_id = trial.get("nct_id", "")
        title = trial.get("title", "")

        if not nct_id:
            continue

        base_rate = _PHASE_BASE_RATES.get(phase, 0.40)
        adjustment = 0.0
        key_factors: List[str] = [f"Phase baseline rate: {int(base_rate * 100)}%"]

        # Positive adjustments
        if has_results:
            adjustment += 0.12
            key_factors.append("Has posted results (+12%)")
        if industry:
            adjustment += 0.07
            key_factors.append("Industry-sponsored (+7%)")
        if enrollment and enrollment > 1000:
            adjustment += 0.08
            key_factors.append(f"Large enrollment: {enrollment:,} (+8%)")

        # Status adjustments
        if "completed" in status:
            adjustment += 0.15
            key_factors.append("Completed status (+15%)")
        elif "terminated" in status:
            adjustment -= 0.30
            key_factors.append("Terminated (-30%)")
        elif "withdrawn" in status:
            adjustment -= 0.25
            key_factors.append("Withdrawn (-25%)")
        elif "recruiting" in status or "active" in status:
            adjustment += 0.05
            key_factors.append("Currently active (+5%)")

        if enrollment and enrollment < 50:
            adjustment -= 0.05
            key_factors.append(f"Small enrollment: {enrollment} (-5%)")

        prob = max(0.05, min(0.97, base_rate + adjustment))

        confidence = "high" if abs(adjustment) > 0.15 else "medium" if abs(adjustment) > 0.05 else "low"

        predictions.append(TrialPrediction(
            trial_nct_id=nct_id,
            trial_title=title[:80] + ("…" if len(title) > 80 else ""),
            success_probability=round(prob, 3),
            confidence=confidence,
            key_factors=key_factors[:4],
        ))

    # Sort by probability descending
    predictions.sort(key=lambda p: p.success_probability, reverse=True)

    similar_drugs = _find_similar_drugs(drug_class)

    return MLInsightsPanel(
        rxcui=rxcui,
        trial_predictions=predictions,
        similar_drugs=similar_drugs,
        feature_flag_enabled=True,
    )


def _find_similar_drugs(drug_class: str) -> List[SimilarDrug]:
    """Return a small static list of same-class comparators for demo."""
    dc = drug_class.upper() if drug_class else ""

    comparators = {
        "GLP": [
            SimilarDrug(rxcui="2200644", brand_name="Mounjaro", generic_name="tirzepatide",
                        drug_class="GLP-1/GIP agonist", similarity_reason="Same ATC class — GLP-1 receptor agonist"),
            SimilarDrug(rxcui="2200643", brand_name="Victoza", generic_name="liraglutide",
                        drug_class="GLP-1 agonist", similarity_reason="Same ATC class — GLP-1 receptor agonist"),
        ],
        "STATIN": [
            SimilarDrug(rxcui="301542", brand_name="Lipitor", generic_name="atorvastatin",
                        drug_class="HMG-CoA reductase inhibitor", similarity_reason="Same ATC class — statins"),
            SimilarDrug(rxcui="301541", brand_name="Crestor", generic_name="rosuvastatin",
                        drug_class="HMG-CoA reductase inhibitor", similarity_reason="Same ATC class — statins"),
        ],
    }

    for key, drugs in comparators.items():
        if key in dc:
            return drugs

    return []
