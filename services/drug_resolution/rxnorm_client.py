"""RxNorm API client for drug name resolution, synonym lookup, and autocomplete."""
import logging
from typing import List, Optional

from pydantic import BaseModel

from services.shared.cache import cache_get, cache_set
from services.shared.config import settings
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
    data = await fetch_with_retry(url, params={"name": drug_name, "search": "1"})
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
    data = await fetch_with_retry(url)
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
    data = await fetch_with_retry(url, params={"rxcui": rxcui, "relaSource": "ATC"})
    if not data:
        return ""
    try:
        classes = data["rxclassDrugInfoList"]["rxclassDrugInfo"]
        if classes:
            return classes[0]["rxclassMinConceptItem"]["className"]
    except (KeyError, IndexError, TypeError):
        pass
    return ""


async def autocomplete(prefix: str) -> List[str]:
    """
    Return spelling suggestions for a drug name prefix.
    Cached for 1 hour.
    """
    if len(prefix) < 2:
        return []

    cache_key = f"search:autocomplete:{prefix.lower().strip()}"
    cached = await cache_get(cache_key)
    if cached is not None:
        return cached

    url = f"{RXNORM_BASE}/REST/spellingsuggestions.json"
    data = await fetch_with_retry(url, params={"name": prefix})
    suggestions: List[str] = []
    if data:
        try:
            suggestions = data["suggestionGroup"]["suggestionList"]["suggestion"]
        except (KeyError, TypeError):
            pass

    await cache_set(cache_key, suggestions, ttl=settings.ttl_autocomplete)
    return suggestions
