"""
End-to-end test script for core flow with mocked AI
Tests: Source ingestion -> Article fetching -> Digest synthesis
"""
import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))


RSS_XML = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>WeRSS Feed</title>
    <link>https://rss.example.com/feed/123.xml</link>
    <description>Feed for testing</description>
    <item>
      <guid>article-1</guid>
      <title>测试文章：RAG技术详解</title>
      <link>https://example.com/articles/1</link>
      <description><![CDATA[这是一篇关于 RAG 的测试文章。]]></description>
      <pubDate>Tue, 21 Apr 2026 10:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>
"""


class MockFeedResponse:
    status_code = 200
    text = RSS_XML
    headers = {"content-type": "application/rss+xml; charset=utf-8"}

    def raise_for_status(self):
        return None


class MockAsyncClient:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def get(self, url, headers=None, follow_redirects=True):
        return MockFeedResponse()


class TestLegacySourceRemoval:
    """Test legacy MPText-specific source entrypoints are removed."""

    @pytest.fixture
    def client(self):
        from main import app
        return TestClient(app)

    def test_parse_wechat_url_endpoint_removed(self, client):
        """Test the legacy WeChat URL parsing endpoint is no longer exposed."""
        response = client.post(
            "/api/sources/parse-url",
            json={"url": "https://mp.weixin.qq.com/s/test123"}
        )
        assert response.status_code in [404, 405]


class TestArticleFetching:
    """Test article fetching with a generic feed-based crawler."""

    @pytest.fixture
    def client(self):
        from main import app
        return TestClient(app)

    @pytest.fixture
    def mock_source(self):
        return {
            "id": 1,
            "name": "测试 RSS 源",
            "source_type": "native_rss",
            "api_base_url": "https://rss.example.com/feed/123.xml",
            "auth_key": "",
            "config": {"feed_url": "https://rss.example.com/feed/123.xml"},
            "created_at": "2026-04-09 10:00:00",
            "updated_at": "2026-04-09 10:00:00",
            "last_fetch_at": None,
            "article_count": 0
        }

    def test_fetch_source_articles_mock(self, client, mock_source):
        """Test fetching articles with mocked RSS XML feed"""
        with patch("routers.sources.get_source_by_id", return_value=mock_source):
            with patch("services.crawler.get_source_by_id", new=AsyncMock(return_value=mock_source)):
                with patch("services.crawler.get_article_by_external_id", new=AsyncMock(return_value=None)):
                    with patch("services.crawler.create_article", new=AsyncMock(return_value=1)):
                        with patch("services.crawler.update_source_fetch_time", new=AsyncMock(return_value=None)):
                            with patch("services.crawler.add_fetch_log", new=AsyncMock(return_value=None)):
                                with patch("services.crawler.httpx.AsyncClient", return_value=MockAsyncClient()):
                                    response = client.post("/api/sources/1/fetch")
                                    assert response.status_code == 200
                                    data = response.json()
                                    assert data["success"] is True
                                    assert data["articles_added"] == 1


class TestDigestFlowWithMocks:
    """Test the full digest generation flow with mocked AI"""

    @pytest.fixture
    def mock_ai_config(self):
        return {
            "id": 1,
            "provider": "siliconflow",
            "api_key": "sk-test-mock-key",
            "base_url": "https://api.siliconflow.cn/v1",
            "model": "Qwen/Qwen2.5-7B-Instruct",
            "updated_at": "2026-04-08 10:00:00"
        }

    def test_summarize_text_mock(self, mock_ai_config):
        """Test AI summarization with mock"""
        with patch("services.ai.get_ai_config", return_value=mock_ai_config):
            with patch("services.ai.AsyncOpenAI") as mock_client:
                mock_instance = AsyncMock()
                mock_response = AsyncMock()
                mock_response.choices = [
                    AsyncMock(message=AsyncMock(content="这是AI生成的摘要内容"))
                ]
                mock_instance.chat.completions.create = AsyncMock(return_value=mock_response)
                mock_client.return_value = mock_instance

                from services.ai import summarize_text
                import asyncio

                result = asyncio.run(summarize_text(
                    "RAG技术详解",
                    "RAG是一种检索增强生成技术..."
                ))
                assert result == "这是AI生成的摘要内容"

    def test_summarize_text_without_config(self):
        """Test summarization fails gracefully without AI config"""
        with patch("services.ai.get_ai_config", return_value=None):
            from services.ai import summarize_text
            import asyncio

            result = asyncio.run(summarize_text("测试", "内容"))
            assert "AI 配置未完成" in result


class TestInterestLearning:
    """Test interest learning and behavior tracking"""

    @pytest.fixture
    def client(self):
        from main import app
        return TestClient(app)

    def test_get_interest_tags(self, client):
        """Test getting interest tags"""
        with patch("routers.interests.get_all_interest_tags", new=AsyncMock(return_value=[])):
            response = client.get("/api/interests/tags")
            assert response.status_code == 200

    def test_record_feedback(self, client):
        """Test recording feedback"""
        with patch("routers.behavior.get_anchor_by_id", new=AsyncMock(return_value={"id": 1})):
            with patch("routers.behavior.create_digest_feedback", new=AsyncMock(return_value=1)):
                response = client.post(
                    "/api/behavior/feedback",
                    json={
                        "digest_id": 1,
                        "anchor_id": 1,
                        "action": "click"
                    }
                )
                assert response.status_code in [200, 201]


class TestAPIErrors:
    """Test API error handling"""

    @pytest.fixture
    def client(self):
        from main import app
        return TestClient(app)

    def test_source_not_found(self, client):
        """Test 404 for non-existent source"""
        with patch("routers.sources.get_source_by_id", new=AsyncMock(return_value=None)):
            response = client.get("/api/sources/99999")
            assert response.status_code == 404

    def test_article_not_found(self, client):
        """Test 404 for non-existent article"""
        with patch("routers.articles.get_article_by_id", new=AsyncMock(return_value=None)):
            response = client.get("/api/articles/99999")
            assert response.status_code == 404

    def test_invalid_source_type(self, client):
        """Test creating source with invalid type"""
        response = client.post(
            "/api/sources",
            json={
                "name": "测试",
                "source_type": "invalid_type",
                "api_base_url": "https://test.com/feed.xml",
                "auth_key": "",
                "config": {}
            }
        )
        assert response.status_code == 422


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
