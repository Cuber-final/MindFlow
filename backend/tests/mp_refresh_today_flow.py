#!/usr/bin/env python3
"""Refresh a WeRSS mp latest page, collect latest articles, backfill today's missing content.

Workflow:
1. Authenticate with Bearer token (either provided directly or obtained via /auth/login)
2. Trigger mp latest-page refresh using default page range semantics
3. Optionally wait a short settle period for async refresh to enqueue/persist results
4. Fetch latest N articles for the mp and filter those published today
5. Trigger per-article content refresh for today's articles missing content
6. Wait the requested duration (default 5 minutes)
7. Re-check those article details and summarize which ones were backfilled successfully
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
import time
from typing import Any, Callable
from urllib import parse, request
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse

from zoneinfo import ZoneInfo


DEFAULT_TIMEOUT = 20
DEFAULT_TIMEZONE = "Asia/Shanghai"
DEFAULT_REFRESH_SETTLE_SECONDS = 5
DEFAULT_WAIT_SECONDS = 300


class UrlLibResponse:
    def __init__(self, status_code: int, payload: Any):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"http {self.status_code}")


class UrlLibSession:
    def get(self, url, headers=None, params=None, timeout=None):
        if params:
            query = parse.urlencode(params)
            separator = "&" if "?" in url else "?"
            url = f"{url}{separator}{query}"
        return self._request("GET", url, headers=headers, timeout=timeout)

    def post(self, url, headers=None, data=None, timeout=None):
        body = None
        headers = dict(headers or {})
        if data is not None:
            if headers.get("Content-Type") == "application/x-www-form-urlencoded":
                body = parse.urlencode(data).encode("utf-8")
            else:
                body = json.dumps(data).encode("utf-8")
                headers.setdefault("Content-Type", "application/json")
        return self._request("POST", url, headers=headers, body=body, timeout=timeout)

    def close(self):
        return None

    def _request(self, method: str, url: str, headers=None, body=None, timeout=None):
        req = request.Request(url=url, data=body, headers=headers or {}, method=method)
        try:
            with request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read().decode("utf-8")
                payload = json.loads(raw) if raw else None
                return UrlLibResponse(resp.status, payload)
        except HTTPError as exc:
            raw = exc.read().decode("utf-8", errors="replace")
            try:
                payload = json.loads(raw) if raw else {"error": raw}
            except Exception:
                payload = {"error": raw}
            return UrlLibResponse(exc.code, payload)
        except URLError as exc:
            raise RuntimeError(f"request failed: {exc}") from exc


def strip_trailing_slash(url: str) -> str:
    return (url or "").rstrip("/")


def parse_mp_id_from_rss_url(rss_url: str) -> str:
    path = urlparse(rss_url).path.strip()
    if not path:
        raise ValueError("rss_url 缺少路径")

    parts = [part for part in path.split("/") if part]
    if len(parts) < 2 or parts[0] != "feed":
        raise ValueError("rss_url 不是受支持的 /feed/{feed_id}.ext 格式")

    last = parts[-1]
    if "." not in last:
        raise ValueError("rss_url 缺少扩展名，无法解析 feed_id")

    feed_id = last.rsplit(".", 1)[0]
    if not feed_id:
        raise ValueError("rss_url 中未解析到 mp_id/feed_id")
    return feed_id


def resolve_token(
    *,
    base_url: str,
    username: str | None,
    password: str | None,
    token: str | None,
    session: Any,
    timeout: int = DEFAULT_TIMEOUT,
) -> str:
    if token:
        return token

    if not username or not password:
        raise ValueError("未提供 token 时，必须提供 username 和 password")

    resp = session.post(
        f"{strip_trailing_slash(base_url)}/api/v1/wx/auth/login",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        data={"username": username, "password": password},
        timeout=timeout,
    )
    resp.raise_for_status()
    payload = resp.json()
    token_value = (((payload or {}).get("data") or {}).get("access_token") or "").strip()
    if not token_value:
        raise RuntimeError(f"登录成功但未拿到 access_token: {payload}")
    return token_value


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _extract_payload_data(payload: dict[str, Any]) -> Any:
    if not isinstance(payload, dict):
        raise RuntimeError(f"接口返回不是 JSON 对象: {payload!r}")
    if payload.get("code") not in (None, 0):
        raise RuntimeError(f"接口返回业务错误: {payload}")
    return payload.get("data")


def trigger_mp_refresh(
    *,
    base_url: str,
    mp_id: str,
    token: str,
    start_page: int,
    end_page: int,
    session: Any,
    timeout: int = DEFAULT_TIMEOUT,
) -> dict[str, Any]:
    resp = session.get(
        f"{strip_trailing_slash(base_url)}/api/v1/wx/mps/update/{mp_id}",
        headers=auth_headers(token),
        params={"start_page": start_page, "end_page": end_page},
        timeout=timeout,
    )
    resp.raise_for_status()
    payload = resp.json()
    # 某些情况下业务层会返回 code!=0 表示频率限制；让调用方可见，但不强制中断
    return payload


def fetch_latest_articles(
    *,
    base_url: str,
    mp_id: str,
    token: str,
    latest_limit: int,
    session: Any,
    timeout: int = DEFAULT_TIMEOUT,
) -> list[dict[str, Any]]:
    resp = session.get(
        f"{strip_trailing_slash(base_url)}/api/v1/wx/articles?mp_id={mp_id}&limit={latest_limit}&offset=0",
        headers=auth_headers(token),
        timeout=timeout,
    )
    resp.raise_for_status()
    payload = resp.json()
    data = _extract_payload_data(payload) or {}
    articles = data.get("list") or []
    if not isinstance(articles, list):
        raise RuntimeError(f"文章列表接口返回异常: {payload}")
    return articles[:latest_limit]


def filter_today_articles(
    articles: list[dict[str, Any]],
    *,
    now: dt.datetime | None = None,
    tz_name: str = DEFAULT_TIMEZONE,
) -> list[dict[str, Any]]:
    zone = ZoneInfo(tz_name)
    current = now.astimezone(zone) if now else dt.datetime.now(zone)
    day_start = current.replace(hour=0, minute=0, second=0, microsecond=0)
    next_day_start = day_start + dt.timedelta(days=1)
    day_start_ts = int(day_start.timestamp())
    next_day_start_ts = int(next_day_start.timestamp())

    result: list[dict[str, Any]] = []
    for article in articles:
        try:
            publish_time = int(article.get("publish_time") or 0)
        except (TypeError, ValueError):
            continue
        if day_start_ts <= publish_time < next_day_start_ts:
            result.append(article)
    return result


def needs_content_backfill(article: dict[str, Any]) -> bool:
    has_content = article.get("has_content")
    if has_content in (1, True, "1", "true", "True"):
        return False
    content = (article.get("content") or "")
    content_html = (article.get("content_html") or "")
    return not (str(content).strip() or str(content_html).strip())


def trigger_article_refresh(
    *,
    base_url: str,
    article_id: str,
    token: str,
    session: Any,
    timeout: int = DEFAULT_TIMEOUT,
) -> dict[str, Any]:
    resp = session.post(
        f"{strip_trailing_slash(base_url)}/api/v1/wx/articles/{article_id}/refresh",
        headers=auth_headers(token),
        timeout=timeout,
    )
    resp.raise_for_status()
    payload = resp.json()
    return _extract_payload_data(payload) or {}


def fetch_article_detail(
    *,
    base_url: str,
    article_id: str,
    token: str,
    session: Any,
    timeout: int = DEFAULT_TIMEOUT,
) -> dict[str, Any]:
    resp = session.get(
        f"{strip_trailing_slash(base_url)}/api/v1/wx/articles/{article_id}",
        headers=auth_headers(token),
        timeout=timeout,
    )
    resp.raise_for_status()
    payload = resp.json()
    return _extract_payload_data(payload) or {}


def is_backfill_success(article_detail: dict[str, Any]) -> bool:
    has_content = article_detail.get("has_content")
    if has_content in (1, True, "1", "true", "True"):
        return True
    return bool((article_detail.get("content") or "").strip() or (article_detail.get("content_html") or "").strip())


def compact_article_detail(article_detail: dict[str, Any]) -> dict[str, Any]:
    content = article_detail.get("content") or ""
    content_html = article_detail.get("content_html") or ""
    return {
        "id": article_detail.get("id"),
        "title": article_detail.get("title"),
        "mp_id": article_detail.get("mp_id"),
        "url": article_detail.get("url"),
        "has_content": int(article_detail.get("has_content") or 0),
        "content_length": len(str(content)),
        "content_html_length": len(str(content_html)),
    }


def run_flow(
    *,
    base_url: str,
    mp_id: str,
    token: str | None = None,
    username: str | None = None,
    password: str | None = None,
    start_page: int = 0,
    end_page: int = 1,
    latest_limit: int = 10,
    refresh_settle_seconds: int = DEFAULT_REFRESH_SETTLE_SECONDS,
    wait_seconds: int = DEFAULT_WAIT_SECONDS,
    tz_name: str = DEFAULT_TIMEZONE,
    timeout: int = DEFAULT_TIMEOUT,
    session: Any | None = None,
    now: dt.datetime | None = None,
    sleep_fn: Callable[[float], None] = time.sleep,
) -> dict[str, Any]:
    if latest_limit <= 0:
        raise ValueError("latest_limit 必须大于 0")

    owned_session = session is None
    session = session or UrlLibSession()
    try:
        bearer_token = resolve_token(
            base_url=base_url,
            username=username,
            password=password,
            token=token,
            session=session,
            timeout=timeout,
        )

        mp_refresh_response = trigger_mp_refresh(
            base_url=base_url,
            mp_id=mp_id,
            token=bearer_token,
            start_page=start_page,
            end_page=end_page,
            session=session,
            timeout=timeout,
        )

        if refresh_settle_seconds > 0:
            sleep_fn(refresh_settle_seconds)

        latest_articles = fetch_latest_articles(
            base_url=base_url,
            mp_id=mp_id,
            token=bearer_token,
            latest_limit=latest_limit,
            session=session,
            timeout=timeout,
        )
        today_articles = filter_today_articles(latest_articles, now=now, tz_name=tz_name)

        refresh_requested_articles: list[dict[str, Any]] = []
        refresh_task_records: list[dict[str, Any]] = []
        for article in today_articles:
            if not needs_content_backfill(article):
                continue
            refresh_requested_articles.append(article)
            refresh_task_records.append(
                trigger_article_refresh(
                    base_url=base_url,
                    article_id=str(article["id"]),
                    token=bearer_token,
                    session=session,
                    timeout=timeout,
                )
            )

        if refresh_requested_articles and wait_seconds > 0:
            sleep_fn(wait_seconds)

        final_article_checks: list[dict[str, Any]] = []
        refresh_success_article_ids: list[str] = []
        refresh_failed_article_ids: list[str] = []
        for article in refresh_requested_articles:
            detail = fetch_article_detail(
                base_url=base_url,
                article_id=str(article["id"]),
                token=bearer_token,
                session=session,
                timeout=timeout,
            )
            final_article_checks.append(compact_article_detail(detail))
            if is_backfill_success(detail):
                refresh_success_article_ids.append(str(article["id"]))
            else:
                refresh_failed_article_ids.append(str(article["id"]))

        return {
            "base_url": strip_trailing_slash(base_url),
            "mp_id": mp_id,
            "auth_type": "bearer",
            "used_provided_token": bool(token),
            "latest_articles_count": len(latest_articles),
            "today_articles_count": len(today_articles),
            "refresh_requested_count": len(refresh_requested_articles),
            "refresh_success_count": len(refresh_success_article_ids),
            "refresh_failed_count": len(refresh_failed_article_ids),
            "mp_refresh_response": mp_refresh_response,
            "latest_articles": latest_articles,
            "today_articles": today_articles,
            "refresh_requested_articles": refresh_requested_articles,
            "refresh_tasks": refresh_task_records,
            "final_article_checks": final_article_checks,
            "refresh_success_article_ids": refresh_success_article_ids,
            "refresh_failed_article_ids": refresh_failed_article_ids,
        }
    finally:
        if owned_session:
            session.close()


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Refresh latest mp page, filter today's articles, and backfill missing content.")
    parser.add_argument("--base-url", default="http://localhost:8001", help="WeRSS base URL, default: http://localhost:8001")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--mp-id", help="Target mp_id, e.g. MP_WXS_3201788143")
    group.add_argument("--rss-url", help="RSS URL like http://localhost:8001/feed/MP_WXS_3201788143.rss")
    parser.add_argument("--token", help="Existing Bearer access token")
    parser.add_argument("--username", help="Username for /auth/login when token is not provided")
    parser.add_argument("--password", help="Password for /auth/login when token is not provided")
    parser.add_argument("--start-page", type=int, default=0, help="Refresh start page, default 0")
    parser.add_argument("--end-page", type=int, default=1, help="Refresh end page (exclusive upper bound style used by current API semantics), default 1")
    parser.add_argument("--latest-limit", type=int, default=10, help="How many latest articles to inspect, default 10")
    parser.add_argument("--refresh-settle-seconds", type=int, default=DEFAULT_REFRESH_SETTLE_SECONDS, help="Wait after mp refresh before fetching article list, default 5")
    parser.add_argument("--wait-seconds", type=int, default=DEFAULT_WAIT_SECONDS, help="Wait after triggering article refresh tasks before unified re-check, default 300")
    parser.add_argument("--tz", default=DEFAULT_TIMEZONE, help="Timezone used to determine 'today', default Asia/Shanghai")
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT, help="HTTP timeout seconds, default 20")
    parser.add_argument("--output", help="Optional path to save JSON summary")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_arg_parser()
    args = parser.parse_args(argv)

    try:
        mp_id = args.mp_id or parse_mp_id_from_rss_url(args.rss_url)
        summary = run_flow(
            base_url=args.base_url,
            mp_id=mp_id,
            token=args.token,
            username=args.username,
            password=args.password,
            start_page=args.start_page,
            end_page=args.end_page,
            latest_limit=args.latest_limit,
            refresh_settle_seconds=args.refresh_settle_seconds,
            wait_seconds=args.wait_seconds,
            tz_name=args.tz,
            timeout=args.timeout,
        )
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False, indent=2), file=sys.stderr)
        return 1

    text = json.dumps(summary, ensure_ascii=False, indent=2)
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(text)
    print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
