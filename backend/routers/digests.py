from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from datetime import date, datetime

from schemas import (
    DailyDigestResponse,
    DigestListResponse,
    DigestGenerateRequest,
    AnchorPointResponse
)
from database import (
    get_digest_by_date,
    get_latest_digest,
    get_digests,
    get_digests_count,
    get_anchors,
    get_all_anchors_for_digest,
    create_digest,
    create_anchor,
    get_article_by_id,
)
from services.ai import extract_anchor, synthesize_digest


router = APIRouter(prefix="/api/digests", tags=["digests"])


@router.get("", response_model=DigestListResponse)
async def list_digests(
    limit: int = Query(default=30, ge=1, le=90),
    offset: int = Query(default=0, ge=0),
    week_start: Optional[date] = None,
    week_end: Optional[date] = None
):
    """获取简报列表"""
    if week_start and week_end and week_start > week_end:
        raise HTTPException(status_code=400, detail="week_start 不能晚于 week_end")

    digests = await get_digests(
        limit=limit,
        offset=offset,
        week_start=week_start,
        week_end=week_end
    )
    total = await get_digests_count(week_start=week_start, week_end=week_end)
    items = [_format_digest_response(d) for d in digests]
    has_more = offset + len(items) < total
    next_offset = offset + len(items) if has_more else None

    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset,
        "has_more": has_more,
        "next_offset": next_offset,
        "week_start": week_start.isoformat() if week_start else None,
        "week_end": week_end.isoformat() if week_end else None,
    }


@router.get("/latest", response_model=Optional[DailyDigestResponse])
async def get_latest():
    """获取最新一份简报"""
    digest = await get_latest_digest()
    if not digest:
        raise HTTPException(status_code=404, detail="暂无简报")
    return _format_digest_response(digest)


@router.get("/{date_str}", response_model=Optional[DailyDigestResponse])
async def get_digest_by_date_endpoint(date_str: str):
    """获取指定日期简报"""
    digest = await get_digest_by_date(date_str)
    if not digest:
        raise HTTPException(status_code=404, detail=f"找不到 {date_str} 的简报")
    return _format_digest_response(digest)


@router.post("/generate")
async def generate_digest(req: DigestGenerateRequest):
    """手动触发简报生成"""
    target_date = req.target_date or date.today()
    date_str = target_date.isoformat()

    # Check if digest already exists
    existing = await get_digest_by_date(date_str)
    if existing and not req.force_regenerate:
        return {
            "success": True,
            "message": f"{date_str} 简报已存在",
            "digest_id": existing["id"]
        }

    # Get all recent anchors
    anchors = await get_all_anchors_for_digest()

    if not anchors:
        return {
            "success": False,
            "message": "暂无锚点数据，请先抓取文章并提取锚点"
        }

    # Synthesize digest using AI
    digest_data = await synthesize_digest(anchors)

    # Calculate total articles processed
    article_ids = set(a["article_id"] for a in anchors)
    total_articles = len(article_ids)

    # Create digest in database
    digest_id = await create_digest(
        date_str=date_str,
        title=f"{date_str} 今日资讯",
        overview=digest_data.get("overview", ""),
        sections=digest_data.get("sections", []),
        total_articles=total_articles,
        anchor_count=len(anchors)
    )

    return {
        "success": True,
        "message": f"简报生成成功",
        "digest_id": digest_id,
        "overview": digest_data.get("overview", ""),
        "sections_count": len(digest_data.get("sections", []))
    }


@router.get("/anchors/recent", response_model=list[AnchorPointResponse])
async def list_recent_anchors(limit: int = 50):
    """获取最近的锚点列表"""
    anchors = await get_anchors(limit=limit)
    return [_format_anchor_response(a) for a in anchors]


@router.post("/anchors/extract/{article_id}")
async def extract_anchors_from_article(article_id: int):
    """从指定文章提取锚点"""
    article = await get_article_by_id(article_id)
    if not article:
        raise HTTPException(status_code=404, detail="文章不存在")

    # Extract anchor using AI
    anchor_data = await extract_anchor(
        title=article["title"],
        content=article.get("content", "") or article.get("summary", ""),
        article_link=article.get("link", ""),
        source_name=article.get("source_name", "")
    )

    # Save to database
    anchor_id = await create_anchor(
        article_id=article_id,
        title=anchor_data["title"],
        content=anchor_data["content"],
        dialectical_analysis=anchor_data["dialectical_analysis"],
        anchor_type=anchor_data.get("anchor_type", "opinion"),
        significance=anchor_data.get("significance", 0.5),
        source_article_title=anchor_data.get("source_article_title", article["title"]),
        source_article_link=anchor_data.get("source_article_link", article.get("link", "")),
        source_name=anchor_data.get("source_name", article.get("source_name", "")),
        tags=anchor_data.get("tags", []),
        related_tag_weights=anchor_data.get("related_tag_weights", {})
    )

    return {
        "success": True,
        "anchor_id": anchor_id,
        "title": anchor_data["title"]
    }


def _format_digest_response(digest: dict) -> dict:
    """Format digest for API response"""
    raw_date = digest["date"]
    raw_created_at = digest.get("created_at")
    return {
        "id": digest["id"],
        "date": raw_date.isoformat() if hasattr(raw_date, "isoformat") else str(raw_date),
        "title": digest["title"],
        "overview": digest.get("overview", ""),
        "sections": digest.get("sections", []),
        "total_articles_processed": digest.get("total_articles_processed", 0),
        "anchor_count": digest.get("anchor_count", 0),
        "created_at": (
            raw_created_at.isoformat()
            if hasattr(raw_created_at, "isoformat")
            else raw_created_at
        ),
    }


def _format_anchor_response(anchor: dict) -> dict:
    """Format anchor for API response"""
    return {
        "id": anchor["id"],
        "article_id": anchor["article_id"],
        "title": anchor["title"],
        "content": anchor["content"],
        "dialectical_analysis": anchor.get("dialectical_analysis", ""),
        "anchor_type": anchor.get("anchor_type", "opinion"),
        "significance": anchor.get("significance", 0.5),
        "source_article_title": anchor.get("source_article_title", ""),
        "source_article_link": anchor.get("source_article_link", ""),
        "source_name": anchor.get("source_name", ""),
        "tags": anchor.get("tags", []),
        "related_tag_weights": anchor.get("related_tag_weights", {}),
        "created_at": anchor.get("created_at")
    }
