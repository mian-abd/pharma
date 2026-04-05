"""Drug data router -- GET /api/drug/{drug_name}."""
import logging

from fastapi import APIRouter, HTTPException, Path

from services.gateway.orchestrator import DrugBundle, build_drug_bundle
from services.shared.drug_name_validation import DRUG_QUERY_MAX_LEN, is_valid_drug_query

logger = logging.getLogger(__name__)

router = APIRouter(tags=["drugs"])


@router.get("/drug/{drug_name}", response_model=DrugBundle)
async def get_drug(
    drug_name: str = Path(
        ...,
        min_length=2,
        max_length=DRUG_QUERY_MAX_LEN,
        description="Drug name (brand, generic, ingredient, or common chemical name)",
    ),
) -> DrugBundle:
    """
    Retrieve full pharmaceutical intelligence bundle for a drug.

    Returns FAERS adverse event trends, clinical trials, formulary coverage,
    FDA signals, AI-generated Rep Brief, and composite Trust Score.
    """
    drug_name = drug_name.strip()
    if not is_valid_drug_query(drug_name):
        raise HTTPException(
            status_code=400,
            detail="Drug name contains unsupported characters or is too long.",
        )

    bundle = await build_drug_bundle(drug_name)
    if bundle is None:
        raise HTTPException(
            status_code=404,
            detail=f"Drug '{drug_name}' could not be resolved. Try a brand or generic name.",
        )

    return bundle
