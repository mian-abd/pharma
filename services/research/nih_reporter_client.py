"""NIH RePORTER client for federally funded research activity."""
from __future__ import annotations

import logging
from datetime import date

from services.shared.cache import cache_get, cache_set
from services.shared.config import settings
from services.shared.dashboard_models import FundingProject, FundingSnapshot
from services.shared.http_client import get_client

logger = logging.getLogger(__name__)


def _normalize_term(drug_name: str, generic_name: str) -> str:
    term = (generic_name or drug_name or "").strip()
    return term.split("/")[0].strip()


def _parse_float(value) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _parse_int(value) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def _pick_string(container: dict, *keys: str) -> str:
    for key in keys:
        value = container.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _extract_pi(row: dict) -> str:
    investigators = row.get("principal_investigators") or row.get("principalInvestigators") or []
    if isinstance(investigators, list) and investigators:
        first = investigators[0] or {}
        if isinstance(first, dict):
            name = _pick_string(first, "full_name", "name")
            if name:
                return name
    return _pick_string(row, "contact_pi_name", "pi_name")


def _extract_org(row: dict) -> str:
    org = row.get("organization") or row.get("Organization")
    if isinstance(org, dict):
        return _pick_string(org, "org_name", "orgName", "name")
    return _pick_string(row, "org_name", "organization_name")


def _extract_agency(row: dict) -> str:
    agency = row.get("agency_ic_admin") or row.get("agencyIcAdmin")
    if isinstance(agency, dict):
        return _pick_string(agency, "name", "abbreviation", "code")
    return _pick_string(row, "agency_ic_admin_abbreviation", "agency_ic_fundings")


def _is_active(row: dict) -> bool:
    end_text = _pick_string(row, "project_end_date", "budget_end_date")
    if not end_text:
        fiscal_year = _parse_int(row.get("fiscal_year"))
        return fiscal_year >= date.today().year - 1
    try:
        return end_text[:10] >= date.today().isoformat()
    except Exception:
        return False


async def get_funding_snapshot(drug_name: str, generic_name: str) -> FundingSnapshot:
    term = _normalize_term(drug_name, generic_name)
    if not term:
        return FundingSnapshot(
            matched_project_count=0,
            active_project_count=0,
            total_award_amount_usd=0.0,
            top_agencies=[],
            top_organizations=[],
            recent_projects=[],
            source_status="demo",
        )

    cache_key = f"nih:funding:{term.lower()}"
    cached = await cache_get(cache_key)
    if cached:
        return FundingSnapshot(**cached)

    payload = {
        "criteria": {
            "advanced_text_search": {
                "operator": "and",
                "search_field": "projecttitle,abstracttext,terms",
                "search_text": term,
            },
        },
        "offset": 0,
        "limit": 10,
        "sort_field": "fiscal_year",
        "sort_order": "desc",
    }

    try:
        async with get_client(timeout=10.0) as client:
            response = await client.post(
                f"{settings.nih_reporter_base_url}/v2/projects/search",
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": "PharmaCortex/1.0 NIH-Reporter",
                },
            )
            response.raise_for_status()
            data = response.json()
    except Exception as exc:
        logger.warning("NIH RePORTER fetch failed for %s: %s", term, exc)
        return FundingSnapshot(
            matched_project_count=0,
            active_project_count=0,
            total_award_amount_usd=0.0,
            top_agencies=[],
            top_organizations=[],
            recent_projects=[],
            source_status="degraded",
        )

    results = data.get("results") or data.get("Results") or []
    meta = data.get("meta") or data.get("Meta") or {}
    matched_count = _parse_int(meta.get("total")) or len(results)

    projects: list[FundingProject] = []
    total_award = 0.0
    active_count = 0
    agency_counts: dict[str, int] = {}
    org_counts: dict[str, int] = {}

    for row in results:
        if not isinstance(row, dict):
            continue
        agency = _extract_agency(row)
        organization = _extract_org(row)
        award_amount = _parse_float(row.get("award_amount") or row.get("fy_total_cost"))
        total_award += award_amount
        if _is_active(row):
            active_count += 1
        if agency:
            agency_counts[agency] = agency_counts.get(agency, 0) + 1
        if organization:
            org_counts[organization] = org_counts.get(organization, 0) + 1

        projects.append(
            FundingProject(
                project_title=_pick_string(row, "project_title", "title") or term,
                fiscal_year=_parse_int(row.get("fiscal_year")) or None,
                award_amount_usd=award_amount,
                organization=organization or None,
                principal_investigator=_extract_pi(row) or None,
                project_number=_pick_string(row, "project_num", "project_number") or None,
                project_end_date=_pick_string(row, "project_end_date", "budget_end_date") or None,
            )
        )

    snapshot = FundingSnapshot(
        matched_project_count=matched_count,
        active_project_count=active_count,
        total_award_amount_usd=round(total_award, 2),
        top_agencies=[name for name, _ in sorted(agency_counts.items(), key=lambda item: item[1], reverse=True)[:4]],
        top_organizations=[name for name, _ in sorted(org_counts.items(), key=lambda item: item[1], reverse=True)[:4]],
        recent_projects=projects[:6],
        source_status="live",
    )
    await cache_set(cache_key, snapshot.model_dump(), ttl=settings.ttl_funding)
    return snapshot
