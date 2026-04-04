"""Claude API Rep Brief generator for PharmaCortex."""
import json
import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import anthropic

from services.ai_synthesis.prompts import PROMPT_VERSION, SYSTEM_PROMPT, USER_PROMPT_TEMPLATE
from services.shared.cache import cache_get, cache_set
from services.shared.config import settings
from services.shared.models import InputDataSnapshot, RepBrief

logger = logging.getLogger(__name__)

MODEL = "claude-sonnet-4-5"
MAX_TOKENS = 1200
DEFAULT_TEMP = 0.2
RETRY_TEMP = 0.1


async def generate_rep_brief(drug_data: Dict[str, Any]) -> Optional[RepBrief]:
    """
    Generate an AI Rep Brief using Claude API.

    Attempts JSON parse; retries once with lower temperature on parse failure.
    Caches result in Redis for 7 days.
    """
    rxcui = drug_data.get("rxcui", "")
    cache_key = f"drug:{rxcui}:rep_brief"

    cached = await cache_get(cache_key)
    if cached:
        brief = RepBrief.model_construct(**cached)
        return brief

    prompt = _build_prompt(drug_data)
    snapshot = _build_snapshot(drug_data)

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    brief_data, latency_ms = await _call_claude(client, prompt, DEFAULT_TEMP)

    if brief_data is None:
        logger.warning("First Claude attempt failed for rxcui=%s, retrying with lower temp", rxcui)
        brief_data, latency_ms = await _call_claude(client, prompt, RETRY_TEMP)

    if brief_data is None:
        logger.error("Both Claude attempts failed for rxcui=%s", rxcui)
        return None

    expires_at = datetime.now(timezone.utc) + timedelta(days=7)

    brief = RepBrief.model_construct(
        drug_rxcui=rxcui,
        model_version=MODEL,
        will_say=brief_data.get("will_say", []),
        reality=brief_data.get("reality", []),
        power_questions=brief_data.get("power_questions", []),
        study_limitations=brief_data.get("study_limitations", ""),
        pivot_trial_used=brief_data.get("pivot_trial_used"),
        absolute_vs_relative_note=brief_data.get("absolute_vs_relative_note", ""),
        input_data_snapshot=snapshot,
        prompt_version=PROMPT_VERSION,
        generation_latency_ms=latency_ms,
        expires_at=expires_at,
        created_at=datetime.now(timezone.utc),
    )

    cache_data = {
        "drug_rxcui": rxcui,
        "model_version": MODEL,
        "will_say": brief.will_say,
        "reality": brief.reality,
        "power_questions": brief.power_questions,
        "study_limitations": brief.study_limitations,
        "pivot_trial_used": brief.pivot_trial_used,
        "absolute_vs_relative_note": brief.absolute_vs_relative_note,
        "prompt_version": PROMPT_VERSION,
        "generation_latency_ms": latency_ms,
        "expires_at": expires_at.isoformat(),
        "created_at": brief.created_at.isoformat() if brief.created_at else None,
        "input_data_snapshot": snapshot.model_dump(),
    }
    await cache_set(cache_key, cache_data, ttl=settings.ttl_rep_brief)

    return brief


def _build_prompt(drug_data: Dict[str, Any]) -> str:
    """Fill USER_PROMPT_TEMPLATE from drug data bundle."""
    return USER_PROMPT_TEMPLATE.format(
        brand_name=drug_data.get("brand_name", "Unknown"),
        generic_name=drug_data.get("generic_name", "Unknown"),
        drug_class=drug_data.get("drug_class", "Unknown"),
        indication=drug_data.get("indication", "Unknown indication"),
        manufacturer=drug_data.get("manufacturer", "Unknown"),
        approval_year=drug_data.get("approval_year", "Unknown"),
        pivot_trial_name=drug_data.get("pivot_trial_name", "Pivotal Phase 3 Trial"),
        nnt_trial=drug_data.get("nnt_trial", "N/A"),
        nnt_realworld=drug_data.get("nnt_realworld", "N/A"),
        arr_trial=drug_data.get("arr_trial", "N/A"),
        rrr_trial=drug_data.get("rrr_trial", "N/A"),
        patent_expiry=drug_data.get("patent_expiry", "Unknown"),
        faers_signals_summary=drug_data.get("faers_signals_summary", "No significant FAERS signals"),
        fda_alerts_summary=drug_data.get("fda_alerts_summary", "No recent FDA alerts"),
        active_trials_count=drug_data.get("active_trials_count", 0),
        industry_trial_count=drug_data.get("industry_trial_count", 0),
        total_trials=drug_data.get("total_trials", 0),
    )


def _build_snapshot(drug_data: Dict[str, Any]) -> InputDataSnapshot:
    """Build an InputDataSnapshot from the drug data bundle."""
    return InputDataSnapshot(
        brand_name=drug_data.get("brand_name", ""),
        generic_name=drug_data.get("generic_name", ""),
        drug_class=drug_data.get("drug_class", ""),
        indication=drug_data.get("indication", ""),
        nnt_trial=drug_data.get("nnt_trial"),
        nnt_realworld=drug_data.get("nnt_realworld"),
        arr_trial=drug_data.get("arr_trial"),
        rrr_trial=drug_data.get("rrr_trial"),
        faers_signals_summary=drug_data.get("faers_signals_summary", ""),
        fda_alerts_summary=drug_data.get("fda_alerts_summary", ""),
        active_trials_count=drug_data.get("active_trials_count", 0),
        industry_trial_count=drug_data.get("industry_trial_count", 0),
        total_trials=drug_data.get("total_trials", 0),
    )


async def _call_claude(
    client: anthropic.Anthropic,
    user_prompt: str,
    temperature: float,
) -> tuple[Optional[Dict], Optional[int]]:
    """
    Call Claude API and attempt to parse JSON response.
    Returns (parsed_dict, latency_ms) or (None, latency_ms) on parse failure.
    """
    start_ms = int(time.time() * 1000)
    try:
        message = client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            temperature=temperature,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )
        latency_ms = int(time.time() * 1000) - start_ms
        raw_text = message.content[0].text.strip()

        # Strip markdown code fences if present
        if raw_text.startswith("```"):
            raw_text = raw_text.split("```")[1]
            if raw_text.startswith("json"):
                raw_text = raw_text[4:]

        parsed = json.loads(raw_text)
        return parsed, latency_ms

    except json.JSONDecodeError as exc:
        latency_ms = int(time.time() * 1000) - start_ms
        logger.warning("JSON parse failed (temp=%.1f): %s", temperature, exc)
        return None, latency_ms
    except Exception as exc:
        latency_ms = int(time.time() * 1000) - start_ms
        logger.error("Claude API error: %s", exc)
        return None, latency_ms
