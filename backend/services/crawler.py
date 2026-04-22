import html
import json
import re
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urljoin
import xml.etree.ElementTree as ET

import httpx

from database import (
    add_fetch_log,
    create_article,
    get_article_by_external_id,
    get_source_by_id,
    update_source_auth_state,
    update_source_fetch_time,
)
from services.we_mprss import (
    WE_MPRSS_SOURCE_TYPE,
    ensure_source_auth_state,
    normalize_feed_url_for_discovery,
    rewrite_local_service_url_for_runtime,
)

DEFAULT_TIMEOUT = 30
MAX_RETRIES = 3
USER_AGENT = "mindflow/1.0 (+https://github.com)"
SUPPORTED_SOURCE_TYPES = {"native_rss", "rsshub", "we_mp_rss"}


class FeedCrawlerError(Exception):
    """Feed crawler exception with an end-user-safe message."""

    def __init__(self, code: str, message: str, suggestion: str = ""):
        self.code = code
        self.message = message
        self.suggestion = suggestion
        super().__init__(f"[{code}] {message}")


async def _maybe_await(value: Any) -> Any:
    if hasattr(value, "__await__"):
        return await value
    return value


def _strip_namespace(tag: str) -> str:
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag


def _clean_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _first_child_text(node: ET.Element, *names: str) -> str:
    wanted = set(names)
    for child in list(node):
        if _strip_namespace(child.tag) in wanted:
            return _clean_text("".join(child.itertext()))
    return ""


def _first_child_attr(node: ET.Element, name: str, attr: str) -> str:
    for child in list(node):
        if _strip_namespace(child.tag) == name:
            value = child.attrib.get(attr)
            if value:
                return value.strip()
    return ""


def _normalize_html_content(content: str) -> str:
    if not content:
        return ""

    normalized = re.sub(r"(?i)<br\s*/?>", "\n", content)
    normalized = re.sub(r"(?i)</p\s*>", "\n\n", normalized)
    normalized = re.sub(r"(?i)</div\s*>", "\n", normalized)
    normalized = re.sub(r"(?i)</li\s*>", "\n", normalized)
    normalized = re.sub(r"(?i)</h[1-6]\s*>", "\n\n", normalized)
    normalized = re.sub(r"(?is)<script.*?</script>", "", normalized)
    normalized = re.sub(r"(?is)<style.*?</style>", "", normalized)
    normalized = re.sub(r"(?s)<[^>]+>", "", normalized)
    normalized = html.unescape(normalized)
    normalized = normalized.replace("\r", "\n")
    normalized = re.sub(r"\n{3,}", "\n\n", normalized)
    normalized = re.sub(r"[ \t]+", " ", normalized)
    return normalized.strip()


def _normalize_entry_content(content: str) -> str:
    if not content:
        return ""
    if "<" in content and ">" in content:
        return _normalize_html_content(content)
    return html.unescape(content).strip()


def _parse_datetime(value: str) -> Optional[datetime]:
    raw = _clean_text(value)
    if not raw:
        return None

    try:
        parsed = parsedate_to_datetime(raw)
        if parsed.tzinfo is not None:
            return parsed.astimezone(timezone.utc).replace(tzinfo=None)
        return parsed
    except (TypeError, ValueError, IndexError, OverflowError):
        pass

    candidate = raw.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(candidate)
    except ValueError:
        return None

    if parsed.tzinfo is not None:
        return parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed


def _normalize_xml_text(payload: str) -> str:
    return payload.lstrip("\ufeff").strip()


async def fetch_feed_document(url: str, auth_key: str = "") -> Tuple[str, str]:
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": ",".join(
            [
                "application/rss+xml",
                "application/atom+xml",
                "application/feed+json",
                "application/json;q=0.9",
                "application/xml;q=0.8",
                "text/xml;q=0.8",
                "text/plain;q=0.5",
            ]
        ),
    }
    if auth_key:
        headers["Authorization"] = f"Bearer {auth_key}"
        headers["X-Auth-Key"] = auth_key

    last_error: Optional[Exception] = None
    for _attempt in range(MAX_RETRIES):
        try:
            async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT, follow_redirects=True) as client:
                response = await client.get(url, headers=headers, follow_redirects=True)
            response.raise_for_status()
            return response.text, response.headers.get("content-type", "")
        except httpx.HTTPError as exc:
            last_error = exc

    raise FeedCrawlerError(
        code="NETWORK_ERROR",
        message=str(last_error) if last_error else "feed request failed",
        suggestion="请检查 feed URL 是否可访问",
    )


def _parse_rss_feed(root: ET.Element) -> Tuple[Dict[str, str], List[Dict[str, Any]]]:
    channel = None
    if _strip_namespace(root.tag).lower() == "rss":
        for child in list(root):
            if _strip_namespace(child.tag) == "channel":
                channel = child
                break
    if channel is None:
        channel = root

    feed_meta = {
        "title": _first_child_text(channel, "title") or "Untitled Feed",
        "link": _first_child_text(channel, "link"),
    }

    items = [child for child in list(channel) if _strip_namespace(child.tag) == "item"]
    if not items:
        items = [child for child in root.iter() if _strip_namespace(child.tag) == "item"]

    entries: List[Dict[str, Any]] = []
    for item in items:
        title = _first_child_text(item, "title") or "Untitled Entry"
        link = _first_child_text(item, "link")
        external_id = _first_child_text(item, "guid", "id") or link or title
        content = (
            _first_child_text(item, "encoded")
            or _first_child_text(item, "content")
            or _first_child_text(item, "description")
            or _first_child_text(item, "summary")
        )
        description = _first_child_text(item, "description") or _first_child_text(item, "summary")
        author = _first_child_text(item, "creator", "author")
        published_at = _parse_datetime(
            _first_child_text(item, "pubDate", "date", "published", "updated")
        )
        entries.append(
            {
                "external_id": external_id,
                "title": title,
                "link": link,
                "content": _normalize_entry_content(content),
                "description": _normalize_entry_content(description),
                "author": author,
                "published_at": published_at,
            }
        )

    return feed_meta, entries


def _parse_atom_feed(root: ET.Element) -> Tuple[Dict[str, str], List[Dict[str, Any]]]:
    feed_meta = {
        "title": _first_child_text(root, "title") or "Untitled Feed",
        "link": _first_child_attr(root, "link", "href") or _first_child_text(root, "link"),
    }

    entries: List[Dict[str, Any]] = []
    for entry in [child for child in list(root) if _strip_namespace(child.tag) == "entry"]:
        title = _first_child_text(entry, "title") or "Untitled Entry"
        link = _first_child_attr(entry, "link", "href") or _first_child_text(entry, "link")
        external_id = _first_child_text(entry, "id") or link or title
        content = _first_child_text(entry, "content") or _first_child_text(entry, "summary")
        description = _first_child_text(entry, "summary") or _first_child_text(entry, "content")
        author = _first_child_text(entry, "name", "author")
        published_at = _parse_datetime(
            _first_child_text(entry, "published", "updated")
        )
        entries.append(
            {
                "external_id": external_id,
                "title": title,
                "link": link,
                "content": _normalize_entry_content(content),
                "description": _normalize_entry_content(description),
                "author": author,
                "published_at": published_at,
            }
        )

    return feed_meta, entries


def _parse_json_feed(payload: str) -> Tuple[Dict[str, str], List[Dict[str, Any]]]:
    try:
        data = json.loads(payload)
    except json.JSONDecodeError as exc:
        raise FeedCrawlerError(
            code="INVALID_JSON",
            message="feed 响应不是合法 JSON",
            suggestion="请确认该源返回的是 JSON Feed",
        ) from exc

    if not isinstance(data, dict):
        raise FeedCrawlerError(
            code="INVALID_JSON_FEED",
            message="feed JSON 结构不正确",
            suggestion="请确认该源返回的是对象形式的 JSON Feed",
        )

    feed_meta = {
        "title": _clean_text(data.get("title") or data.get("name")) or "Untitled Feed",
        "link": _clean_text(data.get("home_page_url") or data.get("feed_url") or data.get("link")),
    }

    entries: List[Dict[str, Any]] = []
    for item in data.get("items", []):
        if not isinstance(item, dict):
            continue
        title = _clean_text(item.get("title")) or "Untitled Entry"
        link = _clean_text(item.get("url") or item.get("external_url") or item.get("link"))
        external_id = _clean_text(item.get("id")) or link or title
        content = _clean_text(
            item.get("content_text")
            or item.get("content_html")
            or item.get("content")
            or item.get("summary")
            or item.get("description")
        )
        description = _clean_text(item.get("description") or item.get("summary"))
        author = ""
        authors = item.get("authors")
        if isinstance(authors, list) and authors:
            first_author = authors[0]
            if isinstance(first_author, dict):
                author = _clean_text(first_author.get("name"))
        published_at = _parse_datetime(
            _clean_text(item.get("date_published") or item.get("date_modified") or item.get("updated"))
        )
        entries.append(
            {
                "external_id": external_id,
                "title": title,
                "link": link,
                "content": _normalize_entry_content(content),
                "description": _normalize_entry_content(description),
                "author": author,
                "published_at": published_at,
            }
        )

    return feed_meta, entries


def parse_feed_document(payload: str, content_type: str = "") -> Tuple[Dict[str, str], List[Dict[str, Any]]]:
    normalized = payload.strip()
    if not normalized:
        raise FeedCrawlerError(
            code="EMPTY_FEED",
            message="feed 响应为空",
            suggestion="请检查 feed URL 是否正确",
        )

    lowered_type = content_type.lower()
    if normalized.startswith("{") or "json" in lowered_type:
        return _parse_json_feed(normalized)

    try:
        root = ET.fromstring(_normalize_xml_text(normalized))
    except ET.ParseError as exc:
        raise FeedCrawlerError(
            code="INVALID_XML",
            message="feed 响应不是合法 XML",
            suggestion="请确认该源返回的是 RSS 或 Atom XML",
        ) from exc

    root_name = _strip_namespace(root.tag).lower()
    if root_name == "feed":
        return _parse_atom_feed(root)
    if root_name in {"rss", "rdf", "rdf:rdf"}:
        return _parse_rss_feed(root)

    raise FeedCrawlerError(
        code="UNSUPPORTED_FEED",
        message=f"不支持的 feed 根节点: {root_name}",
        suggestion="当前仅支持 RSS / Atom / JSON Feed",
    )


def _resolve_feed_url(source: Dict[str, Any], source_config: Dict[str, Any]) -> str:
    feed_url = _clean_text(source_config.get("feed_url")) or _clean_text(source.get("api_base_url"))
    if not feed_url:
        raise FeedCrawlerError(
            code="MISSING_FEED_URL",
            message="Feed URL 不能为空",
            suggestion="请为该来源配置可访问的 feed URL",
        )
    return feed_url


def _coerce_source_config(raw_config: Any) -> Dict[str, Any]:
    if isinstance(raw_config, str):
        try:
            parsed = json.loads(raw_config)
        except json.JSONDecodeError:
            return {}
        return parsed if isinstance(parsed, dict) else {}
    return raw_config if isinstance(raw_config, dict) else {}


def _normalize_entry_link(link: str, feed_link: str, feed_url: str) -> str:
    candidate = _clean_text(link)
    if not candidate:
        return feed_link or feed_url
    if candidate.startswith(("http://", "https://")):
        return candidate
    base = feed_link or feed_url
    return urljoin(base, candidate)


async def fetch_source_articles(source_id: int) -> Tuple[int, str]:
    source = await _maybe_await(get_source_by_id(source_id))
    if not source:
        return 0, "新闻源不存在"

    source_type = _clean_text(source.get("source_type"))
    if source_type not in SUPPORTED_SOURCE_TYPES:
        return 0, "暂不支持此类型的新闻源"

    source_config = _coerce_source_config(source.get("config"))

    try:
        feed_url = _resolve_feed_url(source, source_config)
        if source_type == WE_MPRSS_SOURCE_TYPE:
            feed_url = normalize_feed_url_for_discovery(feed_url)
            feed_url = rewrite_local_service_url_for_runtime(feed_url)
            auth_state = await _maybe_await(ensure_source_auth_state(source))
            source = auth_state.get("source") or source
            if auth_state.get("changed"):
                await _maybe_await(
                    update_source_auth_state(
                        source_id,
                        auth_key=source.get("auth_key") or "",
                        config=source.get("config") or {},
                    )
                )
        payload, content_type = await fetch_feed_document(feed_url, source.get("auth_key") or "")
        feed_meta, entries = parse_feed_document(payload, content_type)

        added_count = 0
        feed_link = _clean_text(feed_meta.get("link"))
        source_name = _clean_text(source.get("name")) or _clean_text(feed_meta.get("title")) or "未知来源"

        for entry in entries:
            external_id = _clean_text(entry.get("external_id"))
            if not external_id:
                continue

            existing = await _maybe_await(get_article_by_external_id(source_id, external_id))
            if existing:
                continue

            title = _clean_text(entry.get("title")) or "无标题"
            link = _normalize_entry_link(_clean_text(entry.get("link")), feed_link, feed_url)
            content = _clean_text(entry.get("content")) or title
            author = _clean_text(entry.get("author")) or source_name

            create_payload = {
                "source_id": source_id,
                "title": title,
                "external_id": external_id,
                "link": link,
                "content": content,
                "author": author,
                "published_at": entry.get("published_at"),
            }

            if source_type == WE_MPRSS_SOURCE_TYPE:
                create_payload["content"] = _clean_text(entry.get("description")) or title
                create_payload["content_html"] = ""
                create_payload["content_refresh_status"] = "waiting_for_refresh"

            await _maybe_await(
                create_article(**create_payload)
            )
            added_count += 1

        await _maybe_await(update_source_fetch_time(source_id, len(entries)))
        await _maybe_await(add_fetch_log(source_id, "success", f"成功抓取 {added_count} 篇新文章"))
        return added_count, "抓取成功"
    except FeedCrawlerError as exc:
        await _maybe_await(add_fetch_log(source_id, "failed", f"[{exc.code}] {exc.message}"))
        return 0, f"抓取失败: [{exc.code}] {exc.message}"
    except Exception as exc:
        await _maybe_await(add_fetch_log(source_id, "failed", str(exc)))
        return 0, f"抓取失败: {str(exc)}"


async def fetch_all_sources() -> Dict[int, Tuple[int, str]]:
    from database import get_all_sources

    sources = await _maybe_await(get_all_sources())
    results: Dict[int, Tuple[int, str]] = {}

    for source in sources:
        try:
            count, message = await fetch_source_articles(source["id"])
            results[source["id"]] = (count, message)
        except Exception as exc:
            results[source["id"]] = (0, f"抓取异常: {str(exc)}")

    return results
