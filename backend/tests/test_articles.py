import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from datetime import datetime


class TestArticlesAPI:
    """Tests for /api/articles endpoints"""

    @pytest.fixture
    def mock_articles(self):
        """Mock article data"""
        return [
            {
                "id": 1,
                "source_id": 1,
                "external_id": "mid123",
                "provider_article_id": "wx-100",
                "title": "测试文章1",
                "link": "https://example.com/article/1",
                "content": "这是文章内容...",
                "summary": "",
                "author": "测试源1",
                "published_at": "2026-04-08 10:00:00",
                "fetched_at": "2026-04-08 10:05:00",
                "content_html": "<article><p>这是文章内容...</p></article>",
                "content_refresh_status": "detail_fetched",
                "content_refresh_error": None,
                "tags": ["AI", "Agent"],
                "read_at": "2026-04-08T12:00:00",
                "processed_at": None,
                "last_opened_at": None,
            },
            {
                "id": 2,
                "source_id": 1,
                "external_id": "mid456",
                "provider_article_id": None,
                "title": "测试文章2",
                "link": "https://example.com/article/2",
                "content": "这是另一篇文章内容...",
                "summary": "这是AI生成的摘要",
                "author": "测试源1",
                "published_at": "2026-04-08 11:00:00",
                "fetched_at": "2026-04-08 11:05:00",
                "content_html": "",
                "content_refresh_status": "ready",
                "content_refresh_error": None,
                "tags": [],
                "read_at": None,
                "processed_at": None,
                "last_opened_at": None,
            }
        ]

    @pytest.fixture
    def mock_sources(self):
        """Mock source data for enrichment"""
        return [
            {"id": 1, "name": "测试源1"}
        ]

    @pytest.fixture
    def client(self):
        """Create test client"""
        from main import app
        return TestClient(app)

    def test_list_articles_empty(self, client):
        """Test listing articles when empty"""
        with patch("routers.articles.get_articles") as mock_get, \
             patch("routers.articles.count_articles") as mock_count:
            mock_get.return_value = []
            mock_count.return_value = 0
            response = client.get("/api/articles")
            assert response.status_code == 200
            data = response.json()
            assert data["items"] == []
            assert data["total"] == 0

    def test_list_articles_with_data(self, client, mock_articles, mock_sources):
        """Test listing articles with data"""
        with patch("routers.articles.get_articles") as mock_get, \
             patch("routers.articles.count_articles") as mock_count, \
             patch("routers.articles.get_all_sources") as mock_sources_get:
            mock_get.return_value = mock_articles
            mock_count.return_value = 2
            mock_sources_get.return_value = mock_sources
            response = client.get("/api/articles")
            assert response.status_code == 200
            data = response.json()
            assert len(data["items"]) == 2
            assert data["items"][0]["source_name"] == "测试源1"
            assert data["items"][0]["provider_article_id"] == "wx-100"
            assert data["items"][0]["content_html"] == "<article><p>这是文章内容...</p></article>"
            assert data["items"][0]["content_refresh_status"] == "detail_fetched"
            assert data["items"][0]["content_refresh_error"] is None
            assert data["items"][0]["tags"] == ["AI", "Agent"]
            assert data["items"][0]["is_read"] is True
            assert data["items"][0]["is_processed"] is False

    def test_list_articles_serializes_datetime_fields(self, client, mock_sources):
        """Test listing articles when database rows contain datetime objects."""
        with patch("routers.articles.get_articles") as mock_get, \
             patch("routers.articles.count_articles") as mock_count, \
             patch("routers.articles.get_all_sources") as mock_sources_get:
            mock_get.return_value = [
                {
                    "id": 3,
                    "source_id": 1,
                    "external_id": "feed-001",
                    "title": "RSS 文章",
                    "link": "https://example.com/rss-article",
                    "content": "正文内容",
                    "summary": "",
                    "author": "Feed Source",
                    "published_at": datetime(2026, 4, 21, 12, 0, 0),
                    "fetched_at": datetime(2026, 4, 21, 12, 5, 0),
                    "content_refresh_status": "refresh_failed",
                    "content_refresh_error": "timeout",
                    "content_refresh_requested_at": datetime(2026, 4, 21, 12, 6, 0),
                    "content_refresh_checked_at": datetime(2026, 4, 21, 12, 7, 0),
                    "content_refreshed_at": None,
                    "read_at": datetime(2026, 4, 21, 12, 8, 0),
                    "processed_at": None,
                    "last_opened_at": datetime(2026, 4, 21, 12, 9, 0),
                    "tags": ["RSS"],
                }
            ]
            mock_count.return_value = 1
            mock_sources_get.return_value = mock_sources
            response = client.get("/api/articles")
            assert response.status_code == 200
            data = response.json()
            assert data["items"][0]["published_at"] == "2026-04-21T12:00:00"
            assert data["items"][0]["fetched_at"] == "2026-04-21T12:05:00"
            assert data["items"][0]["content_refresh_requested_at"] == "2026-04-21T12:06:00"
            assert data["items"][0]["content_refresh_checked_at"] == "2026-04-21T12:07:00"
            assert data["items"][0]["content_refreshed_at"] is None
            assert data["items"][0]["read_at"] == "2026-04-21T12:08:00"
            assert data["items"][0]["processed_at"] is None
            assert data["items"][0]["last_opened_at"] == "2026-04-21T12:09:00"

    def test_list_articles_filter_by_source(self, client, mock_articles, mock_sources):
        """Test filtering articles by source_id"""
        with patch("routers.articles.get_articles") as mock_get, \
             patch("routers.articles.count_articles") as mock_count, \
             patch("routers.articles.get_all_sources") as mock_sources_get:
            mock_get.return_value = [mock_articles[0]]
            mock_count.return_value = 1
            mock_sources_get.return_value = mock_sources
            response = client.get("/api/articles?source_id=1")
            assert response.status_code == 200
            data = response.json()
            assert len(data["items"]) == 1
            assert data["items"][0]["source_id"] == 1

    def test_list_articles_pagination(self, client, mock_articles, mock_sources):
        """Test articles pagination - total count"""
        with patch("routers.articles.get_articles") as mock_get, \
             patch("routers.articles.count_articles") as mock_count, \
             patch("routers.articles.get_all_sources") as mock_sources_get:
            # Return 2 articles but limit=1 means only 1 should be returned
            mock_get.return_value = mock_articles[:1]  # Simulate pagination
            mock_count.return_value = 2
            mock_sources_get.return_value = mock_sources
            response = client.get("/api/articles?limit=1&offset=0")
            assert response.status_code == 200
            data = response.json()
            assert data["total"] == 2
            assert data["limit"] == 1
            assert data["offset"] == 0
            assert len(data["items"]) == 1

    def test_list_articles_search_and_multidimensional_filters(self, client, mock_articles, mock_sources):
        """Test article search combines text, time, source, tag, and status filters."""
        with patch("routers.articles.get_articles") as mock_get, \
             patch("routers.articles.count_articles") as mock_count, \
             patch("routers.articles.get_all_sources") as mock_sources_get:
            mock_get.return_value = [mock_articles[0]]
            mock_count.return_value = 1
            mock_sources_get.return_value = mock_sources

            response = client.get(
                "/api/articles"
                "?q=Agent"
                "&source_id=1"
                "&tag=AI"
                "&status=read"
                "&content_status=detail_fetched"
                "&published_from=2026-04-01"
                "&published_to=2026-04-30"
                "&limit=10"
                "&offset=20"
            )

            assert response.status_code == 200
            data = response.json()
            assert data["total"] == 1
            assert data["items"][0]["tags"] == ["AI", "Agent"]
            mock_get.assert_awaited_once_with(
                source_id=1,
                q="Agent",
                tag="AI",
                status="read",
                content_status="detail_fetched",
                published_from=datetime(2026, 4, 1, 0, 0, 0),
                published_to=datetime(2026, 5, 1, 0, 0, 0),
                limit=10,
                offset=20,
            )
            mock_count.assert_awaited_once_with(
                source_id=1,
                q="Agent",
                tag="AI",
                status="read",
                content_status="detail_fetched",
                published_from=datetime(2026, 4, 1, 0, 0, 0),
                published_to=datetime(2026, 5, 1, 0, 0, 0),
            )

    def test_get_article_by_id(self, client, mock_articles, mock_sources):
        """Test getting single article"""
        with patch("routers.articles.get_article_by_id") as mock_get, \
             patch("routers.articles.get_all_sources") as mock_sources_get:
            mock_get.return_value = mock_articles[0]
            mock_sources_get.return_value = mock_sources
            response = client.get("/api/articles/1")
            assert response.status_code == 200
            data = response.json()
            assert data["title"] == "测试文章1"
            assert data["source_name"] == "测试源1"
            assert data["provider_article_id"] == "wx-100"
            assert data["content_html"] == "<article><p>这是文章内容...</p></article>"
            assert data["tags"] == ["AI", "Agent"]
            assert data["is_read"] is True
            assert data["is_processed"] is False
            assert data["content_refresh_status"] == "detail_fetched"

    def test_get_article_not_found(self, client):
        """Test getting non-existent article"""
        with patch("routers.articles.get_article_by_id") as mock_get:
            mock_get.return_value = None
            response = client.get("/api/articles/999")
            assert response.status_code == 404

    def test_summarize_article(self, client, mock_articles):
        """Test AI summarization of article"""
        with patch("routers.articles.get_article_by_id") as mock_get, \
             patch("routers.articles.update_article_summary") as mock_update, \
             patch("routers.articles.summarize_text") as mock_summarize:
            mock_get.return_value = mock_articles[0]
            mock_update.return_value = None
            mock_summarize.return_value = "这是AI生成的摘要"

            response = client.post("/api/articles/1/summarize")
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert data["summary"] == "这是AI生成的摘要"

    def test_patch_article_state_marks_read_and_processed(self, client):
        """Test updating article reading state from a search/detail result."""
        with patch("routers.articles.update_article_workbench_state_by_article_id") as mock_update:
            mock_update.return_value = {
                "article_id": 1,
                "read_at": datetime(2026, 4, 25, 10, 0, 0),
                "processed_at": datetime(2026, 4, 25, 10, 0, 0),
                "last_opened_at": datetime(2026, 4, 25, 10, 0, 0),
            }

            response = client.patch(
                "/api/articles/1/state",
                json={"mark_read": True, "mark_processed": True},
            )

            assert response.status_code == 200
            data = response.json()
            assert data["article_id"] == 1
            assert data["is_read"] is True
            assert data["is_processed"] is True
            assert data["read_at"] == "2026-04-25T10:00:00"
            assert data["processed_at"] == "2026-04-25T10:00:00"
            mock_update.assert_awaited_once_with(
                article_id=1,
                mark_read=True,
                mark_processed=True,
            )
