"""CMS Medicare Part D market snapshot with CSV ingestion support and seeded fallback."""
from __future__ import annotations

import io
import logging
from collections import defaultdict
from pathlib import Path

import pandas as pd

from services.shared.cache import cache_get, cache_set
from services.shared.config import settings
from services.shared.dashboard_models import MarketRegionPoint, MarketSnapshot
from services.shared.demo_data import get_seed_drug
from services.shared.http_client import fetch_bytes_with_retry

logger = logging.getLogger(__name__)

_NAME_COLUMNS = ("BRND_NAME", "GNRC_NAME", "DRUG_NAME", "GENERIC_NAME")
_STATE_COLUMNS = ("PRSCRBR_GEO_DESC", "STATE", "GEOGRAPHY", "GEO_DESC")
_BENE_COLUMNS = ("TOT_BENES", "BENE_COUNT", "BENEFICIARY_COUNT")
_CLAIM_COLUMNS = ("TOT_CLMS", "CLAIM_COUNT", "TOTAL_CLAIMS")
_FILL_COLUMNS = ("TOT30_DAY_FILLS", "TOT_30_DAY_FILLS", "THIRTY_DAY_FILLS", "FILL_COUNT")
_SPEND_COLUMNS = ("TOT_DRUG_CST", "TOTAL_DRUG_COST", "SPEND_USD", "TOTAL_SPEND_USD")
_OOP_COLUMNS = ("LIS_BENE_CST_SHR", "NONLIS_BENE_CST_SHR", "BENE_COST_SHARE_AMT", "OUT_OF_POCKET_USD")


async def get_market_snapshot(
    drug_name: str,
    generic_name: str | None = None,
    brand_name: str | None = None,
) -> MarketSnapshot:
    cache_key = f"market:{(generic_name or drug_name).lower()}"
    cached = await cache_get(cache_key)
    if cached:
        return MarketSnapshot(**cached)

    snapshot = None
    try:
        rows = await _collect_matching_rows(drug_name, generic_name, brand_name)
        if rows:
            snapshot = _aggregate_rows(rows, drug_name, generic_name, brand_name)
    except Exception as exc:
        logger.warning("CMS Part D market snapshot fallback for %s: %s", drug_name, exc)

    if snapshot is None:
        snapshot = _seed_snapshot(drug_name, generic_name, brand_name)

    await cache_set(cache_key, snapshot.model_dump(), ttl=settings.ttl_market)
    return snapshot


async def _collect_matching_rows(
    drug_name: str,
    generic_name: str | None,
    brand_name: str | None,
) -> list[dict]:
    source_path = settings.cms_partd_geography_csv_path
    source_url = settings.cms_partd_geography_csv_url
    names = {n.strip().lower() for n in (drug_name, generic_name or "", brand_name or "") if n and n.strip()}
    if not names:
        return []

    if source_path and Path(source_path).exists():
        return list(_iter_matching_rows(pd.read_csv(source_path, chunksize=50000, dtype=str), names))

    if source_url:
        csv_bytes = await fetch_bytes_with_retry(source_url, max_retries=1, base_delay=0.4)
        if csv_bytes:
            buffer = io.BytesIO(csv_bytes)
            return list(_iter_matching_rows(pd.read_csv(buffer, chunksize=50000, dtype=str), names))

    return []


def _iter_matching_rows(chunks, names: set[str]):
    for chunk in chunks:
        cols = {str(col).upper().strip(): col for col in chunk.columns}
        name_columns = [cols[c] for c in _NAME_COLUMNS if c in cols]
        if not name_columns:
            continue

        mask = None
        for column in name_columns:
            series = chunk[column].fillna("").astype(str).str.lower().str.strip()
            current = series.isin(names)
            mask = current if mask is None else (mask | current)

        if mask is None:
            continue

        for _, row in chunk.loc[mask].iterrows():
            normalized = {str(key).upper().strip(): value for key, value in row.items()}
            yield normalized


def _first_value(row: dict, columns: tuple[str, ...], default: float = 0.0) -> float:
    for column in columns:
        if column in row and str(row[column]).strip() not in ("", "nan", "None"):
            try:
                return float(str(row[column]).replace(",", ""))
            except ValueError:
                return default
    return default


def _first_text(row: dict, columns: tuple[str, ...], default: str = "") -> str:
    for column in columns:
        value = row.get(column)
        if value and str(value).strip():
            return str(value).strip()
    return default


def _aggregate_rows(rows: list[dict], drug_name: str, generic_name: str | None, brand_name: str | None) -> MarketSnapshot:
    regions: dict[str, dict[str, float]] = defaultdict(lambda: {"beneficiaries": 0.0, "spend": 0.0, "fills": 0.0})

    bene_total = 0.0
    claim_total = 0.0
    fill_total = 0.0
    spend_total = 0.0
    oop_total = 0.0

    for row in rows:
        bene = _first_value(row, _BENE_COLUMNS)
        claims = _first_value(row, _CLAIM_COLUMNS)
        fills = _first_value(row, _FILL_COLUMNS)
        spend = _first_value(row, _SPEND_COLUMNS)
        oop = sum(_first_value(row, (column,), 0.0) for column in _OOP_COLUMNS)
        region = _first_text(row, _STATE_COLUMNS, "National")

        bene_total += bene
        claim_total += claims
        fill_total += fills
        spend_total += spend
        oop_total += oop
        regions[region]["beneficiaries"] += bene
        regions[region]["spend"] += spend
        regions[region]["fills"] += fills

    seed = get_seed_drug(generic_name or drug_name or brand_name or "") or {}
    top_regions = sorted(
        (
            MarketRegionPoint(
                region=region,
                beneficiary_count=int(values["beneficiaries"]),
                total_spend_usd=round(values["spend"], 2),
                fill_count=round(values["fills"], 1),
            )
            for region, values in regions.items()
        ),
        key=lambda item: item.total_spend_usd,
        reverse=True,
    )[:5]

    return MarketSnapshot(
        data_year=settings.cms_partd_data_year,
        beneficiary_count=int(bene_total),
        total_claims=int(claim_total),
        total_30_day_fills=round(fill_total, 1),
        total_spend_usd=round(spend_total, 2),
        out_of_pocket_spend_usd=round(oop_total, 2),
        yoy_spend_change_pct=float(seed.get("market_delta_pct", 0.0)),
        yoy_claim_change_pct=round(float(seed.get("market_delta_pct", 0.0)) * 0.62, 1),
        top_regions=top_regions,
        source_status="live",
    )


def _seed_snapshot(drug_name: str, generic_name: str | None, brand_name: str | None) -> MarketSnapshot:
    seed = get_seed_drug(generic_name or brand_name or drug_name) or {}
    top_regions = [MarketRegionPoint(**region) for region in seed.get("states", [])]
    return MarketSnapshot(
        data_year=settings.cms_partd_data_year,
        beneficiary_count=int(seed.get("beneficiaries", 0)),
        total_claims=int(seed.get("claims", 0)),
        total_30_day_fills=float(seed.get("fills_30_day", 0.0)),
        total_spend_usd=float(seed.get("market_spend_usd", 0.0)),
        out_of_pocket_spend_usd=float(seed.get("oop_spend_usd", 0.0)),
        yoy_spend_change_pct=float(seed.get("market_delta_pct", 0.0)),
        yoy_claim_change_pct=round(float(seed.get("market_delta_pct", 0.0)) * 0.62, 1),
        top_regions=top_regions,
        source_status="demo",
    )
