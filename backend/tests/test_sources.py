import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient


class TestSourcesAPI:
    """Tests for /api/sources endpoints"""

    @pytest.fixture
    def mock_sources(self):
        """Mock source data"""
        return [
            {
                "id": 1,
                "name": "测试源1",
                "source_type": "native_rss",
                "api_base_url": "https://example.com/feed.xml",
                "auth_key": "",
                "config": '{"feed_url": "https://example.com/feed.xml"}',
                "created_at": "2026-04-08 10:00:00",
                "updated_at": "2026-04-08 10:00:00",
                "last_fetch_at": None,
                "article_count": 0
            },
            {
                "id": 2,
                "name": "测试源2",
                "source_type": "we_mp_rss",
                "provider_source_id": "MP_WXS_3941633310",
                "api_base_url": "https://rss.example.com/feed/123.xml",
                "auth_key": "",
                "config": '{"feed_url": "https://rss.example.com/feed/123.xml"}',
                "created_at": "2026-04-08 11:00:00",
                "updated_at": "2026-04-08 11:00:00",
                "last_fetch_at": "2026-04-08 12:00:00",
                "article_count": 10
            }
        ]

    @pytest.fixture
    def client(self):
        """Create test client"""
        from main import app
        return TestClient(app)

    def test_list_sources_empty(self, client):
        """Test listing sources when empty"""
        with patch("routers.sources.get_all_sources") as mock_get:
            mock_get.return_value = []
            response = client.get("/api/sources")
            assert response.status_code == 200
            assert response.json() == []

    def test_list_sources_with_data(self, client, mock_sources):
        """Test listing sources with data"""
        with patch("routers.sources.get_all_sources") as mock_get:
            mock_get.return_value = mock_sources
            response = client.get("/api/sources")
            assert response.status_code == 200
            data = response.json()
            assert len(data) == 2
            assert data[0]["name"] == "测试源1"
            assert data[0]["config"]["feed_url"] == "https://example.com/feed.xml"
            assert data[1]["provider_source_id"] == "MP_WXS_3941633310"

    def test_list_sources_tolerates_nullable_legacy_fields(self, client):
        """Test listing sources when legacy rows contain nullable fields."""
        with patch("routers.sources.get_all_sources") as mock_get:
            mock_get.return_value = [
                {
                    "id": 1,
                    "name": "旧数据源",
                    "source_type": "native_rss",
                    "api_base_url": "https://example.com",
                    "auth_key": None,
                    "config": None,
                    "created_at": "2026-04-12 10:00:00",
                    "updated_at": "2026-04-12 10:00:00",
                    "last_fetch_at": None,
                    "article_count": None,
                }
            ]
            response = client.get("/api/sources")
            assert response.status_code == 200
            data = response.json()
            assert len(data) == 1
            assert data[0]["auth_key"] == ""
            assert data[0]["config"] == {}
            assert data[0]["article_count"] == 0

    def test_get_source_by_id(self, client, mock_sources):
        """Test getting single source"""
        with patch("routers.sources.get_source_by_id") as mock_get:
            mock_get.return_value = mock_sources[0]
            response = client.get("/api/sources/1")
            assert response.status_code == 200
            data = response.json()
            assert data["name"] == "测试源1"
            assert "provider_source_id" in data

    def test_get_source_not_found(self, client):
        """Test getting non-existent source"""
        with patch("routers.sources.get_source_by_id") as mock_get:
            mock_get.return_value = None
            response = client.get("/api/sources/999")
            assert response.status_code == 404

    def test_get_we_mprss_auth_template_returns_latest_registered_credentials(self, client):
        """Test loading a reusable we-mp-rss auth template from existing sources."""
        with patch("routers.sources.get_all_sources") as mock_get:
            mock_get.return_value = [
                {
                    "id": 3,
                    "name": "无认证公众号",
                    "source_type": "we_mp_rss",
                    "api_base_url": "https://rss.example.com/feed/no-auth.xml",
                    "auth_key": "",
                    "config": {"we_mprss_auth": {"username": "", "password": ""}},
                    "created_at": "2026-04-08 12:00:00",
                    "updated_at": "2026-04-08 12:00:00",
                    "last_fetch_at": None,
                    "article_count": 0,
                },
                {
                    "id": 2,
                    "name": "已认证公众号",
                    "source_type": "we_mp_rss",
                    "api_base_url": "https://rss.example.com/feed/123.xml",
                    "auth_key": "cached-token",
                    "config": {
                        "we_mprss_auth": {
                            "username": "admin",
                            "password": "secret",
                            "access_token": "token-1",
                        }
                    },
                    "created_at": "2026-04-08 11:00:00",
                    "updated_at": "2026-04-08 11:00:00",
                    "last_fetch_at": "2026-04-08 12:00:00",
                    "article_count": 10,
                },
            ]

            response = client.get("/api/sources/we-mp-rss-auth-template")

            assert response.status_code == 200
            data = response.json()
            assert data == {
                "available": True,
                "source_id": 2,
                "source_name": "已认证公众号",
                "username": "admin",
                "password": "secret",
            }

    def test_get_we_mprss_auth_template_returns_empty_when_none_registered(self, client):
        """Test auth template response when no reusable we-mp-rss credentials exist."""
        with patch("routers.sources.get_all_sources") as mock_get:
            mock_get.return_value = [
                {
                    "id": 1,
                    "name": "普通 RSS",
                    "source_type": "native_rss",
                    "api_base_url": "https://example.com/feed.xml",
                    "auth_key": "",
                    "config": {"feed_url": "https://example.com/feed.xml"},
                    "created_at": "2026-04-08 10:00:00",
                    "updated_at": "2026-04-08 10:00:00",
                    "last_fetch_at": None,
                    "article_count": 0,
                }
            ]

            response = client.get("/api/sources/we-mp-rss-auth-template")

            assert response.status_code == 200
            assert response.json() == {
                "available": False,
                "source_id": None,
                "source_name": None,
                "username": "",
                "password": "",
            }

    def test_create_source(self, client):
        """Test creating a new source"""
        with patch("routers.sources.create_source") as mock_create, \
             patch("routers.sources.get_source_by_id") as mock_get:
            mock_create.return_value = 1
            mock_get.return_value = {
                "id": 1,
                "name": "新源",
                "source_type": "rsshub",
                "api_base_url": "https://rsshub.example.com/github/trending/daily",
                "auth_key": "",
                "config": '{"feed_url": "https://rsshub.example.com/github/trending/daily"}',
                "created_at": "2026-04-08 10:00:00",
                "updated_at": "2026-04-08 10:00:00",
                "last_fetch_at": None,
                "article_count": 0
            }
            response = client.post("/api/sources", json={
                "name": "新源",
                "source_type": "rsshub",
                "api_base_url": "https://rsshub.example.com/github/trending/daily",
                "auth_key": "",
                "config": {"feed_url": "https://rsshub.example.com/github/trending/daily"}
            })
            assert response.status_code == 200
            data = response.json()
            assert data["name"] == "新源"
            assert data["source_type"] == "rsshub"

    def test_create_source_rejects_legacy_mptext_type(self, client):
        """Test legacy mptext sources are no longer accepted."""
        response = client.post("/api/sources", json={
            "name": "旧公众号源",
            "source_type": "mptext",
            "api_base_url": "https://down.mptext.top",
            "auth_key": "",
            "config": {"fakeid": "legacy-fakeid"}
        })
        assert response.status_code == 422

    def test_update_source(self, client, mock_sources):
        """Test updating a source"""
        with patch("routers.sources.get_source_by_id") as mock_get, \
             patch("routers.sources.update_source") as mock_update:
            mock_get.return_value = mock_sources[0]
            mock_update.return_value = True

            # Mock get_source_by_id for after update
            updated_source = {**mock_sources[0], "name": "更新后的名称"}
            mock_get.return_value = updated_source

            response = client.put("/api/sources/1", json={"name": "更新后的名称"})
            assert response.status_code == 200
            data = response.json()
            assert data["name"] == "更新后的名称"

    def test_delete_source(self, client, mock_sources):
        """Test deleting a source"""
        with patch("routers.sources.get_source_by_id") as mock_get, \
             patch("routers.sources.delete_source") as mock_delete:
            mock_get.return_value = mock_sources[0]
            mock_delete.return_value = True

            response = client.delete("/api/sources/1")
            assert response.status_code == 200
            assert response.json()["success"] is True
