"""Dashboard routes for home and command-center snapshots."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Path

from services.gateway.dashboard_service import build_dashboard_home, build_drug_command_center
from services.shared.dashboard_models import DashboardHome, DrugCommandCenter
from services.shared.drug_name_validation import DRUG_QUERY_MAX_LEN, is_valid_drug_query

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard/home", response_model=DashboardHome)
async def get_dashboard_home() -> DashboardHome:
    return await build_dashboard_home()


@router.get("/dashboard/drug/{drug_name}", response_model=DrugCommandCenter)
async def get_dashboard_drug(
    drug_name: str = Path(
        ...,
        min_length=2,
        max_length=DRUG_QUERY_MAX_LEN,
        description="Drug name (brand, generic, ingredient, or common chemical name)",
    ),
) -> DrugCommandCenter:
    drug_name = drug_name.strip()
    if not is_valid_drug_query(drug_name):
        raise HTTPException(
            status_code=400,
            detail="Drug name contains unsupported characters or is too long.",
        )

    snapshot = await build_drug_command_center(drug_name)
    if snapshot is None:
        raise HTTPException(
            status_code=404,
            detail=f"Drug '{drug_name}' could not be resolved. Try a brand or generic name.",
        )
    return snapshot
