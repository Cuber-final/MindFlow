from datetime import date, datetime, time, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from schemas import (
    ArticleListResponse,
    ArticleResponse,
    ArticleStateResponse,
    ArticleStateUpdateRequest,
)
from database import (
    count_articles,
    get_all_sources,
    get_article_by_id,
    get_articles,
    update_article_summary,
    update_article_workbench_state_by_article_id,
)
from services.ai import summarize_text

router = APIRouter(prefix="/api/articles", tags=["文章管理"])


def _format_datetime(value):
    if value is None:
        return None
    if isinstance(value, str):
        return value
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def _parse_datetime_query(value: Optional[str], *, end_date_exclusive: bool = False) -> Optional[datetime]:
    if value is None:
        return None

    stripped = value.strip()
    if not stripped:
        return None

    try:
        if len(stripped) == 10:
            parsed_date = date.fromisoformat(stripped)
            parsed_datetime = datetime.combine(parsed_date, time.min)
            return parsed_datetime + timedelta(days=1) if end_date_exclusive else parsed_datetime

        parsed_datetime = datetime.fromisoformat(stripped.replace("Z", "+00:00"))
        if parsed_datetime.tzinfo is not None:
            return parsed_datetime.astimezone(timezone.utc).replace(tzinfo=None)
        return parsed_datetime
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=f"Invalid datetime query parameter: {value}") from exc


def _format_article_state(payload: dict) -> dict:
    read_at = payload.get("read_at")
    processed_at = payload.get("processed_at")
    last_opened_at = payload.get("last_opened_at")
    return {
        "article_id": payload["article_id"],
        "is_read": read_at is not None,
        "is_processed": processed_at is not None,
        "read_at": _format_datetime(read_at),
        "processed_at": _format_datetime(processed_at),
        "last_opened_at": _format_datetime(last_opened_at),
    }


async def enrich_article_with_source(article: dict, source_map: Optional[dict[int, str]] = None) -> dict:
    """Add source name to article"""
    article = article.copy()
    if source_map is None:
        sources = await get_all_sources()
        source_map = {s["id"]: s["name"] for s in sources}
    article["published_at"] = _format_datetime(article.get("published_at"))
    article["fetched_at"] = _format_datetime(article.get("fetched_at"))
    article["content_refresh_requested_at"] = _format_datetime(article.get("content_refresh_requested_at"))
    article["content_refresh_checked_at"] = _format_datetime(article.get("content_refresh_checked_at"))
    article["content_refreshed_at"] = _format_datetime(article.get("content_refreshed_at"))
    article["read_at"] = _format_datetime(article.get("read_at"))
    article["processed_at"] = _format_datetime(article.get("processed_at"))
    article["last_opened_at"] = _format_datetime(article.get("last_opened_at"))
    article["source_name"] = article.get("source_name") or source_map.get(article["source_id"], "未知来源")
    article["tags"] = article.get("tags") if isinstance(article.get("tags"), list) else []
    article["is_read"] = article.get("read_at") is not None
    article["is_processed"] = article.get("processed_at") is not None
    return article


@router.get("", response_model=ArticleListResponse)
async def list_articles(
    q: Optional[str] = Query(None, description="按标题、正文、摘要、作者或链接搜索"),
    source_id: Optional[int] = Query(None, description="按新闻源筛选"),
    published_from: Optional[str] = Query(None, description="发布时间起点，支持 YYYY-MM-DD 或 ISO datetime"),
    published_to: Optional[str] = Query(None, description="发布时间终点，日期值按整天包含处理"),
    tag: Optional[str] = Query(None, description="按锚点标签筛选"),
    status: Optional[str] = Query(None, description="按阅读状态筛选：unread/read/unprocessed/processed"),
    content_status: Optional[str] = Query(None, description="按正文刷新状态筛选"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """获取文章列表"""
    parsed_published_from = _parse_datetime_query(published_from)
    parsed_published_to = _parse_datetime_query(published_to, end_date_exclusive=True)
    filter_args = {
        "source_id": source_id,
        "q": q,
        "tag": tag,
        "status": status,
        "content_status": content_status,
        "published_from": parsed_published_from,
        "published_to": parsed_published_to,
    }

    articles = await get_articles(**filter_args, limit=limit, offset=offset)
    total = await count_articles(**filter_args)
    source_map = {}
    if articles:
        sources = await get_all_sources()
        source_map = {s["id"]: s["name"] for s in sources}

    enriched_articles = []
    for article in articles:
        enriched = await enrich_article_with_source(article, source_map)
        enriched_articles.append(enriched)

    return ArticleListResponse(
        items=enriched_articles,
        total=total,
        limit=limit,
        offset=offset
    )


@router.get("/{article_id}", response_model=ArticleResponse)
async def get_article(article_id: int):
    """获取文章详情"""
    article = await get_article_by_id(article_id)
    if not article:
        raise HTTPException(status_code=404, detail="文章不存在")

    enriched = await enrich_article_with_source(article)
    return enriched


@router.patch("/{article_id}/state", response_model=ArticleStateResponse)
async def update_article_state(article_id: int, body: ArticleStateUpdateRequest):
    """更新搜索 / 筛选结果中的文章阅读状态"""
    payload = await update_article_workbench_state_by_article_id(
        article_id=article_id,
        mark_read=body.mark_read,
        mark_processed=body.mark_processed,
    )
    if not payload:
        raise HTTPException(status_code=404, detail="文章不存在")

    return _format_article_state(payload)


@router.post("/{article_id}/summarize")
async def summarize_article(article_id: int):
    """手动触发 AI 总结"""
    article = await get_article_by_id(article_id)
    if not article:
        raise HTTPException(status_code=404, detail="文章不存在")

    summary = await summarize_text(article["title"], article["content"])
    await update_article_summary(article_id, summary)

    return {"success": True, "summary": summary}
