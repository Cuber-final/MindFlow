import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient


class TestConfigAPI:
    """Tests for /api/config endpoints"""

    @pytest.fixture
    def mock_ai_config(self):
        """Mock AI config data"""
        return {
            "id": 1,
            "provider": "siliconflow",
            "api_key": "sk-test123",
            "base_url": "https://api.siliconflow.cn/v1",
            "model": "Qwen/Qwen2.5-7B-Instruct",
            "updated_at": "2026-04-08 10:00:00"
        }

    @pytest.fixture
    def client(self):
        """Create test client"""
        from main import app
        return TestClient(app)

    def test_get_ai_config(self, client, mock_ai_config):
        """Test getting AI config"""
        with patch("routers.config.get_ai_config") as mock_get:
            mock_get.return_value = mock_ai_config
            response = client.get("/api/config/ai")
            assert response.status_code == 200
            data = response.json()
            assert data["provider"] == "siliconflow"
            assert data["model"] == "Qwen/Qwen2.5-7B-Instruct"
            assert data["has_api_key"] is True

    def test_get_ai_config_empty(self, client):
        """Test getting AI config when not set - returns defaults without api_key"""
        with patch("routers.config.get_ai_config") as mock_get:
            mock_get.return_value = None
            response = client.get("/api/config/ai")
            assert response.status_code == 200
            data = response.json()
            assert data["provider"] == "siliconflow"
            assert data["base_url"] == "https://api.siliconflow.cn/v1"
            assert data["model"] == "Qwen/Qwen2.5-7B-Instruct"
            assert data["has_api_key"] is False
            # api_key is NOT included in response for security reasons
            assert "api_key" not in data

    def test_update_ai_config(self, client):
        """Test updating AI config"""
        with patch("routers.config.get_ai_config") as mock_get, \
             patch("routers.config.test_ai_connection") as mock_test, \
             patch("routers.config.update_ai_config") as mock_update:
            mock_get.return_value = {
                "id": 1,
                "provider": "siliconflow",
                "api_key": "sk-old",
                "base_url": "https://api.siliconflow.cn/v1",
                "model": "Qwen/Qwen2.5-7B-Instruct",
            }
            mock_test.return_value = (True, "连接成功")
            mock_update.return_value = None
            response = client.put("/api/config/ai", json={
                "provider": "siliconflow",
                "api_key": "sk-newkey456",
                "base_url": "https://api.siliconflow.cn/v1",
                "model": "Qwen/Qwen2.5-7B-Instruct"
            })
            assert response.status_code == 200
            assert response.json()["success"] is True

    def test_test_ai_connection_success(self, client):
        """Test AI connection test success"""
        with patch("routers.config.get_ai_config") as mock_get, \
             patch("routers.config.test_ai_connection") as mock_test:
            mock_get.return_value = {
                "id": 1,
                "provider": "siliconflow",
                "api_key": "sk-old",
                "base_url": "https://api.siliconflow.cn/v1",
                "model": "Qwen/Qwen2.5-7B-Instruct",
            }
            mock_test.return_value = (True, "连接成功")
            response = client.post("/api/config/ai/test", json={
                "provider": "siliconflow",
                "api_key": "sk-draft",
                "base_url": "https://api.siliconflow.cn/v1",
                "model": "Qwen/Qwen2.5-7B-Instruct",
                "use_stored_api_key": True
            })
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert "成功" in data["message"]

    def test_test_ai_connection_failure(self, client):
        """Test AI connection test failure"""
        with patch("routers.config.get_ai_config") as mock_get, \
             patch("services.ai.test_ai_connection") as mock_test:
            mock_get.return_value = {
                "id": 1,
                "provider": "siliconflow",
                "api_key": "sk-old",
                "base_url": "https://api.siliconflow.cn/v1",
                "model": "Qwen/Qwen2.5-7B-Instruct",
            }
            mock_test.return_value = (False, "API Key无效")
            response = client.post("/api/config/ai/test", json={
                "provider": "siliconflow",
                "api_key": "",
                "base_url": "https://api.siliconflow.cn/v1",
                "model": "Qwen/Qwen2.5-7B-Instruct",
                "use_stored_api_key": True
            })
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is False

    def test_get_schedule(self, client):
        """Test getting schedule"""
        with patch("routers.config.get_jobs") as mock_get:
            mock_get.return_value = [
                {
                    "id": "daily_fetch",
                    "name": "fetch_all_sources_job",
                    "next_run": "2026-04-09 08:00:00"
                }
            ]
            response = client.get("/api/config/schedule")
            assert response.status_code == 200
            data = response.json()
            assert len(data["jobs"]) == 1
            assert data["jobs"][0]["id"] == "daily_fetch"

    def test_update_schedule(self, client):
        """Test updating schedule"""
        with patch("routers.config.update_schedule") as mock_update:
            mock_update.return_value = None
            response = client.put("/api/config/schedule", json=[8, 12, 18, 20])
            assert response.status_code == 200
            assert response.json()["success"] is True

    def test_update_schedule_empty(self, client):
        """Test updating schedule with empty list"""
        response = client.put("/api/config/schedule", json=[])
        assert response.status_code == 200
        assert response.json()["success"] is False
