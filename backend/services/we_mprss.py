import asyncio
import datetime as dt
import html
import json
import os
import re
from datetime import datetime
from typing import Any, Awaitable, Callable, Dict, Optional
from pathlib import Path
from urllib.parse import ParseResult, parse_qsl, urlencode, urlparse, urlunparse
from zoneinfo import ZoneInfo

import httpx


WE_MPRSS_SOURCE_TYPE = "we_mp_rss"
WE_MPRSS_FEED_PATH_RE = re.compile(r"^/feed/(?P<feed_id>[^/]+?)\.(?P<ext>rss|xml|atom|json)$", re.IGNORECASE)
WE_MPRSS_AUTH_CONFIG_KEY = "we_mprss_auth"
DEFAULT_REFRESH_TIMEOUT_SECONDS = 30
DOCKER_LOOPBACK_ALIAS = "host.docker.internal"
DEFAULT_PROVIDER_LATEST_LIMIT = 10
DEFAULT_PROVIDER_TIMEZONE = "Asia/Shanghai"


def is_we_mprss_feed_url(raw_url: str) -> bool:
    parsed = urlparse(raw_url)
    return bool(WE_MPRSS_FEED_PATH_RE.match(parsed.path))


def normalize_feed_url_for_discovery(raw_url: str) -> str:
    parsed = urlparse(raw_url)
    match = WE_MPRSS_FEED_PATH_RE.match(parsed.path)
    if not match:
        return raw_url

    feed_id = match.group("feed_id")
    normalized_path = f"/feed/{feed_id}.json"
    normalized_query = urlencode(parse_qsl(parsed.query, keep_blank_values=True))
    normalized = ParseResult(
        scheme=parsed.scheme,
        netloc=parsed.netloc,
        path=normalized_path,
        params=parsed.params,
        query=normalized_query,
        fragment=parsed.fragment,
    )
    return urlunparse(normalized)


def parse_provider_source_id_from_feed_url(raw_url: str) -> str:
    parsed = urlparse(raw_url)
    match = WE_MPRSS_FEED_PATH_RE.match(parsed.path)
    if not match:
        raise ValueError("rss_url 不是受支持的 /feed/{feed_id}.ext 格式")
    feed_id = (match.group("feed_id") or "").strip()
    if not feed_id:
        raise ValueError("rss_url 中未解析到 provider_source_id")
    return feed_id


def running_inside_docker() -> bool:
    return Path("/.dockerenv").exists()


def rewrite_local_service_url_for_runtime(raw_url: str) -> str:
    parsed = urlparse(raw_url)
    host = (parsed.hostname or "").strip().lower()
    if not running_inside_docker():
        return raw_url
    if host not in {"127.0.0.1", "localhost"}:
        return raw_url

    port = f":{parsed.port}" if parsed.port else ""
    rewritten = ParseResult(
        scheme=parsed.scheme,
        netloc=f"{DOCKER_LOOPBACK_ALIAS}{port}",
        path=parsed.path,
        params=parsed.params,
        query=parsed.query,
        fragment=parsed.fragment,
    )
    return urlunparse(rewritten)


def get_service_base_url(feed_url: str) -> str:
    parsed = urlparse(rewrite_local_service_url_for_runtime(feed_url))
    return f"{parsed.scheme}://{parsed.netloc}"


def build_auth_headers(auth_key: str) -> Dict[str, str]:
    key = (auth_key or "").strip()
    if not key:
        return {}
    return {
        "Authorization": f"Bearer {key}",
        "X-Auth-Key": key,
    }


def _coerce_source_config(raw_config: Any) -> Dict[str, Any]:
    if isinstance(raw_config, str):
        try:
            parsed = json.loads(raw_config)
        except json.JSONDecodeError:
            return {}
        return parsed if isinstance(parsed, dict) else {}
    return dict(raw_config) if isinstance(raw_config, dict) else {}


def _clone_source(source: Dict[str, Any]) -> Dict[str, Any]:
    cloned = dict(source or {})
    config = _coerce_source_config(cloned.get("config"))
    auth_config = config.get(WE_MPRSS_AUTH_CONFIG_KEY)
    if isinstance(auth_config, dict):
        config[WE_MPRSS_AUTH_CONFIG_KEY] = dict(auth_config)
    else:
        config[WE_MPRSS_AUTH_CONFIG_KEY] = {}
    cloned["config"] = config
    return cloned


def _clean_auth_value(value: Any) -> str:
    return str(value or "").strip()


def _get_nested_auth_config(config: Dict[str, Any]) -> Dict[str, Any]:
    auth_config = config.get(WE_MPRSS_AUTH_CONFIG_KEY)
    return auth_config if isinstance(auth_config, dict) else {}


def _get_source_credentials(source: Dict[str, Any]) -> Dict[str, str]:
    config = _coerce_source_config(source.get("config"))
    auth_config = _get_nested_auth_config(config)
    username = _clean_auth_value(auth_config.get("username") or config.get("username"))
    password = _clean_auth_value(auth_config.get("password") or config.get("password"))
    if not username:
        username = _clean_auth_value(os.getenv("USERNAME"))
    if not password:
        password = _clean_auth_value(os.getenv("PASSWORD"))
    return {
        "username": username,
        "password": password,
    }


def _get_source_refresh_token(source: Dict[str, Any]) -> str:
    config = _coerce_source_config(source.get("config"))
    auth_config = _get_nested_auth_config(config)
    return _clean_auth_value(auth_config.get("refresh_token") or config.get("refresh_token"))


def _get_effective_auth_key(source: Dict[str, Any]) -> str:
    config = _coerce_source_config(source.get("config"))
    auth_config = _get_nested_auth_config(config)
    return _clean_auth_value(source.get("auth_key") or auth_config.get("access_token"))


def _stamp_source_auth_state(
    source: Dict[str, Any],
    *,
    access_token: Optional[str] = None,
    refresh_token: Optional[str] = None,
    error_message: Optional[str] = None,
) -> Dict[str, Any]:
    updated = _clone_source(source)
    config = updated["config"]
    auth_config = _get_nested_auth_config(config)
    credentials = _get_source_credentials(updated)
    now_iso = datetime.utcnow().isoformat()

    if credentials["username"] and not auth_config.get("username"):
        auth_config["username"] = credentials["username"]
    if credentials["password"] and not auth_config.get("password"):
        auth_config["password"] = credentials["password"]

    if access_token is not None:
        token = _clean_auth_value(access_token)
        updated["auth_key"] = token
        auth_config["access_token"] = token
        auth_config["token_updated_at"] = now_iso
        if token:
            auth_config["verified_at"] = now_iso

    if refresh_token is not None:
        token = _clean_auth_value(refresh_token)
        if token:
            auth_config["refresh_token"] = token
        else:
            auth_config.pop("refresh_token", None)

    if error_message:
        auth_config["last_auth_error"] = error_message
    else:
        auth_config.pop("last_auth_error", None)

    config[WE_MPRSS_AUTH_CONFIG_KEY] = auth_config
    return updated


def _build_source_update(source: Dict[str, Any]) -> Dict[str, Any]:
    normalized = _clone_source(source)
    return {
        "auth_key": _clean_auth_value(normalized.get("auth_key")),
        "config": normalized["config"],
    }


def _with_source_update(
    payload: Dict[str, Any],
    source_update: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    if source_update:
        payload["source_update"] = source_update
    return payload


def _find_first_matching_value(payload: Any, keys: set[str]) -> str:
    if isinstance(payload, dict):
        for key, value in payload.items():
            if key in keys and value is not None:
                cleaned = _clean_auth_value(value)
                if cleaned:
                    return cleaned
            nested = _find_first_matching_value(value, keys)
            if nested:
                return nested
    elif isinstance(payload, list):
        for item in payload:
            nested = _find_first_matching_value(item, keys)
            if nested:
                return nested
    return ""


def _extract_token_bundle(payload: Dict[str, Any]) -> Dict[str, str]:
    access_token = _find_first_matching_value(
        payload,
        {"access_token", "accessToken", "token", "jwt"},
    )
    if not access_token:
        raise ValueError("we-mp-rss auth response missing access token")
    return {
        "access_token": access_token,
        "refresh_token": _find_first_matching_value(
            payload,
            {"refresh_token", "refreshToken"},
        ),
    }


def _is_auth_error(exc: Exception) -> bool:
    if isinstance(exc, httpx.HTTPStatusError) and exc.response is not None:
        return exc.response.status_code in {401, 403}

    lowered = str(exc).lower()
    auth_markers = ("401", "403", "unauthorized", "forbidden", "token")
    return any(marker in lowered for marker in auth_markers)


def choose_detail_html(detail: Dict[str, Any]) -> str:
    html_content = str(detail.get("content_html") or "").strip()
    if html_content:
        return html_content
    return str(detail.get("content") or "").strip()


def html_to_text(content: str) -> str:
    if not content:
        return ""
    normalized = re.sub(r"(?i)<br\\s*/?>", "\n", content)
    normalized = re.sub(r"(?i)</p\\s*>", "\n\n", normalized)
    normalized = re.sub(r"(?i)</div\\s*>", "\n", normalized)
    normalized = re.sub(r"(?is)<script.*?</script>", "", normalized)
    normalized = re.sub(r"(?is)<style.*?</style>", "", normalized)
    normalized = re.sub(r"(?s)<[^>]+>", "", normalized)
    normalized = html.unescape(normalized)
    normalized = re.sub(r"\n{3,}", "\n\n", normalized)
    normalized = re.sub(r"[ \t]+", " ", normalized)
    return normalized.strip()


def _build_detail_fetched_payload(
    *,
    task_id: str,
    requested_at: datetime,
    detail: Dict[str, Any],
    article: Dict[str, Any],
    error_message: Optional[str] = None,
) -> Dict[str, Any]:
    html_content = choose_detail_html(detail)
    return {
        "content_refresh_status": "detail_fetched",
        "content_refresh_task_id": task_id or None,
        "content_refresh_requested_at": requested_at,
        "content_refresh_checked_at": datetime.utcnow(),
        "content_refreshed_at": datetime.utcnow(),
        "content_refresh_error": error_message,
        "content_html": html_content,
        "content": html_to_text(html_content) or detail.get("description") or article.get("content") or "",
    }


async def _request_json(
    method: str,
    url: str,
    *,
    auth_key: str = "",
    params: Optional[Dict[str, Any]] = None,
    timeout_seconds: int = DEFAULT_REFRESH_TIMEOUT_SECONDS,
) -> Dict[str, Any]:
    headers = build_auth_headers(auth_key)
    async with httpx.AsyncClient(timeout=timeout_seconds, follow_redirects=True) as client:
        response = await client.request(method, url, headers=headers, params=params)
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, dict):
        raise ValueError("we-mp-rss API did not return a JSON object")
    return payload


async def _request_form_json(
    url: str,
    *,
    form_data: Dict[str, str],
    timeout_seconds: int = DEFAULT_REFRESH_TIMEOUT_SECONDS,
) -> Dict[str, Any]:
    async with httpx.AsyncClient(timeout=timeout_seconds, follow_redirects=True) as client:
        response = await client.post(url, data=form_data)
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, dict):
        raise ValueError("we-mp-rss auth API did not return a JSON object")
    return payload


async def verify_source_token(source: Dict[str, Any]) -> bool:
    auth_key = _get_effective_auth_key(source)
    if not auth_key:
        return False

    try:
        await _request_json(
            "GET",
            f"{get_service_base_url(source['api_base_url'])}/api/v1/wx/auth/verify",
            auth_key=auth_key,
        )
        return True
    except Exception as exc:
        if _is_auth_error(exc):
            return False
        raise


async def refresh_source_token(source: Dict[str, Any]) -> Dict[str, str]:
    payload = await _request_json(
        "POST",
        f"{get_service_base_url(source['api_base_url'])}/api/v1/wx/auth/refresh",
        auth_key=_get_effective_auth_key(source),
    )
    return _extract_token_bundle(payload)


async def login_source_with_password(source: Dict[str, Any]) -> Dict[str, str]:
    credentials = _get_source_credentials(source)
    if not credentials["username"] or not credentials["password"]:
        raise ValueError("we-mp-rss username/password are required for login")

    payload = await _request_form_json(
        f"{get_service_base_url(source['api_base_url'])}/api/v1/wx/auth/login",
        form_data={
            "username": credentials["username"],
            "password": credentials["password"],
        },
    )
    return _extract_token_bundle(payload)


async def ensure_source_auth_state(
    source: Dict[str, Any],
    *,
    verify_token: Callable[[Dict[str, Any]], Awaitable[bool]] = verify_source_token,
    refresh_token: Callable[[Dict[str, Any]], Awaitable[Dict[str, str]]] = refresh_source_token,
    login_with_password: Callable[[Dict[str, Any]], Awaitable[Dict[str, str]]] = login_source_with_password,
    verify_current_token: bool = True,
) -> Dict[str, Any]:
    normalized = _stamp_source_auth_state(source)
    original_update = _build_source_update(normalized)
    current_token = _get_effective_auth_key(normalized)

    if current_token and verify_current_token:
        is_valid = await verify_token(normalized)
        if is_valid:
            return {
                "source": normalized,
                "changed": _build_source_update(normalized) != _build_source_update(source),
            }

    if current_token:
        try:
            refreshed = await refresh_token(normalized)
            normalized = _stamp_source_auth_state(
                normalized,
                access_token=refreshed.get("access_token"),
                refresh_token=refreshed.get("refresh_token"),
            )
            return {
                "source": normalized,
                "changed": _build_source_update(normalized) != original_update,
            }
        except Exception as exc:
            normalized = _stamp_source_auth_state(normalized, error_message=str(exc))

    credentials = _get_source_credentials(normalized)
    if credentials["username"] and credentials["password"]:
        logged_in = await login_with_password(normalized)
        normalized = _stamp_source_auth_state(
            normalized,
            access_token=logged_in.get("access_token"),
            refresh_token=logged_in.get("refresh_token"),
        )
        return {
            "source": normalized,
            "changed": _build_source_update(normalized) != original_update,
        }

    return {
        "source": normalized,
        "changed": _build_source_update(normalized) != original_update,
    }


async def ensure_authenticated_source(
    source: Dict[str, Any],
    *,
    verify_token: Callable[[Dict[str, Any]], Awaitable[bool]],
    refresh_token: Callable[[Dict[str, Any], str], Awaitable[str]],
    login_token: Callable[[Dict[str, Any], str, str], Awaitable[str]],
    persist_token: Callable[[Dict[str, Any], str], Awaitable[None]],
) -> str:
    current_token = _clean_auth_value(source.get("auth_key"))
    if current_token:
        if await verify_token(source):
            return current_token

        refreshed_token = _clean_auth_value(await refresh_token(source, current_token))
        if refreshed_token:
            await persist_token(source, refreshed_token)
            return refreshed_token

    credentials = _get_source_credentials(source)
    if credentials["username"] and credentials["password"]:
        login_result = _clean_auth_value(
            await login_token(source, credentials["username"], credentials["password"])
        )
        if login_result:
            await persist_token(source, login_result)
            return login_result

    return ""


async def trigger_mp_refresh(
    source: Dict[str, Any],
    provider_source_id: str,
    *,
    start_page: int = 0,
    end_page: int = 1,
) -> Dict[str, Any]:
    payload = await _request_json(
        "GET",
        f"{get_service_base_url(source['api_base_url'])}/api/v1/wx/mps/update/{provider_source_id}",
        auth_key=source.get("auth_key", ""),
        params={"start_page": start_page, "end_page": end_page},
    )
    return payload


async def fetch_latest_articles_by_mp_id(
    source: Dict[str, Any],
    provider_source_id: str,
    *,
    latest_limit: int = DEFAULT_PROVIDER_LATEST_LIMIT,
) -> list[Dict[str, Any]]:
    payload = await _request_json(
        "GET",
        f"{get_service_base_url(source['api_base_url'])}/api/v1/wx/articles",
        auth_key=source.get("auth_key", ""),
        params={
            "mp_id": provider_source_id,
            "limit": latest_limit,
            "offset": 0,
        },
    )
    data = payload.get("data") or payload
    articles = data.get("list") if isinstance(data, dict) else []
    if not isinstance(articles, list):
        raise ValueError("we-mp-rss latest articles response missing list")
    return [item for item in articles if isinstance(item, dict)]


def filter_today_articles(
    articles: list[Dict[str, Any]],
    *,
    now: Optional[dt.datetime] = None,
    tz_name: str = DEFAULT_PROVIDER_TIMEZONE,
) -> list[Dict[str, Any]]:
    zone = ZoneInfo(tz_name)
    current = now.astimezone(zone) if now else dt.datetime.now(zone)
    day_start = current.replace(hour=0, minute=0, second=0, microsecond=0)
    next_day_start = day_start + dt.timedelta(days=1)
    day_start_ts = int(day_start.timestamp())
    next_day_start_ts = int(next_day_start.timestamp())

    result: list[Dict[str, Any]] = []
    for article in articles:
        try:
            publish_time = int(article.get("publish_time") or 0)
        except (TypeError, ValueError):
            continue
        if day_start_ts <= publish_time < next_day_start_ts:
            result.append(article)
    return result


def needs_content_backfill(article: Dict[str, Any]) -> bool:
    has_content = article.get("has_content")
    if has_content in (1, True, "1", "true", "True"):
        return False
    content = str(article.get("content") or "").strip()
    content_html = str(article.get("content_html") or "").strip()
    return not (content or content_html)


async def request_article_refresh(source: Dict[str, Any], article_id: str) -> Dict[str, Any]:
    payload = await _request_json(
        "POST",
        f"{get_service_base_url(source['api_base_url'])}/api/v1/wx/articles/{article_id}/refresh",
        auth_key=source.get("auth_key", ""),
    )
    data = payload.get("data") or payload
    return {
        "task_id": str(data.get("task_id") or ""),
        "article_id": str(data.get("article_id") or article_id),
        "status": str(data.get("status") or "pending"),
    }


async def trigger_article_refresh(source: Dict[str, Any], article_id: str) -> Dict[str, Any]:
    return await request_article_refresh(source, article_id)


async def poll_refresh_task(source: Dict[str, Any], task_id: str) -> Dict[str, Any]:
    payload = await _request_json(
        "GET",
        f"{get_service_base_url(source['api_base_url'])}/api/v1/wx/articles/refresh/tasks/{task_id}",
        auth_key=source.get("auth_key", ""),
    )
    data = payload.get("data") or payload
    return {
        "task_id": str(data.get("task_id") or task_id),
        "status": str(data.get("status") or "pending"),
        "error": str(data.get("error") or data.get("message") or "").strip(),
    }


async def fetch_article_detail(source: Dict[str, Any], article_id: str) -> Dict[str, Any]:
    payload = await _request_json(
        "GET",
        f"{get_service_base_url(source['api_base_url'])}/api/v1/wx/articles/{article_id}",
        auth_key=source.get("auth_key", ""),
    )
    data = payload.get("data") or payload
    return {
        "article_id": str(data.get("id") or article_id),
        "title": str(data.get("title") or "").strip(),
        "description": str(data.get("description") or "").strip(),
        "url": str(data.get("url") or "").strip(),
        "content": str(data.get("content") or "").strip(),
        "content_html": str(data.get("content_html") or "").strip(),
        "has_content": data.get("has_content"),
        "publish_time": data.get("publish_time"),
    }


async def refresh_article_content_and_fetch_detail(
    *,
    source: Dict[str, Any],
    article: Dict[str, Any],
    ensure_source_auth_state: Callable[[Dict[str, Any]], Awaitable[Dict[str, Any]]] = ensure_source_auth_state,
    request_refresh: Callable[[Dict[str, Any], str], Awaitable[Dict[str, Any]]] = request_article_refresh,
    poll_refresh_task: Callable[[Dict[str, Any], str], Awaitable[Dict[str, Any]]] = poll_refresh_task,
    fetch_article_detail: Callable[[Dict[str, Any], str], Awaitable[Dict[str, Any]]] = fetch_article_detail,
    timeout_seconds: int = 180,
    poll_interval_seconds: float = 0.0,
) -> Dict[str, Any]:
    auth_state = await ensure_source_auth_state(source)
    source = auth_state.get("source") or source
    source_update = _build_source_update(source) if auth_state.get("changed") else None
    auth_key = _get_effective_auth_key(source)
    article_id = str(article.get("provider_article_id") or "").strip()
    if not article_id:
        article_id = str(article.get("external_id") or "").strip()

    if not auth_key:
        return _with_source_update({
            "content_refresh_status": "refresh_failed",
            "content_refresh_error": "we-mp-rss auth_key is required for protected refresh APIs",
        }, source_update)

    if not article_id:
        return _with_source_update({
            "content_refresh_status": "refresh_failed",
            "content_refresh_error": "article provider_article_id is required for we-mp-rss refresh",
        }, source_update)

    requested_at = datetime.utcnow()
    task_id = ""

    try:
        refresh_response = await request_refresh(source, article_id)
        task_id = str(refresh_response.get("task_id") or "").strip()
        if not task_id:
            return _with_source_update({
                "content_refresh_status": "refresh_failed",
                "content_refresh_error": "we-mp-rss refresh response missing task_id",
            }, source_update)

        deadline = requested_at.timestamp() + timeout_seconds

        while True:
            task_status = await poll_refresh_task(source, task_id)
            status = str(task_status.get("status") or "pending").strip().lower()

            if status == "success":
                detail = await fetch_article_detail(source, article_id)
                return _with_source_update(
                    _build_detail_fetched_payload(
                        task_id=task_id,
                        requested_at=requested_at,
                        detail=detail,
                        article=article,
                    ),
                    source_update,
                )

            if status == "failed":
                detail = await fetch_article_detail(source, article_id)
                if choose_detail_html(detail):
                    return _with_source_update(
                        _build_detail_fetched_payload(
                            task_id=task_id,
                            requested_at=requested_at,
                            detail=detail,
                            article=article,
                            error_message=task_status.get("error") or "we-mp-rss refresh task failed",
                        ),
                        source_update,
                    )
                return _with_source_update({
                    "content_refresh_status": "refresh_failed",
                    "content_refresh_task_id": task_id,
                    "content_refresh_requested_at": requested_at,
                    "content_refresh_checked_at": datetime.utcnow(),
                    "content_refresh_error": task_status.get("error") or "we-mp-rss refresh task failed",
                }, source_update)

            if datetime.utcnow().timestamp() >= deadline:
                return _with_source_update({
                    "content_refresh_status": "refresh_failed",
                    "content_refresh_task_id": task_id,
                    "content_refresh_requested_at": requested_at,
                    "content_refresh_checked_at": datetime.utcnow(),
                    "content_refresh_error": "we-mp-rss refresh task timed out",
                }, source_update)

            if poll_interval_seconds > 0:
                await asyncio.sleep(poll_interval_seconds)
    except Exception as exc:
        if task_id:
            try:
                detail = await fetch_article_detail(source, article_id)
                if choose_detail_html(detail):
                    return _with_source_update(
                        _build_detail_fetched_payload(
                            task_id=task_id,
                            requested_at=requested_at,
                            detail=detail,
                            article=article,
                            error_message=str(exc),
                        ),
                        source_update,
                    )
            except Exception:
                pass
        return _with_source_update({
            "content_refresh_status": "refresh_failed",
            "content_refresh_task_id": task_id or None,
            "content_refresh_requested_at": requested_at,
            "content_refresh_checked_at": datetime.utcnow(),
            "content_refresh_error": str(exc),
        }, source_update)
