import pytest
import warnings
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient


class TestHealthEndpoints:
    """Tests for health check endpoints"""

    @pytest.fixture
    def client(self):
        """Create test client"""
        from main import app
        return TestClient(app)

    def test_root_endpoint(self, client):
        """Test root endpoint returns correct info"""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "AI News Aggregator API"
        assert data["version"] == "1.0.0"

    def test_health_endpoint(self, client):
        """Test health check endpoint"""
        with patch("main.check_db_health", new=AsyncMock(return_value=True)):
            response = client.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"

    def test_health_endpoint_when_database_is_down(self, client):
        """Test health check endpoint reports database outages."""
        with patch("main.check_db_health", new=AsyncMock(return_value=False)):
            response = client.get("/health")

        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "unhealthy"
        assert data["database"] == "down"

    def test_testclient_does_not_emit_httpx_app_deprecation(self):
        """Test TestClient construction stays compatible with current httpx."""
        from main import app

        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter("always", DeprecationWarning)
            client = TestClient(app)
            client.close()

        app_shortcut_warnings = [
            warning
            for warning in caught
            if "The 'app' shortcut is now deprecated" in str(warning.message)
        ]
        assert app_shortcut_warnings == []
