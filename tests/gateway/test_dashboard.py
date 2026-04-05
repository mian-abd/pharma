"""Tests for dashboard home and snapshot routes."""
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from services.gateway.main import app

client = TestClient(app)


def test_dashboard_home_contract():
    payload = {
        "generated_at": "2026-04-04T00:00:00Z",
        "ticker_items": ["system online"],
        "source_health": [],
        "global_alerts": [],
        "trending_drugs": [],
        "featured_watchlist": [],
        "market_movers": [],
    }
    with patch("services.gateway.routers.dashboard.build_dashboard_home", new_callable=AsyncMock) as mock_home:
        mock_home.return_value = payload
        response = client.get("/api/dashboard/home")
        assert response.status_code == 200
        assert response.json()["ticker_items"] == ["system online"]


def test_dashboard_drug_validation():
    response = client.get("/api/dashboard/drug/bad<script>")
    assert response.status_code == 400


def test_dashboard_drug_not_found():
    with patch("services.gateway.routers.dashboard.build_drug_command_center", new_callable=AsyncMock) as mock_snapshot:
        mock_snapshot.return_value = None
        response = client.get("/api/dashboard/drug/Ozempic")
        assert response.status_code == 404


def test_dashboard_drug_success():
    payload = {
        "generated_at": "2026-04-04T00:00:00Z",
        "drug_name": "Ozempic",
        "rxcui": "2601723",
        "brand_name": "Ozempic",
        "generic_name": "semaglutide",
        "manufacturer": "Novo Nordisk",
        "drug_class": "GLP-1 receptor agonists",
        "indication": "",
        "patent_expiry": None,
        "nnt_trial": None,
        "nnt_realworld": None,
        "arr_trial": None,
        "rrr_trial": None,
        "pivot_trial_name": None,
        "trust_score": 66.0,
        "trust_score_breakdown": {"evidence_quality": 80.0, "safety_signal": 55.0, "trial_real_gap": 60.0, "formulary_access": 48.0},
        "faers": None,
        "trials": [],
        "formulary": [],
        "fda_signals": [],
        "rep_brief": None,
        "source_statuses": {"faers": "live"},
        "label_history": [],
        "shortage_status": None,
        "market": {
            "data_year": 2024,
            "beneficiary_count": 1,
            "total_claims": 1,
            "total_30_day_fills": 1.0,
            "total_spend_usd": 1.0,
            "out_of_pocket_spend_usd": 1.0,
            "yoy_spend_change_pct": 1.0,
            "yoy_claim_change_pct": 1.0,
            "top_regions": [],
            "source_status": "demo",
        },
        "evidence": {
            "publication_count_12mo": 1,
            "publication_count_5y": 1,
            "literature_velocity_score": 1.0,
            "active_trials": 1,
            "completed_phase3_trials": 1,
            "has_results_pct": 1.0,
            "recent_publications": [],
            "source_status": "demo",
        },
        "approval": {
            "sponsor_name": "Novo Nordisk",
            "approval_date": None,
            "application_number": None,
            "dosage_form": None,
            "route": None,
            "source_status": "demo",
        },
        "influence": {
            "rxcui": "2601723",
            "drug_name": "Ozempic",
            "total_payments_usd": 1.0,
            "hcp_count": 1,
            "company_count": 1,
            "top_specialties": [],
            "top_companies": [],
            "payment_types": [],
            "yearly_trend": [],
            "data_year": 2023,
            "source_status": "demo",
        },
        "peer_comparison": {"benchmark": "class_peers", "rationale": "demo", "rows": []},
        "live_alerts": [],
        "source_health": [],
        "trending_reason": "demo",
    }
    with patch("services.gateway.routers.dashboard.build_drug_command_center", new_callable=AsyncMock) as mock_snapshot:
        mock_snapshot.return_value = payload
        response = client.get("/api/dashboard/drug/Ozempic")
        assert response.status_code == 200
        assert response.json()["generic_name"] == "semaglutide"
