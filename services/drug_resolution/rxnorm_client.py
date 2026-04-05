"""RxNorm API client for drug name resolution, synonym lookup, and autocomplete."""
import logging
from typing import List, Optional

from pydantic import BaseModel

from services.shared.cache import cache_get, cache_set
from services.shared.config import settings
from services.shared.demo_data import get_seed_drug, iter_seed_names
from services.shared.http_client import fetch_with_retry

logger = logging.getLogger(__name__)

RXNORM_BASE = settings.rxnorm_base_url


class DrugResolutionResult(BaseModel):
    rxcui: str
    brand_name: str
    generic_name: str
    synonyms: List[str]
    drug_class: str


async def resolve_drug(drug_name: str) -> Optional[DrugResolutionResult]:
    """
    Resolve a drug name to its canonical RXCUI and metadata.
    Caches results in Redis for 30 days.
    """
    cache_key = f"rxnorm:{drug_name.lower().strip()}:rxcui"
    cached = await cache_get(cache_key)
    if cached:
        return DrugResolutionResult(**cached)

    seed = get_seed_drug(drug_name)
    if seed:
        result = DrugResolutionResult(
            rxcui=seed["rxcui"],
            brand_name=seed["brand_name"],
            generic_name=seed["generic_name"],
            synonyms=[alias for alias in seed["aliases"] if alias.lower() != drug_name.lower()],
            drug_class=seed["drug_class"],
        )
        await cache_set(cache_key, result.model_dump(), ttl=settings.ttl_rxnorm)
        return result

    # Step 1: Get RXCUI
    rxcui = await _get_rxcui(drug_name)
    if not rxcui:
        logger.warning("Could not resolve RXCUI for drug: %s", drug_name)
        return None

    # Step 2: Get all related names (brand, generic, synonyms)
    names = await _get_all_related(rxcui)

    # Step 3: Get drug class via ATC
    drug_class = await _get_drug_class(rxcui)

    result = DrugResolutionResult(
        rxcui=rxcui,
        brand_name=names.get("brand", drug_name),
        generic_name=names.get("generic", drug_name),
        synonyms=names.get("synonyms", []),
        drug_class=drug_class,
    )

    await cache_set(cache_key, result.model_dump(), ttl=settings.ttl_rxnorm)
    return result


async def _get_rxcui(drug_name: str) -> Optional[str]:
    """Call RxNorm REST API to resolve drug name to RXCUI."""
    url = f"{RXNORM_BASE}/REST/rxcui.json"
    data = await fetch_with_retry(url, params={"name": drug_name, "search": "1"}, max_retries=1, base_delay=0.15, timeout_seconds=2.5)
    if not data:
        return None
    try:
        return data["idGroup"]["rxnormId"][0]
    except (KeyError, IndexError, TypeError):
        logger.debug("No RXCUI found in response for '%s'", drug_name)
        return None


async def _get_all_related(rxcui: str) -> dict:
    """Fetch all related concept names: brand, generic, synonyms."""
    url = f"{RXNORM_BASE}/REST/rxcui/{rxcui}/allrelated.json"
    data = await fetch_with_retry(url, max_retries=1, base_delay=0.15, timeout_seconds=2.5)
    if not data:
        return {}

    result = {"brand": "", "generic": "", "synonyms": []}
    concept_groups = data.get("allRelatedGroup", {}).get("conceptGroup", [])

    for group in concept_groups:
        tty = group.get("tty", "")
        props = group.get("conceptProperties", [])
        names = [p.get("name", "") for p in props if p.get("name")]

        if tty == "BN" and names:        # Brand Name
            result["brand"] = names[0]
            result["synonyms"].extend(names[1:])
        elif tty == "IN" and names:      # Ingredient (generic)
            result["generic"] = names[0]
        elif tty in ("SY", "TMSY") and names:  # Synonyms
            result["synonyms"].extend(names)

    return result


async def _get_drug_class(rxcui: str) -> str:
    """Get ATC drug class for an RXCUI."""
    url = f"{RXNORM_BASE}/REST/rxclass/class/byRxcui.json"
    data = await fetch_with_retry(url, params={"rxcui": rxcui, "relaSource": "ATC"}, max_retries=1, base_delay=0.15, timeout_seconds=2.5)
    if not data:
        return ""
    try:
        classes = data["rxclassDrugInfoList"]["rxclassDrugInfo"]
        if classes:
            return classes[0]["rxclassMinConceptItem"]["className"]
    except (KeyError, IndexError, TypeError):
        pass
    return ""


def _normalize_suggestion_list(raw) -> List[str]:
    if raw is None:
        return []
    if isinstance(raw, str):
        return [raw] if raw else []
    if isinstance(raw, list):
        return [s for s in raw if isinstance(s, str) and s]
    return []


def _spellings_from_response(data: object) -> List[str]:
    if not isinstance(data, dict):
        return []
    try:
        raw = data["suggestionGroup"]["suggestionList"]["suggestion"]
    except (KeyError, TypeError):
        return []
    return _normalize_suggestion_list(raw)


def _approximate_names_from_response(data: object) -> List[str]:
    if not isinstance(data, dict):
        return []
    try:
        group = data["approximateGroup"]
        candidates = group["candidate"]
    except (KeyError, TypeError):
        return []
    if isinstance(candidates, dict):
        candidates = [candidates]
    if not isinstance(candidates, list):
        return []
    out: List[str] = []
    for c in candidates:
        if isinstance(c, dict):
            name = c.get("name")
            if isinstance(name, str) and name:
                out.append(name)
    return out


def _merge_unique_ordered(parts: List[List[str]], cap: int) -> List[str]:
    seen: set[str] = set()
    out: List[str] = []
    for lst in parts:
        for s in lst:
            key = s.casefold()
            if key in seen:
                continue
            seen.add(key)
            out.append(s)
            if len(out) >= cap:
                return out
    return out


async def autocomplete(prefix: str) -> List[str]:
    """
    Return drug / ingredient / chemical name hints for a prefix.
    Merges seed data, RxNorm approximateTerm, and spelling suggestions.
    Cached for 1 hour.
    """
    if len(prefix) < 2:
        return []

    cache_key = f"search:autocomplete:{prefix.lower().strip()}"
    cached = await cache_get(cache_key)
    if cached is not None:
        return cached

    prefix_stripped = prefix.strip()
    prefix_lower = prefix_stripped.lower()
    local_matches = sorted(
        {name for name in iter_seed_names() if name.lower().startswith(prefix_lower)},
        key=str.lower,
    )

    approx: List[str] = []
    url_approx = f"{RXNORM_BASE}/REST/approximateTerm.json"
    data_approx = await fetch_with_retry(
        url_approx,
        params={"term": prefix_stripped, "maxEntries": "15"},
        max_retries=1,
        base_delay=0.15,
        timeout_seconds=2.5,
    )
    if data_approx:
        approx = _approximate_names_from_response(data_approx)

    url_spell = f"{RXNORM_BASE}/REST/spellingsuggestions.json"
    spell: List[str] = []
    data_spell = await fetch_with_retry(
        url_spell, params={"name": prefix_stripped}, max_retries=1, base_delay=0.15, timeout_seconds=2.0
    )
    if data_spell:
        spell = _spellings_from_response(data_spell)

    merged = _merge_unique_ordered([local_matches, approx, spell], cap=25)

    await cache_set(cache_key, merged, ttl=settings.ttl_autocomplete)
    return merged
