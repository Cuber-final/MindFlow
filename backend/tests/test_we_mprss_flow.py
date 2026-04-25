import asyncio
import datetime as dt
import sys
from pathlib import Path
from unittest.mock import AsyncMock, patch
from zoneinfo import ZoneInfo

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from services import crawler


WE_MP_RSS_SOURCE = {
    "id": 2,
    "name": "PaperAgent",
    "source_type": "we_mp_rss",
    "api_base_url": "http://127.0.0.1:8001/feed/MP_WXS_3941633310.rss?limit=5",
    "auth_key": "test-auth-token",
    "config": {
        "feed_url": "http://127.0.0.1:8001/feed/MP_WXS_3941633310.rss?limit=5",
    },
}

WE_MP_RSS_SOURCE_WITH_PASSWORD_AUTH = {
    "id": 2,
    "name": "PaperAgent",
    "source_type": "we_mp_rss",
    "api_base_url": "http://127.0.0.1:8001/feed/MP_WXS_3941633310.rss?limit=5",
    "auth_key": "",
    "config": {
        "feed_url": "http://127.0.0.1:8001/feed/MP_WXS_3941633310.rss?limit=5",
        "we_mprss_auth": {
            "username": "admin",
            "password": "admin@123",
        },
    },
}

class TestWeMpRssFeedNormalization:
    def test_parse_provider_source_id_from_feed_url(self):
        from services.we_mprss import parse_provider_source_id_from_feed_url

        provider_source_id = parse_provider_source_id_from_feed_url(
            "http://127.0.0.1:8001/feed/MP_WXS_3941633310.rss?limit=5&offset=10"
        )

        assert provider_source_id == "MP_WXS_3941633310"

    def test_rewrite_loopback_feed_url_to_host_docker_internal_inside_container(self):
        from services.we_mprss import rewrite_local_service_url_for_runtime

        with patch("services.we_mprss.running_inside_docker", return_value=True):
            rewritten = rewrite_local_service_url_for_runtime(
                "http://127.0.0.1:8001/feed/MP_WXS_3941633310.json?limit=5"
            )

        assert rewritten == "http://host.docker.internal:8001/feed/MP_WXS_3941633310.json?limit=5"

    def test_keep_loopback_feed_url_unchanged_outside_container(self):
        from services.we_mprss import rewrite_local_service_url_for_runtime

        with patch("services.we_mprss.running_inside_docker", return_value=False):
            rewritten = rewrite_local_service_url_for_runtime(
                "http://localhost:8001/feed/MP_WXS_3941633310.json?limit=5"
            )

        assert rewritten == "http://localhost:8001/feed/MP_WXS_3941633310.json?limit=5"


class TestWeMpRssAuthStability:
    @pytest.mark.asyncio
    async def test_ensure_authenticated_source_keeps_existing_valid_token(self):
        from services.we_mprss import ensure_authenticated_source

        source = {
            "id": 2,
            "auth_key": "valid-token",
            "config": {},
        }
        verify = AsyncMock(return_value=True)
        refresh = AsyncMock()
        login = AsyncMock()
        persist = AsyncMock()

        token = await ensure_authenticated_source(
            source,
            verify_token=verify,
            refresh_token=refresh,
            login_token=login,
            persist_token=persist,
        )

        assert token == "valid-token"
        verify.assert_awaited_once()
        refresh.assert_not_called()
        login.assert_not_called()
        persist.assert_not_called()

    @pytest.mark.asyncio
    async def test_ensure_authenticated_source_refreshes_invalid_token_and_persists_it(self):
        from services.we_mprss import ensure_authenticated_source

        source = {
            "id": 2,
            "auth_key": "stale-token",
            "config": {},
        }
        verify = AsyncMock(return_value=False)
        refresh = AsyncMock(return_value="fresh-token")
        login = AsyncMock()
        persist = AsyncMock()

        token = await ensure_authenticated_source(
            source,
            verify_token=verify,
            refresh_token=refresh,
            login_token=login,
            persist_token=persist,
        )

        assert token == "fresh-token"
        refresh.assert_awaited_once_with(source, "stale-token")
        login.assert_not_called()
        persist.assert_awaited_once_with(source, "fresh-token")

    @pytest.mark.asyncio
    async def test_ensure_authenticated_source_logs_in_from_config_credentials_when_no_token(self):
        from services.we_mprss import ensure_authenticated_source

        source = {
            "id": 2,
            "auth_key": "",
            "config": {
                "username": "admin",
                "password": "admin@123",
            },
        }
        verify = AsyncMock()
        refresh = AsyncMock()
        login = AsyncMock(return_value="login-token")
        persist = AsyncMock()

        token = await ensure_authenticated_source(
            source,
            verify_token=verify,
            refresh_token=refresh,
            login_token=login,
            persist_token=persist,
        )

        assert token == "login-token"
        refresh.assert_not_called()
        login.assert_awaited_once_with(source, "admin", "admin@123")
        persist.assert_awaited_once_with(source, "login-token")

    @pytest.mark.asyncio
    async def test_ensure_authenticated_source_falls_back_to_env_credentials(self):
        from services.we_mprss import ensure_authenticated_source

        source = {
            "id": 2,
            "auth_key": "",
            "config": {},
        }
        verify = AsyncMock()
        refresh = AsyncMock()
        login = AsyncMock(return_value="env-login-token")
        persist = AsyncMock()

        with patch.dict("os.environ", {"USERNAME": "admin", "PASSWORD": "admin@123"}, clear=False):
            token = await ensure_authenticated_source(
                source,
                verify_token=verify,
                refresh_token=refresh,
                login_token=login,
                persist_token=persist,
            )

        assert token == "env-login-token"
        login.assert_awaited_once_with(source, "admin", "admin@123")
        persist.assert_awaited_once_with(source, "env-login-token")


class TestWeMpRssDiscoveryState:
    @pytest.mark.asyncio
    async def test_fetch_source_articles_syncs_today_provider_articles_and_triggers_refresh(self):
        prepared_source = {
            **WE_MP_RSS_SOURCE_WITH_PASSWORD_AUTH,
            "provider_source_id": "MP_WXS_3941633310",
            "auth_key": "fresh-token",
            "config": {
                **WE_MP_RSS_SOURCE_WITH_PASSWORD_AUTH["config"],
                "we_mprss_auth": {
                    **WE_MP_RSS_SOURCE_WITH_PASSWORD_AUTH["config"]["we_mprss_auth"],
                    "refresh_token": "refresh-token-2",
                },
            },
        }
        today_articles = [
            {
                "id": "wx-100",
                "title": "今天缺正文的文章",
                "url": "https://mp.weixin.qq.com/s/missing-content",
                "publish_time": int(dt.datetime(2026, 4, 23, 9, 0, tzinfo=ZoneInfo("Asia/Shanghai")).timestamp()),
                "has_content": 0,
                "content": "",
                "content_html": "",
            },
            {
                "id": "wx-101",
                "title": "今天已带正文的文章",
                "url": "https://mp.weixin.qq.com/s/ready-content",
                "publish_time": int(dt.datetime(2026, 4, 23, 10, 0, tzinfo=ZoneInfo("Asia/Shanghai")).timestamp()),
                "has_content": 1,
                "content": "正文文本",
                "content_html": "<article><p>正文文本</p></article>",
            },
        ]

        with patch("services.crawler.get_source_by_id", new=AsyncMock(return_value=WE_MP_RSS_SOURCE_WITH_PASSWORD_AUTH)):
            with patch("services.crawler.ensure_source_auth_state", new=AsyncMock(return_value={"source": prepared_source, "changed": True})):
                with patch("services.crawler.update_source", new=AsyncMock(return_value=True), create=True) as mock_update_source:
                    with patch("services.crawler.trigger_mp_refresh", new=AsyncMock(return_value={"code": 0, "data": {"task": "ok"}}), create=True) as mock_trigger_mp_refresh:
                        with patch("services.crawler.fetch_latest_articles_by_mp_id", new=AsyncMock(return_value=today_articles), create=True) as mock_fetch_latest_articles:
                            with patch("services.crawler.filter_today_articles", return_value=today_articles, create=True):
                                with patch("services.crawler.needs_content_backfill", side_effect=[True, False], create=True):
                                    with patch("services.crawler.get_article_by_provider_article_id", new=AsyncMock(side_effect=[None, None]), create=True):
                                        with patch("services.crawler.trigger_article_refresh", new=AsyncMock(return_value={"task_id": "task-123", "status": "pending"}), create=True) as mock_trigger_article_refresh:
                                            with patch("services.crawler.update_source_fetch_time", new=AsyncMock(return_value=None)):
                                                with patch("services.crawler.add_fetch_log", new=AsyncMock(return_value=None)):
                                                    with patch("services.crawler.fetch_feed_document", new=AsyncMock(side_effect=AssertionError("legacy feed discovery should not run"))):
                                                        with patch("services.crawler.create_article", new=AsyncMock(side_effect=[101, 102])) as mock_create_article:
                                                            count, message = await crawler.fetch_source_articles(WE_MP_RSS_SOURCE_WITH_PASSWORD_AUTH["id"])

        assert count == 2
        assert message == "抓取成功"
        assert mock_create_article.await_count == 2
        mock_update_source.assert_awaited_once_with(
            WE_MP_RSS_SOURCE_WITH_PASSWORD_AUTH["id"],
            auth_key="fresh-token",
            config=prepared_source["config"],
            provider_source_id="MP_WXS_3941633310",
        )
        mock_trigger_mp_refresh.assert_awaited_once_with(prepared_source, "MP_WXS_3941633310")
        mock_fetch_latest_articles.assert_awaited_once_with(prepared_source, "MP_WXS_3941633310", latest_limit=10)
        mock_trigger_article_refresh.assert_awaited_once_with(prepared_source, "wx-100")

        first_create = mock_create_article.await_args_list[0].kwargs
        assert first_create["provider_article_id"] == "wx-100"
        assert first_create["content_refresh_status"] == "refresh_requested"
        assert first_create["content_refresh_task_id"] == "task-123"

        second_create = mock_create_article.await_args_list[1].kwargs
        assert second_create["provider_article_id"] == "wx-101"
        assert second_create["content_refresh_status"] == "detail_fetched"
        assert second_create["content_html"] == "<article><p>正文文本</p></article>"

    def test_filter_today_articles_keeps_only_current_asia_shanghai_day(self):
        from services.we_mprss import filter_today_articles

        now = dt.datetime(2026, 4, 23, 10, 0, tzinfo=ZoneInfo("Asia/Shanghai"))
        articles = [
            {
                "id": "today-1",
                "publish_time": int(dt.datetime(2026, 4, 23, 8, 0, tzinfo=ZoneInfo("Asia/Shanghai")).timestamp()),
            },
            {
                "id": "yesterday-1",
                "publish_time": int(dt.datetime(2026, 4, 22, 23, 59, tzinfo=ZoneInfo("Asia/Shanghai")).timestamp()),
            },
        ]

        result = filter_today_articles(articles, now=now, tz_name="Asia/Shanghai")

        assert [article["id"] for article in result] == ["today-1"]


class TestWeMpRssRefreshLifecycle:
    @pytest.mark.asyncio
    async def test_ensure_source_auth_state_logs_in_when_bearer_token_missing(self):
        from services.we_mprss import ensure_source_auth_state

        verify_token = AsyncMock()
        refresh_token = AsyncMock()
        login_with_password = AsyncMock(
            return_value={
                "access_token": "fresh-token",
                "refresh_token": "refresh-token-2",
            }
        )

        result = await ensure_source_auth_state(
            source=WE_MP_RSS_SOURCE_WITH_PASSWORD_AUTH,
            verify_token=verify_token,
            refresh_token=refresh_token,
            login_with_password=login_with_password,
        )

        assert result["changed"] is True
        assert result["source"]["auth_key"] == "fresh-token"
        assert result["source"]["config"]["we_mprss_auth"]["refresh_token"] == "refresh-token-2"
        verify_token.assert_not_awaited()
        refresh_token.assert_not_awaited()
        login_with_password.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_ensure_source_auth_state_refreshes_after_token_verification_fails(self):
        from services.we_mprss import ensure_source_auth_state

        verify_token = AsyncMock(return_value=False)
        refresh_token = AsyncMock(
            return_value={
                "access_token": "refreshed-token",
                "refresh_token": "refresh-token-3",
            }
        )
        login_with_password = AsyncMock()

        result = await ensure_source_auth_state(
            source=WE_MP_RSS_SOURCE,
            verify_token=verify_token,
            refresh_token=refresh_token,
            login_with_password=login_with_password,
        )

        assert result["changed"] is True
        assert result["source"]["auth_key"] == "refreshed-token"
        assert result["source"]["config"]["we_mprss_auth"]["refresh_token"] == "refresh-token-3"
        verify_token.assert_awaited_once()
        refresh_token.assert_awaited_once()
        login_with_password.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_refresh_lifecycle_backfills_detail_content_after_task_success(self):
        from services.we_mprss import refresh_article_content_and_fetch_detail

        source = {
            "id": 2,
            "source_type": "we_mp_rss",
            "api_base_url": "http://127.0.0.1:8001/feed/MP_WXS_3941633310.rss?limit=5",
            "auth_key": "test-auth-token",
        }
        article = {
            "id": 101,
            "provider_article_id": "wx-100",
            "content_refresh_status": "waiting_for_refresh",
        }

        request_refresh = AsyncMock(return_value={"task_id": "task-123", "status": "pending"})
        poll_status = AsyncMock(side_effect=[{"status": "running"}, {"status": "success"}])
        fetch_detail = AsyncMock(
            return_value={
                "article_id": "3941633310-2247506745_1",
                "article_id": "wx-100",
                "title": "首篇全新情景认知视角的大模型Agent综述",
                "description": "文章摘要",
                "content": "<div>fallback content</div>",
                "content_html": "<article><p>full content</p></article>",
            }
        )
        ensure_source_auth_state = AsyncMock(return_value={"source": source, "changed": False})

        result = await refresh_article_content_and_fetch_detail(
            source=source,
            article=article,
            ensure_source_auth_state=ensure_source_auth_state,
            request_refresh=request_refresh,
            poll_refresh_task=poll_status,
            fetch_article_detail=fetch_detail,
        )

        assert result["content_refresh_status"] == "detail_fetched"
        assert result["content_refresh_task_id"] == "task-123"
        assert result["content_html"] == "<article><p>full content</p></article>"
        assert "full content" in result["content"]

    @pytest.mark.asyncio
    async def test_refresh_lifecycle_includes_updated_source_state_after_auth_bootstrap(self):
        from services.we_mprss import refresh_article_content_and_fetch_detail

        article = {
            "id": 101,
            "provider_article_id": "wx-100",
            "content_refresh_status": "waiting_for_refresh",
        }
        prepared_source = {
            **WE_MP_RSS_SOURCE_WITH_PASSWORD_AUTH,
            "auth_key": "fresh-token",
            "config": {
                **WE_MP_RSS_SOURCE_WITH_PASSWORD_AUTH["config"],
                "we_mprss_auth": {
                    **WE_MP_RSS_SOURCE_WITH_PASSWORD_AUTH["config"]["we_mprss_auth"],
                    "refresh_token": "refresh-token-2",
                },
            },
        }
        ensure_source_auth_state = AsyncMock(
            return_value={
                "source": prepared_source,
                "changed": True,
            }
        )
        request_refresh = AsyncMock(return_value={"task_id": "task-123", "status": "pending"})
        poll_status = AsyncMock(return_value={"status": "success"})
        fetch_detail = AsyncMock(
            return_value={
                "article_id": "wx-100",
                "title": "首篇全新情景认知视角的大模型Agent综述",
                "description": "文章摘要",
                "content": "<div>fallback content</div>",
                "content_html": "<article><p>full content</p></article>",
            }
        )

        result = await refresh_article_content_and_fetch_detail(
            source=WE_MP_RSS_SOURCE_WITH_PASSWORD_AUTH,
            article=article,
            ensure_source_auth_state=ensure_source_auth_state,
            request_refresh=request_refresh,
            poll_refresh_task=poll_status,
            fetch_article_detail=fetch_detail,
        )

        assert result["content_refresh_status"] == "detail_fetched"
        assert result["source_update"] == {
            "auth_key": "fresh-token",
            "config": prepared_source["config"],
        }
        request_refresh.assert_awaited_once_with(prepared_source, article["provider_article_id"])

    @pytest.mark.asyncio
    async def test_refresh_lifecycle_returns_refresh_failed_when_remote_refresh_errors(self):
        from services.we_mprss import refresh_article_content_and_fetch_detail

        source = {
            "id": 2,
            "source_type": "we_mp_rss",
            "api_base_url": "http://127.0.0.1:8001/feed/MP_WXS_3941633310.rss?limit=5",
            "auth_key": "bad-token",
        }
        article = {
            "id": 101,
            "provider_article_id": "wx-100",
            "content_refresh_status": "waiting_for_refresh",
        }

        request_refresh = AsyncMock(side_effect=RuntimeError("401 unauthorized"))
        ensure_source_auth_state = AsyncMock(return_value={"source": source, "changed": False})

        result = await refresh_article_content_and_fetch_detail(
            source=source,
            article=article,
            ensure_source_auth_state=ensure_source_auth_state,
            request_refresh=request_refresh,
        )

        assert result["content_refresh_status"] == "refresh_failed"
        assert "401 unauthorized" in result["content_refresh_error"]

    @pytest.mark.asyncio
    async def test_refresh_lifecycle_falls_back_to_detail_when_task_poll_errors(self):
        from services.we_mprss import refresh_article_content_and_fetch_detail

        source = {
            "id": 2,
            "source_type": "we_mp_rss",
            "api_base_url": "http://127.0.0.1:8001/feed/MP_WXS_3941633310.rss?limit=5",
            "auth_key": "test-auth-token",
        }
        article = {
            "id": 101,
            "provider_article_id": "wx-100",
            "content_refresh_status": "waiting_for_refresh",
        }

        request_refresh = AsyncMock(return_value={"task_id": "task-123", "status": "pending"})
        poll_status = AsyncMock(side_effect=RuntimeError("404 task missing"))
        fetch_detail = AsyncMock(
            return_value={
                "article_id": "wx-100",
                "title": "首篇全新情景认知视角的大模型Agent综述",
                "description": "文章摘要",
                "content": "<div>fallback content</div>",
                "content_html": "<article><p>full content</p></article>",
            }
        )
        ensure_source_auth_state = AsyncMock(return_value={"source": source, "changed": False})

        result = await refresh_article_content_and_fetch_detail(
            source=source,
            article=article,
            ensure_source_auth_state=ensure_source_auth_state,
            request_refresh=request_refresh,
            poll_refresh_task=poll_status,
            fetch_article_detail=fetch_detail,
        )

        assert result["content_refresh_status"] == "detail_fetched"
        assert result["content_html"] == "<article><p>full content</p></article>"

    @pytest.mark.asyncio
    async def test_refresh_lifecycle_falls_back_to_detail_when_task_reports_failed(self):
        from services.we_mprss import refresh_article_content_and_fetch_detail

        source = {
            "id": 2,
            "source_type": "we_mp_rss",
            "api_base_url": "http://127.0.0.1:8001/feed/MP_WXS_3941633310.rss?limit=5",
            "auth_key": "test-auth-token",
        }
        article = {
            "id": 101,
            "provider_article_id": "wx-100",
            "content_refresh_status": "waiting_for_refresh",
        }

        request_refresh = AsyncMock(return_value={"task_id": "task-123", "status": "pending"})
        poll_status = AsyncMock(return_value={"status": "failed", "error": "browser launch failed"})
        fetch_detail = AsyncMock(
            return_value={
                "article_id": "wx-100",
                "title": "首篇全新情景认知视角的大模型Agent综述",
                "description": "文章摘要",
                "content": "<div>fallback content</div>",
                "content_html": "<article><p>full content</p></article>",
            }
        )
        ensure_source_auth_state = AsyncMock(return_value={"source": source, "changed": False})

        result = await refresh_article_content_and_fetch_detail(
            source=source,
            article=article,
            ensure_source_auth_state=ensure_source_auth_state,
            request_refresh=request_refresh,
            poll_refresh_task=poll_status,
            fetch_article_detail=fetch_detail,
        )

        assert result["content_refresh_status"] == "detail_fetched"
        assert result["content_html"] == "<article><p>full content</p></article>"


class TestSchedulerRefreshLoop:
    @pytest.mark.asyncio
    async def test_process_pending_we_mp_rss_articles_requests_refresh_and_persists_backfill(self):
        from services.scheduler import process_pending_we_mp_rss_articles

        due_articles = [
            {
                "article_id": 101,
                "source_id": 2,
                "provider_article_id": "wx-100",
                "api_base_url": "http://127.0.0.1:8001/feed/MP_WXS_3941633310.rss?limit=5",
                "auth_key": "test-auth-token",
                "source_type": "we_mp_rss",
                "content_refresh_status": "waiting_for_refresh",
            }
        ]
        refresh_result = {
            "content_refresh_status": "detail_fetched",
            "content_refresh_task_id": "task-123",
            "content_html": "<article><p>full content</p></article>",
            "content": "full content",
            "content_refresh_error": None,
        }

        with patch("services.scheduler.get_articles_due_for_content_refresh", new=AsyncMock(return_value=due_articles)):
            with patch("services.scheduler.refresh_article_content_and_fetch_detail", new=AsyncMock(return_value=refresh_result)):
                with patch("services.scheduler.update_source_auth_state", new=AsyncMock(return_value=True)) as mock_update_source:
                    with patch("services.scheduler.update_article_content_refresh", new=AsyncMock(return_value=True)) as mock_update:
                        processed = await process_pending_we_mp_rss_articles()

        assert processed == 1
        mock_update_source.assert_not_awaited()
        mock_update.assert_awaited_once_with(101, **refresh_result)

    @pytest.mark.asyncio
    async def test_process_pending_we_mp_rss_articles_persists_updated_source_auth_state(self):
        from services.scheduler import process_pending_we_mp_rss_articles

        due_articles = [
            {
                "article_id": 101,
                "source_id": 2,
                "provider_article_id": "wx-100",
                "api_base_url": "http://127.0.0.1:8001/feed/MP_WXS_3941633310.rss?limit=5",
                "auth_key": "",
                "source_type": "we_mp_rss",
                "source_config": WE_MP_RSS_SOURCE_WITH_PASSWORD_AUTH["config"],
                "content_refresh_status": "waiting_for_refresh",
            }
        ]
        refresh_result = {
            "content_refresh_status": "detail_fetched",
            "content_refresh_task_id": "task-123",
            "content_html": "<article><p>full content</p></article>",
            "content": "full content",
            "content_refresh_error": None,
            "source_update": {
                "auth_key": "fresh-token",
                "config": {
                    **WE_MP_RSS_SOURCE_WITH_PASSWORD_AUTH["config"],
                    "we_mprss_auth": {
                        **WE_MP_RSS_SOURCE_WITH_PASSWORD_AUTH["config"]["we_mprss_auth"],
                        "refresh_token": "refresh-token-2",
                    },
                },
            },
        }

        with patch("services.scheduler.get_articles_due_for_content_refresh", new=AsyncMock(return_value=due_articles)):
            with patch("services.scheduler.refresh_article_content_and_fetch_detail", new=AsyncMock(return_value=refresh_result)):
                with patch("services.scheduler.update_source_auth_state", new=AsyncMock(return_value=True)) as mock_update_source:
                    with patch("services.scheduler.update_article_content_refresh", new=AsyncMock(return_value=True)) as mock_update:
                        processed = await process_pending_we_mp_rss_articles()

        assert processed == 1
        mock_update_source.assert_awaited_once_with(
            2,
            auth_key="fresh-token",
            config=refresh_result["source_update"]["config"],
        )
        mock_update.assert_awaited_once_with(
            101,
            content_refresh_status="detail_fetched",
            content_refresh_task_id="task-123",
            content_html="<article><p>full content</p></article>",
            content="full content",
            content_refresh_error=None,
        )

    @pytest.mark.asyncio
    async def test_fetch_source_articles_uses_bootstrapped_auth_and_persists_source_state(self):
        prepared_source = {
            **WE_MP_RSS_SOURCE_WITH_PASSWORD_AUTH,
            "provider_source_id": "MP_WXS_3941633310",
            "auth_key": "fresh-token",
            "config": {
                **WE_MP_RSS_SOURCE_WITH_PASSWORD_AUTH["config"],
                "we_mprss_auth": {
                    **WE_MP_RSS_SOURCE_WITH_PASSWORD_AUTH["config"]["we_mprss_auth"],
                    "refresh_token": "refresh-token-2",
                },
            },
        }
        today_articles = [
            {
                "id": "wx-100",
                "title": "今天缺正文的文章",
                "url": "https://mp.weixin.qq.com/s/missing-content",
                "publish_time": int(dt.datetime(2026, 4, 23, 9, 0, tzinfo=ZoneInfo("Asia/Shanghai")).timestamp()),
                "has_content": 0,
                "content": "",
                "content_html": "",
            }
        ]

        with patch("services.crawler.get_source_by_id", new=AsyncMock(return_value=WE_MP_RSS_SOURCE_WITH_PASSWORD_AUTH)):
            with patch("services.crawler.ensure_source_auth_state", new=AsyncMock(return_value={"source": prepared_source, "changed": True})):
                with patch("services.crawler.update_source", new=AsyncMock(return_value=True), create=True) as mock_update_source:
                    with patch("services.crawler.trigger_mp_refresh", new=AsyncMock(return_value={"code": 0, "data": {"task": "ok"}}), create=True):
                        with patch("services.crawler.fetch_latest_articles_by_mp_id", new=AsyncMock(return_value=today_articles), create=True):
                            with patch("services.crawler.filter_today_articles", return_value=today_articles, create=True):
                                with patch("services.crawler.needs_content_backfill", return_value=True, create=True):
                                    with patch("services.crawler.get_article_by_provider_article_id", new=AsyncMock(return_value=None), create=True):
                                        with patch("services.crawler.trigger_article_refresh", new=AsyncMock(return_value={"task_id": "task-123", "status": "pending"}), create=True):
                                            with patch("services.crawler.update_source_fetch_time", new=AsyncMock(return_value=None)):
                                                with patch("services.crawler.add_fetch_log", new=AsyncMock(return_value=None)):
                                                    with patch("services.crawler.fetch_feed_document", new=AsyncMock(side_effect=AssertionError("legacy feed discovery should not run"))):
                                                        with patch("services.crawler.create_article", new=AsyncMock(return_value=101)):
                                                            count, message = await crawler.fetch_source_articles(WE_MP_RSS_SOURCE_WITH_PASSWORD_AUTH["id"])

        assert count == 1
        assert message == "抓取成功"
        mock_update_source.assert_awaited_once_with(
            WE_MP_RSS_SOURCE_WITH_PASSWORD_AUTH["id"],
            auth_key="fresh-token",
            config=prepared_source["config"],
            provider_source_id="MP_WXS_3941633310",
        )

    @pytest.mark.asyncio
    async def test_extract_anchors_only_uses_content_ready_articles(self):
        from services.scheduler import extract_anchors_from_recent_articles

        ready_articles = [
            {
                "article_id": 201,
                "title": "Ready article",
                "content": "full content",
                "summary": "",
                "link": "https://example.com/article",
                "source_name": "PaperAgent",
            }
        ]
        anchor_payload = {
            "title": "Ready anchor",
            "content": "Anchor content",
            "dialectical_analysis": "【支持】x【质疑】y【延伸】z",
            "anchor_type": "opinion",
            "significance": 0.8,
            "source_article_title": "Ready article",
            "source_article_link": "https://example.com/article",
            "source_name": "PaperAgent",
            "tags": ["agent"],
            "related_tag_weights": {"agent": 0.8},
        }

        with patch("services.scheduler.get_articles_ready_for_anchor_extraction", new=AsyncMock(return_value=ready_articles)):
            with patch("services.scheduler.get_anchors_by_article", new=AsyncMock(return_value=[])):
                with patch("services.scheduler.extract_anchor", new=AsyncMock(return_value=anchor_payload)):
                    with patch("services.scheduler.create_anchor", new=AsyncMock(return_value=1)) as mock_create_anchor:
                        extracted = await extract_anchors_from_recent_articles()

        assert extracted == 1
        mock_create_anchor.assert_awaited_once()
