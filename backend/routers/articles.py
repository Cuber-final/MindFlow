from fastapi import APIRouter, HTTPException, Query
from schemas import ArticleResponse, ArticleListResponse
from database import get_articles, get_article_by_id, update_article_summary, get_all_sources
from services.ai import summarize_text
import json

router = APIRouter(prefix="/api/articles", tags=["文章管理"])


def _format_datetime(value):
    if value is None:
        return None
    if isinstance(value, str):
        return value
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


async def enrich_article_with_source(article: dict) -> dict:
    """Add source name to article"""
    sources = await get_all_sources()
    source_map = {s["id"]: s["name"] for s in sources}
    article["published_at"] = _format_datetime(article.get("published_at"))
    article["fetched_at"] = _format_datetime(article.get("fetched_at"))
    article["content_refresh_requested_at"] = _format_datetime(article.get("content_refresh_requested_at"))
    article["content_refresh_checked_at"] = _format_datetime(article.get("content_refresh_checked_at"))
    article["content_refreshed_at"] = _format_datetime(article.get("content_refreshed_at"))
    article["source_name"] = source_map.get(article["source_id"], "未知来源")
    return article


@router.get("", response_model=ArticleListResponse)
async def list_articles(
    source_id: int = Query(None, description="按新闻源筛选"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """获取文章列表"""
    articles = await get_articles(source_id=source_id, limit=limit, offset=offset)
    total = len(articles)

    enriched_articles = []
    for article in articles:
        enriched = await enrich_article_with_source(article)
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


@router.post("/{article_id}/summarize")
async def summarize_article(article_id: int):
    """手动触发 AI 总结"""
    article = await get_article_by_id(article_id)
    if not article:
        raise HTTPException(status_code=404, detail="文章不存在")

    summary = await summarize_text(article["title"], article["content"])
    await update_article_summary(article_id, summary)

    return {"success": True, "summary": summary}
