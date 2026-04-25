from fastapi import APIRouter, HTTPException
from schemas import (
    NewsSourceCreate,
    NewsSourceUpdate,
    NewsSourceResponse,
    FetchResponse,
    WeMpRssAuthTemplateResponse,
)
from database import (
    get_all_sources, get_source_by_id, create_source,
    update_source, delete_source
)
from services.crawler import fetch_source_articles
import json

router = APIRouter(prefix="/api/sources", tags=["新闻源管理"])


def _coerce_config(config) -> dict:
    if isinstance(config, str):
        try:
            config = json.loads(config)
        except json.JSONDecodeError:
            config = {}
    if not isinstance(config, dict):
        config = {}
    return config


def _format_datetime(dt):
    """Convert datetime/date/string/None values to response-safe strings."""
    if dt is None:
        return None
    if isinstance(dt, str):
        return dt
    if hasattr(dt, "isoformat"):
        return dt.isoformat()
    return str(dt)


def _source_to_response(source: dict) -> dict:
    """Convert database source dict to response-safe payload."""
    result = dict(source)
    result["config"] = _coerce_config(result.get("config"))

    result["auth_key"] = result.get("auth_key") or ""

    article_count = result.get("article_count")
    if article_count is None:
        article_count = 0
    elif not isinstance(article_count, int):
        try:
            article_count = int(article_count)
        except (TypeError, ValueError):
            article_count = 0
    result["article_count"] = article_count

    result["created_at"] = _format_datetime(result.get("created_at"))
    result["updated_at"] = _format_datetime(result.get("updated_at"))
    result["last_fetch_at"] = _format_datetime(result.get("last_fetch_at"))
    return result


def _normalize_source_type(value):
    return value.value if hasattr(value, "value") else value


def _normalize_source_payload(payload: dict) -> dict:
    normalized = dict(payload)
    normalized["source_type"] = _normalize_source_type(normalized.get("source_type"))

    config = _coerce_config(normalized.get("config") or {})

    feed_url = normalized.get("api_base_url")
    if feed_url and not config.get("feed_url"):
        config["feed_url"] = feed_url

    normalized["config"] = config
    normalized["auth_key"] = normalized.get("auth_key") or ""
    return normalized


@router.get("", response_model=list[NewsSourceResponse])
async def list_sources():
    """获取所有新闻源"""
    sources = await get_all_sources()
    return [_source_to_response(s) for s in sources]


@router.get("/we-mp-rss-auth-template", response_model=WeMpRssAuthTemplateResponse)
async def get_we_mprss_auth_template():
    """获取最近已登记的 we-mp-rss 用户名与密码，用于新建同类来源时预填。"""
    sources = await get_all_sources()

    for source in sources:
        if _normalize_source_type(source.get("source_type")) != "we_mp_rss":
            continue
        config = _coerce_config(source.get("config"))
        auth = config.get("we_mprss_auth")
        if not isinstance(auth, dict):
            continue

        username = str(auth.get("username") or "").strip()
        password = str(auth.get("password") or "")
        if not username or not password:
            continue

        return WeMpRssAuthTemplateResponse(
            available=True,
            source_id=source.get("id"),
            source_name=source.get("name"),
            username=username,
            password=password,
        )

    return WeMpRssAuthTemplateResponse()


@router.post("", response_model=NewsSourceResponse)
async def add_source(source: NewsSourceCreate):
    """添加新闻源"""
    payload = _normalize_source_payload(source.model_dump())
    source_id = await create_source(
        name=payload["name"],
        source_type=payload["source_type"],
        api_base_url=payload["api_base_url"],
        auth_key=payload["auth_key"],
        config=payload["config"]
    )
    result = await get_source_by_id(source_id)
    return _source_to_response(result)


@router.get("/{source_id}", response_model=NewsSourceResponse)
async def get_source(source_id: int):
    """获取单个新闻源"""
    source = await get_source_by_id(source_id)
    if not source:
        raise HTTPException(status_code=404, detail="新闻源不存在")
    return _source_to_response(source)


@router.put("/{source_id}", response_model=NewsSourceResponse)
async def modify_source(source_id: int, update: NewsSourceUpdate):
    """更新新闻源"""
    source = await get_source_by_id(source_id)
    if not source:
        raise HTTPException(status_code=404, detail="新闻源不存在")

    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    update_data = _normalize_source_payload(update_data)
    await update_source(source_id, **update_data)

    result = await get_source_by_id(source_id)
    return _source_to_response(result)


@router.delete("/{source_id}")
async def remove_source(source_id: int):
    """删除新闻源"""
    source = await get_source_by_id(source_id)
    if not source:
        raise HTTPException(status_code=404, detail="新闻源不存在")
    await delete_source(source_id)
    return {"success": True, "message": "删除成功"}


@router.post("/{source_id}/fetch", response_model=FetchResponse)
async def trigger_fetch(source_id: int):
    """手动触发抓取"""
    source = await get_source_by_id(source_id)
    if not source:
        raise HTTPException(status_code=404, detail="新闻源不存在")

    count, msg = await fetch_source_articles(source_id)
    return FetchResponse(
        success=count > 0 or "成功" in msg,
        message=msg,
        articles_added=count
    )
