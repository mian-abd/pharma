"""Seeded demo data used when live public data is unavailable."""
from __future__ import annotations

from copy import deepcopy
from typing import Any


SEEDED_DRUGS: list[dict[str, Any]] = [
    {
        "rxcui": "5640",
        "brand_name": "Advil",
        "generic_name": "ibuprofen",
        "aliases": ["Ibuprofen", "Advil", "Motrin"],
        "drug_class": "Nonsteroidal anti-inflammatory drugs",
        "manufacturer": "Haleon",
        "trust_score": 79.0,
        "faers_reports": 18420,
        "serious_ratio": 0.17,
        "signal_flag": False,
        "shortage_active": False,
        "trial_count": 62,
        "active_trials": 7,
        "completed_phase3": 9,
        "has_results_pct": 43.0,
        "publications_12mo": 128,
        "publications_5y": 622,
        "market_spend_usd": 182000000.0,
        "market_delta_pct": 2.4,
        "beneficiaries": 1640000,
        "claims": 5420000,
        "fills_30_day": 5630000.0,
        "oop_spend_usd": 32100000.0,
        "payments_usd": 185000.0,
        "peer_names": ["naproxen", "diclofenac", "celecoxib"],
        "trend_reason": "High-volume benchmark analgesic with stable safety profile and broad access.",
        "states": [
            {"region": "Texas", "beneficiary_count": 186000, "total_spend_usd": 21100000.0, "fill_count": 572000.0},
            {"region": "Florida", "beneficiary_count": 175000, "total_spend_usd": 19300000.0, "fill_count": 541000.0},
            {"region": "California", "beneficiary_count": 169000, "total_spend_usd": 18700000.0, "fill_count": 553000.0},
        ],
    },
    {
        "rxcui": "2601723",
        "brand_name": "Ozempic",
        "generic_name": "semaglutide",
        "aliases": ["Ozempic", "Wegovy", "Rybelsus", "semaglutide"],
        "drug_class": "GLP-1 receptor agonists",
        "manufacturer": "Novo Nordisk",
        "trust_score": 66.0,
        "faers_reports": 69300,
        "serious_ratio": 0.31,
        "signal_flag": True,
        "shortage_active": True,
        "trial_count": 134,
        "active_trials": 22,
        "completed_phase3": 14,
        "has_results_pct": 58.0,
        "publications_12mo": 442,
        "publications_5y": 1730,
        "market_spend_usd": 6580000000.0,
        "market_delta_pct": 18.2,
        "beneficiaries": 932000,
        "claims": 4210000,
        "fills_30_day": 3950000.0,
        "oop_spend_usd": 918000000.0,
        "payments_usd": 12400000.0,
        "peer_names": ["tirzepatide", "liraglutide", "dulaglutide"],
        "trend_reason": "Shortage pressure, intense utilization growth, and persistent safety scrutiny drive trend score.",
        "states": [
            {"region": "Florida", "beneficiary_count": 112000, "total_spend_usd": 841000000.0, "fill_count": 422000.0},
            {"region": "Texas", "beneficiary_count": 107000, "total_spend_usd": 824000000.0, "fill_count": 401000.0},
            {"region": "California", "beneficiary_count": 94000, "total_spend_usd": 779000000.0, "fill_count": 383000.0},
        ],
    },
    {
        "rxcui": "263867",
        "brand_name": "Humira",
        "generic_name": "adalimumab",
        "aliases": ["Humira", "adalimumab"],
        "drug_class": "TNF inhibitors",
        "manufacturer": "AbbVie",
        "trust_score": 61.0,
        "faers_reports": 58100,
        "serious_ratio": 0.38,
        "signal_flag": True,
        "shortage_active": False,
        "trial_count": 118,
        "active_trials": 12,
        "completed_phase3": 17,
        "has_results_pct": 64.0,
        "publications_12mo": 221,
        "publications_5y": 1342,
        "market_spend_usd": 7210000000.0,
        "market_delta_pct": -11.3,
        "beneficiaries": 184000,
        "claims": 821000,
        "fills_30_day": 838000.0,
        "oop_spend_usd": 1210000000.0,
        "payments_usd": 14300000.0,
        "peer_names": ["infliximab", "etanercept", "ustekinumab"],
        "trend_reason": "Large spend base, biosimilar competition, and enduring immunosuppression safety monitoring.",
        "states": [
            {"region": "New York", "beneficiary_count": 22600, "total_spend_usd": 765000000.0, "fill_count": 108000.0},
            {"region": "California", "beneficiary_count": 21200, "total_spend_usd": 742000000.0, "fill_count": 101000.0},
            {"region": "Texas", "beneficiary_count": 20300, "total_spend_usd": 711000000.0, "fill_count": 98000.0},
        ],
    },
    {
        "rxcui": "1547545",
        "brand_name": "Keytruda",
        "generic_name": "pembrolizumab",
        "aliases": ["Keytruda", "pembrolizumab"],
        "drug_class": "PD-1 inhibitors",
        "manufacturer": "Merck",
        "trust_score": 58.0,
        "faers_reports": 40800,
        "serious_ratio": 0.44,
        "signal_flag": True,
        "shortage_active": False,
        "trial_count": 241,
        "active_trials": 49,
        "completed_phase3": 25,
        "has_results_pct": 46.0,
        "publications_12mo": 693,
        "publications_5y": 2650,
        "market_spend_usd": 5920000000.0,
        "market_delta_pct": 14.9,
        "beneficiaries": 86000,
        "claims": 312000,
        "fills_30_day": 329000.0,
        "oop_spend_usd": 931000000.0,
        "payments_usd": 9650000.0,
        "peer_names": ["nivolumab", "atezolizumab", "dostarlimab"],
        "trend_reason": "Heavy trial velocity and oncology spend keep this drug near the top of the board.",
        "states": [
            {"region": "California", "beneficiary_count": 10400, "total_spend_usd": 648000000.0, "fill_count": 41200.0},
            {"region": "Texas", "beneficiary_count": 9100, "total_spend_usd": 571000000.0, "fill_count": 36800.0},
            {"region": "Florida", "beneficiary_count": 8900, "total_spend_usd": 552000000.0, "fill_count": 35100.0},
        ],
    },
    {
        "rxcui": "1545660",
        "brand_name": "Jardiance",
        "generic_name": "empagliflozin",
        "aliases": ["Jardiance", "empagliflozin"],
        "drug_class": "SGLT2 inhibitors",
        "manufacturer": "Boehringer Ingelheim",
        "trust_score": 71.0,
        "faers_reports": 28700,
        "serious_ratio": 0.24,
        "signal_flag": False,
        "shortage_active": False,
        "trial_count": 89,
        "active_trials": 18,
        "completed_phase3": 11,
        "has_results_pct": 55.0,
        "publications_12mo": 314,
        "publications_5y": 1198,
        "market_spend_usd": 3310000000.0,
        "market_delta_pct": 16.1,
        "beneficiaries": 517000,
        "claims": 2100000,
        "fills_30_day": 2180000.0,
        "oop_spend_usd": 441000000.0,
        "payments_usd": 5100000.0,
        "peer_names": ["dapagliflozin", "canagliflozin", "semaglutide"],
        "trend_reason": "Cardiorenal evidence momentum plus broad chronic-use volume boosts importance.",
        "states": [
            {"region": "Florida", "beneficiary_count": 62200, "total_spend_usd": 432000000.0, "fill_count": 241000.0},
            {"region": "Texas", "beneficiary_count": 57100, "total_spend_usd": 418000000.0, "fill_count": 228000.0},
            {"region": "California", "beneficiary_count": 53500, "total_spend_usd": 401000000.0, "fill_count": 219000.0},
        ],
    },
    {
        "rxcui": "83367",
        "brand_name": "Lipitor",
        "generic_name": "atorvastatin",
        "aliases": ["Lipitor", "atorvastatin"],
        "drug_class": "Statins",
        "manufacturer": "Pfizer",
        "trust_score": 84.0,
        "faers_reports": 21900,
        "serious_ratio": 0.12,
        "signal_flag": False,
        "shortage_active": False,
        "trial_count": 76,
        "active_trials": 6,
        "completed_phase3": 13,
        "has_results_pct": 63.0,
        "publications_12mo": 181,
        "publications_5y": 812,
        "market_spend_usd": 947000000.0,
        "market_delta_pct": -2.9,
        "beneficiaries": 3540000,
        "claims": 14600000,
        "fills_30_day": 14900000.0,
        "oop_spend_usd": 126000000.0,
        "payments_usd": 260000.0,
        "peer_names": ["rosuvastatin", "simvastatin", "pravastatin"],
        "trend_reason": "High-volume standard-of-care comparator across multiple cardiometabolic drug classes.",
        "states": [
            {"region": "Florida", "beneficiary_count": 382000, "total_spend_usd": 104000000.0, "fill_count": 1610000.0},
            {"region": "Texas", "beneficiary_count": 366000, "total_spend_usd": 99000000.0, "fill_count": 1530000.0},
            {"region": "California", "beneficiary_count": 349000, "total_spend_usd": 96000000.0, "fill_count": 1490000.0},
        ],
    },
    {
        "rxcui": "1364430",
        "brand_name": "Eliquis",
        "generic_name": "apixaban",
        "aliases": ["Eliquis", "apixaban"],
        "drug_class": "Factor Xa inhibitors",
        "manufacturer": "Bristol Myers Squibb",
        "trust_score": 73.0,
        "faers_reports": 33700,
        "serious_ratio": 0.29,
        "signal_flag": True,
        "shortage_active": False,
        "trial_count": 97,
        "active_trials": 11,
        "completed_phase3": 12,
        "has_results_pct": 51.0,
        "publications_12mo": 236,
        "publications_5y": 1024,
        "market_spend_usd": 5420000000.0,
        "market_delta_pct": 9.4,
        "beneficiaries": 1680000,
        "claims": 7210000,
        "fills_30_day": 7340000.0,
        "oop_spend_usd": 711000000.0,
        "payments_usd": 2140000.0,
        "peer_names": ["rivaroxaban", "dabigatran", "warfarin"],
        "trend_reason": "Large anticoagulation footprint with meaningful bleeding signal surveillance.",
        "states": [
            {"region": "Florida", "beneficiary_count": 198000, "total_spend_usd": 671000000.0, "fill_count": 832000.0},
            {"region": "Texas", "beneficiary_count": 184000, "total_spend_usd": 638000000.0, "fill_count": 799000.0},
            {"region": "California", "beneficiary_count": 177000, "total_spend_usd": 621000000.0, "fill_count": 781000.0},
        ],
    },
    {
        "rxcui": "2599541",
        "brand_name": "Mounjaro",
        "generic_name": "tirzepatide",
        "aliases": ["Mounjaro", "Zepbound", "tirzepatide"],
        "drug_class": "Dual GIP/GLP-1 agonists",
        "manufacturer": "Eli Lilly",
        "trust_score": 63.0,
        "faers_reports": 22400,
        "serious_ratio": 0.27,
        "signal_flag": True,
        "shortage_active": True,
        "trial_count": 78,
        "active_trials": 19,
        "completed_phase3": 8,
        "has_results_pct": 39.0,
        "publications_12mo": 267,
        "publications_5y": 518,
        "market_spend_usd": 3920000000.0,
        "market_delta_pct": 34.8,
        "beneficiaries": 502000,
        "claims": 1810000,
        "fills_30_day": 1710000.0,
        "oop_spend_usd": 618000000.0,
        "payments_usd": 7020000.0,
        "peer_names": ["semaglutide", "dulaglutide", "liraglutide"],
        "trend_reason": "Rapid utilization growth, shortage risk, and expanding evidence program make this a top monitor name.",
        "states": [
            {"region": "Texas", "beneficiary_count": 63100, "total_spend_usd": 478000000.0, "fill_count": 205000.0},
            {"region": "Florida", "beneficiary_count": 58900, "total_spend_usd": 463000000.0, "fill_count": 197000.0},
            {"region": "California", "beneficiary_count": 50200, "total_spend_usd": 431000000.0, "fill_count": 182000.0},
        ],
    },
]


_LOOKUP: dict[str, dict[str, Any]] = {}
for item in SEEDED_DRUGS:
    for alias in item["aliases"]:
        _LOOKUP[alias.lower()] = item
    _LOOKUP[item["generic_name"].lower()] = item
    _LOOKUP[item["brand_name"].lower()] = item


def get_seed_drug(name: str | None) -> dict[str, Any] | None:
    if not name:
        return None
    item = _LOOKUP.get(name.strip().lower())
    return deepcopy(item) if item else None


def iter_seed_drugs() -> list[dict[str, Any]]:
    return [deepcopy(item) for item in SEEDED_DRUGS]


def iter_seed_names() -> list[str]:
    seen: set[str] = set()
    names: list[str] = []
    for item in SEEDED_DRUGS:
        for alias in item["aliases"]:
            if alias.lower() not in seen:
                seen.add(alias.lower())
                names.append(alias)
    return names


def get_seed_peers(drug_class: str | None, generic_name: str | None) -> list[dict[str, Any]]:
    generic_name = (generic_name or "").strip().lower()
    item = get_seed_drug(generic_name)
    if item and item.get("peer_names"):
        peer_names = item["peer_names"]
    elif drug_class:
        peer_names = [
            seed["generic_name"]
            for seed in SEEDED_DRUGS
            if seed["drug_class"].lower() == drug_class.lower() and seed["generic_name"].lower() != generic_name
        ][:4]
    else:
        peer_names = [seed["generic_name"] for seed in SEEDED_DRUGS if seed["generic_name"].lower() != generic_name][:4]

    peers = [get_seed_drug(name) for name in peer_names]
    return [peer for peer in peers if peer is not None]
