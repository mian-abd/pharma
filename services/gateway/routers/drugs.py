"""Drug data router -- GET /api/drug/{drug_name}."""
import logging
import re

from fastapi import APIRouter, HTTPException, Path
from fastapi.responses import JSONResponse

from services.gateway.orchestrator import DrugBundle, build_drug_bundle

logger = logging.getLogger(__name__)

router = APIRouter(tags=["drugs"])

# Allowlist: drug names are alphanumeric + spaces + hyphens only
_DRUG_NAME_RE = re.compile(r'^[a-zA-Z0-9 \-]+$')


@router.get("/drug/{drug_name}", response_model=DrugBundle)
async def get_drug(
    drug_name: str = Path(
        ...,
        min_length=2,
        max_length=100,
        description="Drug name (brand or generic)",
    ),
) -> DrugBundle:
    """
    Retrieve full pharmaceutical intelligence bundle for a drug.

    Returns FAERS adverse event trends, clinical trials, formulary coverage,
    FDA signals, AI-generated Rep Brief, and composite Trust Score.
    """
    # Input validation -- prevent injection
    drug_name = drug_name.strip()
    if not _DRUG_NAME_RE.match(drug_name):
        raise HTTPException(
            status_code=400,
            detail="Drug name may only contain letters, numbers, spaces, and hyphens.",
        )

    bundle = await build_drug_bundle(drug_name)
    if bundle is None:
        raise HTTPException(
            status_code=404,
            detail=f"Drug '{drug_name}' could not be resolved. Try a brand or generic name.",
        )

    return bundle
