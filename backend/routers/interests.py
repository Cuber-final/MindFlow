"""
Interest Tag Router

Interest tag CRUD and stats endpoints for Phase B
"""

from fastapi import APIRouter, HTTPException
from typing import Optional

from schemas import (
    UserInterestTagCreate,
    UserInterestTagUpdate,
    UserInterestTagResponse,
    InterestStats,
)
from database import (
    get_all_interest_tags,
    get_interest_tag_by_id,
    get_interest_tag_by_name,
    create_interest_tag,
    update_interest_tag,
    delete_interest_tag,
    get_interest_tag_stats,
)
from services.learning import get_content_zone, suggest_tag_candidates

router = APIRouter(prefix="/api/interests", tags=["interests"])


def _tag_to_response(tag_data: dict) -> UserInterestTagResponse:
    """Convert database tag dict to response model"""
    return UserInterestTagResponse(
        id=tag_data["id"],
        tag=tag_data["tag"],
        weight=tag_data.get("weight", 1.0),
        status=tag_data.get("status", "active"),
        view_count=tag_data.get("view_count", 0),
        show_count=tag_data.get("show_count", 0),
        hide_count=tag_data.get("hide_count", 0),
        total_time_spent=tag_data.get("total_time_spent", 0.0),
        click_count=tag_data.get("click_count", 0),
        last_updated=tag_data.get("last_updated"),
        created_at=tag_data.get("created_at"),
    )


@router.get("/tags", response_model=list[UserInterestTagResponse])
async def list_tags():
    """List all interest tags"""
    tags = await get_all_interest_tags()
    return [_tag_to_response(t) for t in tags]


@router.get("/tags/stats", response_model=InterestStats)
async def get_stats():
    """Get interest tag statistics"""
    stats = await get_interest_tag_stats()
    return InterestStats(
        total_tags=stats["total"],
        active_tags=stats["active"],
        frozen_tags=stats["frozen"],
        candidate_tags=stats["candidate"],
    )


@router.get("/tags/{tag}", response_model=UserInterestTagResponse)
async def get_tag(tag: str):
    """Get interest tag by name"""
    tag_data = await get_interest_tag_by_name(tag)
    if not tag_data:
        raise HTTPException(status_code=404, detail="Tag not found")
    return _tag_to_response(tag_data)


@router.post("/tags", response_model=UserInterestTagResponse, status_code=201)
async def create_tag(body: UserInterestTagCreate):
    """Create a new interest tag"""
    existing = await get_interest_tag_by_name(body.tag)
    if existing:
        raise HTTPException(status_code=400, detail="Tag already exists")

    tag_id = await create_interest_tag(body.tag)
    tag_data = await get_interest_tag_by_id(tag_id)
    return _tag_to_response(tag_data)


@router.patch("/tags/{tag_id}", response_model=UserInterestTagResponse)
async def update_tag(tag_id: int, body: UserInterestTagUpdate):
    """Update interest tag"""
    tag_data = await get_interest_tag_by_id(tag_id)
    if not tag_data:
        raise HTTPException(status_code=404, detail="Tag not found")

    update_fields = {}
    if body.weight is not None:
        update_fields["weight"] = body.weight
    if body.status is not None:
        update_fields["status"] = body.status.value

    if update_fields:
        await update_interest_tag(tag_id, **update_fields)

    tag_data = await get_interest_tag_by_id(tag_id)
    return _tag_to_response(tag_data)


@router.delete("/tags/{tag_id}", status_code=204)
async def delete_tag(tag_id: int):
    """Delete interest tag"""
    tag_data = await get_interest_tag_by_id(tag_id)
    if not tag_data:
        raise HTTPException(status_code=404, detail="Tag not found")

    await delete_interest_tag(tag_id)


@router.get("/tags/{tag}/zone")
async def get_tag_zone(tag: str):
    """Get content zone for a tag based on its weight"""
    tag_data = await get_interest_tag_by_name(tag)
    if not tag_data:
        raise HTTPException(status_code=404, detail="Tag not found")

    weight = tag_data.get("weight", 1.0)
    zone = get_content_zone(weight)
    return {"tag": tag, "weight": weight, "zone": zone}


@router.get("/candidates", response_model=list[dict])
async def get_candidates(top_n: int = 5):
    """Get suggested tag candidates from recent anchors"""
    return suggest_tag_candidates(top_n=top_n)
