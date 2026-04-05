"""Search/autocomplete router -- GET /api/search/autocomplete."""
from typing import List

from fastapi import APIRouter, HTTPException, Query

from services.drug_resolution.rxnorm_client import autocomplete
from services.shared.drug_name_validation import SEARCH_PREFIX_MAX_LEN, is_valid_search_prefix

router = APIRouter(tags=["search"])


@router.get("/search/autocomplete", response_model=List[str])
async def search_autocomplete(
    prefix: str = Query(
        ...,
        min_length=2,
        max_length=SEARCH_PREFIX_MAX_LEN,
        description="Drug, ingredient, or chemical name prefix",
    ),
) -> List[str]:
    """
    Return drug name spelling suggestions for autocomplete.
    Powered by RxNorm spelling suggestions API.
    """
    prefix = prefix.strip()
    if not is_valid_search_prefix(prefix):
        raise HTTPException(status_code=400, detail="Invalid search prefix.")

    suggestions = await autocomplete(prefix)
    return suggestions[:20]  # Cap at 20 results
