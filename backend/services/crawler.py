import httpx
import json
import re
import os
import time
import inspect
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any, List, Tuple
from dotenv import load_dotenv
from database import (
    get_source_by_id, create_article, get_article_by_external_id,
    update_source_fetch_time, add_fetch_log
)

# Load environment variables from .env file
_project_root = Path(__file__).parent.parent.parent
load_dotenv(_project_root / ".env")

BASE_URL = os.environ.get("MPTEXT_BASE_URL", "https://down.mptext.top")
DEFAULT_TIMEOUT = 30
MAX_RETRIES = 3
RETRY_DELAY = 1


class MPTextCrawlerError(Exception):
    """MPText crawler exception with error code and suggestion"""
    def __init__(self, code: str, message: str, suggestion: str = ""):
        self.code = code
        self.message = message
        self.suggestion = suggestion
        super().__init__(f"[{code}] {message}")


def get_api_key() -> str:
    """Get MPTEXT_API_KEY from environment"""
    return os.environ.get("MPTEXT_API_KEY", "")


def normalize_format(value: str) -> str:
    """Normalize format parameter - matches mptext-crawler logic"""
    f = value.lower()
    if f in {"md", "markdown"}:
        return "markdown"
    if f in {"txt", "text"}:
        return "text"
    if f in {"htm", "html"}:
        return "html"
    if f == "json":
        return "json"
    return "markdown"  # default


def http_get_with_retry(path: str, params: Dict[str, str], auth_key: str = "") -> str:
    """Make HTTP GET request with retry logic - matches mptext-crawler behavior"""
    query = "&".join([f"{k}={v}" for k, v in params.items()])
    url = f"{BASE_URL}{path}?{query}" if query else f"{BASE_URL}{path}"

    headers = {
        "User-Agent": "ai-crawler/1.0 (+python)",
        "Accept": "*/*"
    }
    if auth_key:
        headers["X-Auth-Key"] = auth_key

    last_error = None
    for attempt in range(MAX_RETRIES):
        try:
            # Use a transport that bypasses system proxy
            transport = httpx.HTTPTransport(retries=0)
            with httpx.Client(timeout=DEFAULT_TIMEOUT, transport=transport) as client:
                resp = client.get(url, headers=headers)
                if resp.status_code == 429 and attempt < MAX_RETRIES - 1:
                    time.sleep(RETRY_DELAY)
                    continue
                if resp.status_code >= 500 and attempt < MAX_RETRIES - 1:
                    time.sleep(RETRY_DELAY)
                    continue
                resp.raise_for_status()
                return resp.text
        except httpx.HTTPError as e:
            last_error = e
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_DELAY)
                continue

    raise MPTextCrawlerError(
        code="NETWORK_ERROR",
        message=str(last_error),
        suggestion="网络连接失败，请检查代理/网络连通性后重试"
    )


def validate_response(response_text: str, mode: str = "strict") -> dict:
    """
    Validate API response - matches mptext-crawler validation logic
    mode: 'strict' - requires valid JSON with base_resp.ret=0
           'allow_content' - returns content even if ret != 0 (for download)
    """
    try:
        data = json.loads(response_text)
    except json.JSONDecodeError:
        if mode == "allow_content":
            return {"content": response_text}
        raise MPTextCrawlerError(
            code="INVALID_JSON",
            message="接口响应不是合法 JSON",
            suggestion="请稍后重试或检查接口可用性"
        )

    base_resp = data.get("base_resp", {})
    ret = base_resp.get("ret")
    err_msg = str(base_resp.get("err_msg", ""))

    if ret is not None and str(ret) != "0":
        suggestion = "请检查参数或稍后重试"
        lower_msg = err_msg.lower()
        if "认证" in err_msg or "auth" in lower_msg:
            suggestion = "请检查 MPTEXT_API_KEY 是否正确"
        elif "429" in err_msg or "频率" in err_msg or "too many" in lower_msg:
            suggestion = "触发限流，请降低频率并在 5-30 秒后重试"

        if mode == "strict":
            raise MPTextCrawlerError(
                code=str(ret),
                message=err_msg or "接口返回失败",
                suggestion=suggestion
            )

    return data


def parse_json_if_possible(text: str) -> Optional[dict]:
    """Parse JSON if possible, return None if fails"""
    try:
        data = json.loads(text)
        if isinstance(data, dict):
            return data
    except Exception:
        return None
    return None


async def _maybe_await(value: Any) -> Any:
    """Resolve coroutine/AsyncMock values while leaving plain results untouched."""
    if inspect.isawaitable(value):
        return await value
    return value


# ============ MPText API Functions ============

async def search_account(keyword: str, begin: int = 0, size: int = 5) -> List[Dict]:
    """
    Search for WeChat official account by keyword
    Endpoint: GET /api/public/v1/account
    Returns: list of accounts with fakeid, nickname, alias, etc.
    """
    api_key = get_api_key()
    if not api_key:
        raise MPTextCrawlerError(
            code="MISSING_API_KEY",
            message="MPTEXT_API_KEY not found",
            suggestion="请在 .env 配置 MPTEXT_API_KEY=YOUR_MPTEXT_API_KEY"
        )

    if size > 20:
        size = 20

    response = http_get_with_retry(
        "/api/public/v1/account",
        {"keyword": keyword, "begin": str(begin), "size": str(size)},
        api_key
    )
    result = validate_response(response, mode="strict")
    return result.get("list", [])


async def search_account_by_url(url: str) -> List[Dict]:
    """
    Search account by article URL (with fallback to download)
    Endpoint: GET /api/public/v1/accountbyurl
    Falls back to: GET /api/public/v1/download?format=json
    Returns: list of accounts
    """
    api_key = get_api_key()
    if not api_key:
        raise MPTextCrawlerError(
            code="MISSING_API_KEY",
            message="MPTEXT_API_KEY not found",
            suggestion="请在 .env 配置 MPTEXT_API_KEY=YOUR_MPTEXT_API_KEY"
        )

    # Try accountbyurl first
    try:
        response = http_get_with_retry(
            "/api/public/v1/accountbyurl",
            {"url": url},
            api_key
        )
        result = validate_response(response, mode="strict")
        accounts = result.get("list", [])
        if accounts:
            return accounts
    except Exception:
        pass

    # Fallback: use download --format json to extract account info
    try:
        response = http_get_with_retry(
            "/api/public/v1/download",
            {"url": url, "format": "json"},
            ""  # download doesn't require auth
        )
        data = validate_response(response, mode="allow_content")

        # Extract account info from JSON download response
        if isinstance(data, dict):
            # Try fakeid first, then bizuin as fallback
            fakeid = data.get("fakeid") or data.get("bizuin") or ""
            nick_name = data.get("nick_name", "")

            if fakeid or nick_name:
                return [{
                    "fakeid": fakeid,
                    "nickname": nick_name,
                    "alias": data.get("alias", ""),
                    "verify_status": data.get("verify_status", 0),
                    "signature": data.get("signature", ""),
                    "avatar": data.get("round_head_img") or data.get("cover", "")
                }]
    except Exception:
        pass

    raise MPTextCrawlerError(
        code="PARSE_ERROR",
        message="无法从文章链接解析公众号信息",
        suggestion="请确保链接是有效的微信公众号文章"
    )


async def get_articles_by_fakeid(fakeid: str, begin: int = 0, size: int = 5) -> List[Dict]:
    """
    Get article list by fakeid
    Endpoint: GET /api/public/v1/article
    Returns: list of articles with title, link, cover, update_time, etc.
    """
    api_key = get_api_key()
    if not api_key:
        raise MPTextCrawlerError(
            code="MISSING_API_KEY",
            message="MPTEXT_API_KEY not found",
            suggestion="请在 .env 配置 MPTEXT_API_KEY=YOUR_MPTEXT_API_KEY"
        )

    if size > 20:
        size = 20

    response = http_get_with_retry(
        "/api/public/v1/article",
        {"fakeid": fakeid, "begin": str(begin), "size": str(size)},
        api_key
    )
    result = validate_response(response, mode="strict")
    return result.get("articles", [])


async def download_article(url: str, fmt: str = "markdown") -> str:
    """
    Download article content
    Endpoint: GET /api/public/v1/download
    Supported formats: markdown, html, text, json
    """
    format_str = normalize_format(fmt)
    response = http_get_with_retry(
        "/api/public/v1/download",
        {"url": url, "format": format_str},
        ""  # download endpoint doesn't require auth
    )
    # download uses allow_content mode since it returns content directly
    return response


async def get_author_info(fakeid: str) -> Dict[str, Any]:
    """
    Get account subject info (beta)
    Endpoint: GET /api/public/beta/authorinfo
    Returns: identity_name, is_verify, original_article_count, etc.
    """
    response = http_get_with_retry(
        "/api/public/beta/authorinfo",
        {"fakeid": fakeid},
        ""  # authorinfo doesn't require auth
    )
    result = validate_response(response, mode="strict")
    return result


# ============ Article Processing Functions ============

def clean_markdown_content(content: str) -> str:
    """Clean and normalize markdown content - matches mptext-crawler behavior"""
    if not content:
        return ""

    lines = content.split("\n")
    cleaned_lines = []
    skip_patterns = [
        r"^#\s*$",
        r"^\s*$",
        r"^>\s*$",
        r"\[TOC\]",
        r"^_footer",
        r"^_header",
        r"^-\s*$",
    ]

    for line in lines:
        should_skip = False
        for pattern in skip_patterns:
            if re.match(pattern, line.strip()):
                should_skip = True
                break
        if not should_skip:
            cleaned_lines.append(line)

    return "\n".join(cleaned_lines).strip()


def extract_title_from_markdown(content: str) -> str:
    """Extract title from markdown content"""
    for line in content.split("\n"):
        if line.startswith("# "):
            return line[2:].strip().split(" =", 1)[0] or "无标题"
    return "无标题"


def extract_nickname_from_json(meta: dict) -> str:
    """Extract nick_name from JSON metadata - matches mptext-crawler logic"""
    if not isinstance(meta, dict):
        return ""
    nick = str(meta.get("nick_name", "")).strip()
    if nick:
        return nick
    biz_card = meta.get("biz_card")
    if isinstance(biz_card, dict):
        items = biz_card.get("list")
        if isinstance(items, list):
            for item in items:
                if isinstance(item, dict):
                    name = str(item.get("nickname", "")).strip()
                    if name:
                        return name
    return ""


# ============ Main Crawler Functions ============

async def fetch_source_articles(source_id: int) -> Tuple[int, str]:
    """Fetch all articles from a source - enhanced version"""
    source = await _maybe_await(get_source_by_id(source_id))
    if not source:
        return 0, "新闻源不存在"

    source_config_raw = source.get("config")
    if isinstance(source_config_raw, str):
        source_config = json.loads(source_config_raw) if source_config_raw else {}
    else:
        source_config = source_config_raw or {}

    if source["source_type"] == "mptext":
        fakeid = source_config.get("fakeid")
        if not fakeid:
            return 0, "MPText 配置缺少 fakeid"

        try:
            # Get only the latest article (size=1) for daily digest
            all_articles = []
            articles = await get_articles_by_fakeid(fakeid, begin=0, size=1)
            all_articles.extend(articles)

            added_count = 0

            for article in all_articles:
                external_id = article.get("mid", "") or article.get("link", "")
                title = article.get("title", "无标题")
                link = article.get("link", "")
                update_time = article.get("update_time", 0)

                if not link:
                    continue

                # Check if article already exists
                existing = await _maybe_await(get_article_by_external_id(source_id, external_id))
                if existing:
                    continue

                # Parse update_time to datetime
                published_at = None
                if update_time:
                    try:
                        published_at = datetime.fromtimestamp(update_time)
                    except Exception:
                        pass

                # Download article content
                content = ""
                try:
                    content = await download_article(link, "markdown")
                    content = clean_markdown_content(content)
                except Exception as e:
                    content = f"内容下载失败: {str(e)}"

                # Create article in database
                await _maybe_await(create_article(
                    source_id=source_id,
                    title=title,
                    external_id=external_id,
                    link=link,
                    content=content,
                    author=source["name"],
                    published_at=published_at
                ))
                added_count += 1

            # Update source fetch time and count
            await _maybe_await(update_source_fetch_time(source_id, len(all_articles)))
            await _maybe_await(add_fetch_log(source_id, "success", f"成功抓取 {added_count} 篇新文章"))
            return added_count, "抓取成功"

        except MPTextCrawlerError as e:
            await _maybe_await(add_fetch_log(source_id, "failed", f"[{e.code}] {e.message}"))
            return 0, f"抓取失败: [{e.code}] {e.message}"
        except Exception as e:
            await _maybe_await(add_fetch_log(source_id, "failed", str(e)))
            return 0, f"抓取失败: {str(e)}"

    else:
        # Custom source type - placeholder for other APIs
        return 0, "暂不支持此类型的新闻源"


async def fetch_all_sources() -> Dict[int, Tuple[int, str]]:
    """Fetch articles from all sources"""
    from database import get_all_sources

    sources = await _maybe_await(get_all_sources())
    results = {}

    for source in sources:
        try:
            count, msg = await fetch_source_articles(source["id"])
            results[source["id"]] = (count, msg)
        except Exception as e:
            results[source["id"]] = (0, f"抓取异常: {str(e)}")

    return results
