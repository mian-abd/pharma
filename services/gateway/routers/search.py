"""Search/autocomplete router -- GET /api/search/autocomplete."""
import re
from typing import List

from fastapi import APIRouter, HTTPException, Query

from services.drug_resolution.rxnorm_client import autocomplete

router = APIRouter(tags=["search"])

_PREFIX_RE = re.compile(r'^[a-zA-Z0-9 \-]+$')


@router.get("/search/autocomplete", response_model=List[str])
async def search_autocomplete(
    prefix: str = Query(..., min_length=2, max_length=50, description="Drug name prefix"),
) -> List[str]:
    """
    Return drug name spelling suggestions for autocomplete.
    Powered by RxNorm spelling suggestions API.
    """
    prefix = prefix.strip()
    if not _PREFIX_RE.match(prefix):
        raise HTTPException(status_code=400, detail="Invalid search prefix.")

    suggestions = await autocomplete(prefix)
    return suggestions[:20]  # Cap at 20 results
