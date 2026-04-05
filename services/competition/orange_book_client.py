"""Orange Book client for competition, patent, and exclusivity context."""
from __future__ import annotations

import csv
import io
import logging
import re
import time
from pathlib import Path
from typing import Iterable, Optional
from zipfile import ZipFile

from services.shared.config import settings
from services.shared.dashboard_models import (
    OrangeBookExclusivity,
    OrangeBookPatent,
    OrangeBookSnapshot,
)
from services.shared.http_client import fetch_bytes_with_retry

logger = logging.getLogger(__name__)

_ZIP_CACHE: tuple[float, bytes] | None = None
_ZIP_CACHE_TTL = 86400.0


def _normalize_header(value: str) -> str:
    return re.sub(r"[^A-Z0-9]+", "_", (value or "").strip().upper()).strip("_")


def _pick(row: dict[str, str], keys: Iterable[str]) -> str:
    for key in keys:
        value = row.get(key)
        if value:
            return str(value).strip()
    return ""


def _clean_app_number(value: Optional[str]) -> str:
    digits = "".join(ch for ch in str(value or "") if ch.isdigit())
    if not digits:
        return ""
    return digits[-6:].zfill(6)


def _parse_zip_table(zip_bytes: bytes, filename_hint: str) -> list[dict[str, str]]:
    with ZipFile(io.BytesIO(zip_bytes)) as archive:
        member = next(
            (name for name in archive.namelist() if filename_hint.lower() in name.lower()),
            None,
        )
        if not member:
            return []
        with archive.open(member) as fh:
            text = fh.read().decode("utf-8", errors="replace")
        reader = csv.DictReader(io.StringIO(text), delimiter="~")
        rows: list[dict[str, str]] = []
        for row in reader:
            rows.append({_normalize_header(k): (v or "").strip() for k, v in row.items() if k})
        return rows


async def _load_orange_book_zip() -> Optional[bytes]:
    global _ZIP_CACHE

    if _ZIP_CACHE and _ZIP_CACHE[0] > time.time():
        return _ZIP_CACHE[1]

    if settings.orange_book_data_path:
        path = Path(settings.orange_book_data_path)
        if path.exists():
            data = path.read_bytes()
            _ZIP_CACHE = (time.time() + _ZIP_CACHE_TTL, data)
            return data

    if not settings.orange_book_data_url:
        return None

    try:
        data = await fetch_bytes_with_retry(
            settings.orange_book_data_url,
            max_retries=1,
            base_delay=0.4,
            timeout_seconds=12.0,
            headers={"User-Agent": "PharmaCortex/1.0 OrangeBook"},
        )
        if data:
            _ZIP_CACHE = (time.time() + _ZIP_CACHE_TTL, data)
        return data
    except Exception as exc:
        logger.warning("Orange Book download failed: %s", exc)
        return None


def _match_product_rows(
    products: list[dict[str, str]],
    brand_name: str,
    generic_name: str,
    application_number: str,
) -> list[dict[str, str]]:
    app_no = _clean_app_number(application_number)
    brand = (brand_name or "").upper().strip()
    generic = (generic_name or "").upper().strip()

    matched: list[dict[str, str]] = []
    for row in products:
        row_app = _clean_app_number(_pick(row, ("APPL_NO", "APPLICATION_NUMBER", "NDA_NUMBER")))
        ingredient = _pick(row, ("INGREDIENT",)).upper()
        trade_name = _pick(row, ("TRADE_NAME", "PROPRIETARY_NAME")).upper()

        if app_no and row_app == app_no:
            matched.append(row)
            continue
        if brand and brand == trade_name:
            matched.append(row)
            continue
        if generic and generic in ingredient:
            matched.append(row)
    return matched


def _sort_date_value(value: Optional[str]) -> tuple[int, str]:
    text = (value or "").strip()
    if not text:
        return (0, "")
    return (1, text)


async def get_orange_book_snapshot(
    brand_name: str,
    generic_name: str,
    application_number: Optional[str],
) -> OrangeBookSnapshot:
    zip_bytes = await _load_orange_book_zip()
    if not zip_bytes:
        return OrangeBookSnapshot(
            application_number=_clean_app_number(application_number),
            applicant=None,
            approval_date=None,
            dosage_form_route=None,
            therapeutic_equivalence_codes=[],
            patents=[],
            exclusivities=[],
            source_status="demo",
        )

    try:
        products = _parse_zip_table(zip_bytes, "product")
        patents = _parse_zip_table(zip_bytes, "patent")
        exclusivities = _parse_zip_table(zip_bytes, "exclus")

        subject_rows = _match_product_rows(products, brand_name, generic_name, application_number or "")
        if not subject_rows:
            return OrangeBookSnapshot(
                application_number=_clean_app_number(application_number),
                applicant=None,
                approval_date=None,
                dosage_form_route=None,
                therapeutic_equivalence_codes=[],
                patents=[],
                exclusivities=[],
                source_status="live",
            )

        # Prefer the reference listed product row when available.
        subject_rows.sort(
            key=lambda row: (
                _pick(row, ("RLD",)) != "RLD",
                _pick(row, ("APPL_TYPE",)) == "A",
            )
        )
        primary = subject_rows[0]

        subject_app_numbers = {
            _clean_app_number(_pick(row, ("APPL_NO", "APPLICATION_NUMBER", "NDA_NUMBER")))
            for row in subject_rows
        }
        subject_app_numbers.discard("")

        ingredient = _pick(primary, ("INGREDIENT",)).upper()
        dosage_form_route = _pick(primary, ("DF_ROUTE", "DOSAGE_FORM_ROUTE", "DOSAGE_FORM_ROUTE_OF_ADMINISTRATION"))

        therapeutic_codes = sorted(
            {
                _pick(row, ("TE_CODE", "THERAPEUTIC_EQUIVALENCE_CODE"))
                for row in subject_rows
                if _pick(row, ("TE_CODE", "THERAPEUTIC_EQUIVALENCE_CODE"))
            }
        )

        generic_equivalent_count = 0
        if ingredient:
            for row in products:
                if _pick(row, ("APPL_TYPE",)) != "A":
                    continue
                if ingredient not in _pick(row, ("INGREDIENT",)).upper():
                    continue
                other_dosage = _pick(row, ("DF_ROUTE", "DOSAGE_FORM_ROUTE", "DOSAGE_FORM_ROUTE_OF_ADMINISTRATION"))
                if dosage_form_route and other_dosage and other_dosage != dosage_form_route:
                    continue
                generic_equivalent_count += 1

        patent_rows = [
            row for row in patents
            if _clean_app_number(_pick(row, ("APPL_NO", "APPLICATION_NUMBER", "NDA_NUMBER"))) in subject_app_numbers
        ]
        exclusivity_rows = [
            row for row in exclusivities
            if _clean_app_number(_pick(row, ("APPL_NO", "APPLICATION_NUMBER", "NDA_NUMBER"))) in subject_app_numbers
        ]

        patent_models = [
            OrangeBookPatent(
                patent_number=_pick(row, ("PATENT_NO", "PATENT_NUMBER")),
                expire_date=_pick(row, ("PATENT_EXPIRE_DATE", "PATENT_EXPIRATION_DATE")) or None,
                use_code=_pick(row, ("PATENT_USE_CODE", "USE_CODE")) or None,
                drug_substance_flag=_pick(row, ("DRUG_SUBSTANCE_FLAG",)) == "Y",
                drug_product_flag=_pick(row, ("DRUG_PRODUCT_FLAG",)) == "Y",
            )
            for row in sorted(
                patent_rows,
                key=lambda row: _sort_date_value(
                    _pick(row, ("PATENT_EXPIRE_DATE", "PATENT_EXPIRATION_DATE"))
                ),
                reverse=True,
            )[:6]
            if _pick(row, ("PATENT_NO", "PATENT_NUMBER"))
        ]

        exclusivity_models = [
            OrangeBookExclusivity(
                code=_pick(row, ("EXCLUSIVITY_CODE", "EXCL_CODE")),
                expire_date=_pick(row, ("EXCLUSIVITY_DATE", "EXCL_DATE")) or None,
            )
            for row in sorted(
                exclusivity_rows,
                key=lambda row: _sort_date_value(_pick(row, ("EXCLUSIVITY_DATE", "EXCL_DATE"))),
                reverse=True,
            )[:6]
            if _pick(row, ("EXCLUSIVITY_CODE", "EXCL_CODE"))
        ]

        return OrangeBookSnapshot(
            application_number=_clean_app_number(_pick(primary, ("APPL_NO", "APPLICATION_NUMBER", "NDA_NUMBER")) or application_number),
            applicant=_pick(primary, ("APPLICANT_FULL_NAME", "APPLICANT")) or None,
            approval_date=_pick(primary, ("APPROVAL_DATE",)) or None,
            dosage_form_route=dosage_form_route or None,
            reference_listed_drug=_pick(primary, ("RLD",)) == "RLD",
            reference_standard=_pick(primary, ("RS",)) == "RS",
            generic_equivalent_count=generic_equivalent_count,
            therapeutic_equivalence_codes=therapeutic_codes,
            patents=patent_models,
            exclusivities=exclusivity_models,
            source_status="live",
        )
    except Exception as exc:
        logger.warning("Orange Book parse failed for %s/%s: %s", brand_name, generic_name, exc)
        return OrangeBookSnapshot(
            application_number=_clean_app_number(application_number),
            applicant=None,
            approval_date=None,
            dosage_form_route=None,
            therapeutic_equivalence_codes=[],
            patents=[],
            exclusivities=[],
            source_status="degraded",
        )
