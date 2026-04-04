"""Tests for gateway router input validation and endpoint contracts."""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch

from services.gateway.main import app

client = TestClient(app)


class TestDrugRouterValidation:
    def test_drug_name_with_special_chars_returns_400(self):
        with patch("services.gateway.routers.drugs.build_drug_bundle", new_callable=AsyncMock) as mock_bundle:
            response = client.get("/api/drug/Ozempic<script>")
            assert response.status_code == 400

    def test_drug_name_too_short_returns_422(self):
        response = client.get("/api/drug/a")
        assert response.status_code == 422

    def test_valid_drug_name_calls_build_bundle(self):
        with patch("services.gateway.routers.drugs.build_drug_bundle", new_callable=AsyncMock) as mock_bundle:
            mock_bundle.return_value = None
            response = client.get("/api/drug/Ozempic")
            assert response.status_code == 404
            mock_bundle.assert_called_once_with("Ozempic")

    def test_drug_with_hyphen_is_valid(self):
        with patch("services.gateway.routers.drugs.build_drug_bundle", new_callable=AsyncMock) as mock_bundle:
            mock_bundle.return_value = None
            response = client.get("/api/drug/atorvastatin-calcium")
            assert response.status_code == 404


class TestSearchRouter:
    def test_prefix_too_short_returns_422(self):
        response = client.get("/api/search/autocomplete?prefix=a")
        assert response.status_code == 422

    def test_prefix_with_sql_injection_returns_400(self):
        response = client.get("/api/search/autocomplete?prefix='; DROP TABLE--")
        assert response.status_code == 400

    def test_valid_prefix_calls_autocomplete(self):
        with patch("services.gateway.routers.search.autocomplete", new_callable=AsyncMock) as mock_auto:
            mock_auto.return_value = ["Ozempic", "Ozempic Flex"]
            response = client.get("/api/search/autocomplete?prefix=Ozem")
            assert response.status_code == 200
            assert "Ozempic" in response.json()


class TestRootEndpoint:
    def test_root_returns_service_info(self):
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["service"] == "PharmaCortex API Gateway"
        assert "docs" in data
