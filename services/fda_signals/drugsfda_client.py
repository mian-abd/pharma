"""openFDA Drugs@FDA metadata client with graceful fallback."""
from __future__ import annotations

import logging

from services.shared.cache import cache_get, cache_set
from services.shared.config import settings
from services.shared.dashboard_models import ApprovalSnapshot
from services.shared.demo_data import get_seed_drug
from services.shared.http_client import fetch_with_retry

logger = logging.getLogger(__name__)


async def get_approval_snapshot(drug_name: str, generic_name: str | None = None) -> ApprovalSnapshot:
    cache_key = f"approval:{(generic_name or drug_name).lower()}"
    cached = await cache_get(cache_key)
    if cached:
        return ApprovalSnapshot(**cached)

    snapshot = None
    try:
        snapshot = await _fetch_approval_snapshot(drug_name, generic_name)
    except Exception as exc:
        logger.warning("Drugs@FDA approval fallback for %s: %s", drug_name, exc)

    if snapshot is None:
        snapshot = _seed_snapshot(drug_name, generic_name)

    await cache_set(cache_key, snapshot.model_dump(), ttl=settings.ttl_approval)
    return snapshot


async def _fetch_approval_snapshot(drug_name: str, generic_name: str | None) -> ApprovalSnapshot | None:
    query_name = generic_name or drug_name
    url = f"{settings.openfda_base_url}/drug/drugsfda.json"
    params = {
        "search": f'products.brand_name:"{drug_name}" OR products.active_ingredients.name:"{query_name}"',
        "limit": "1",
    }
    data = await fetch_with_retry(url, params=params, max_retries=1, base_delay=0.3)
    if not data:
        return None

    result = (data.get("results") or [{}])[0]
    products = result.get("products") or [{}]
    submissions = result.get("submissions") or [{}]
    product = products[0]
    submission = submissions[0]

    return ApprovalSnapshot(
        sponsor_name=result.get("sponsor_name", ""),
        approval_date=str(submission.get("submission_status_date", ""))[:10] or None,
        application_number=result.get("application_number"),
        dosage_form=product.get("dosage_form"),
        route=product.get("route"),
        source_status="live",
    )


def _seed_snapshot(drug_name: str, generic_name: str | None) -> ApprovalSnapshot:
    seed = get_seed_drug(generic_name or drug_name) or {}
    return ApprovalSnapshot(
        sponsor_name=seed.get("manufacturer", ""),
        approval_date=None,
        application_number=None,
        dosage_form=None,
        route=None,
        source_status="demo",
    )
