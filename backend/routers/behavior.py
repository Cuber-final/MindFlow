"""
Behavior Log Router

Behavior feedback and log endpoints for Phase B
"""

from fastapi import APIRouter, HTTPException
from typing import Optional

from schemas import (
    BehaviorLogCreate,
    BehaviorLogBatchCreate,
    DigestFeedbackCreate,
)
from database import (
    create_behavior_log,
    create_behavior_logs_batch,
    create_digest_feedback,
    get_behavior_logs,
    get_digest_feedback,
    get_anchor_by_id,
    get_interest_tag_by_name,
    update_interest_tag,
)
from services.learning import update_tag_weight, get_content_zone

router = APIRouter(prefix="/api/behavior", tags=["behavior"])


@router.post("/logs", status_code=201)
async def create_log(body: BehaviorLogCreate):
    """Record a single behavior log and update tag weight"""
    # Verify anchor exists
    anchor = await get_anchor_by_id(body.anchor_id)
    if not anchor:
        raise HTTPException(status_code=404, detail="Anchor not found")

    # Create behavior log
    log_id = await create_behavior_log(
        digest_id=body.digest_id,
        anchor_id=body.anchor_id,
        tag=body.tag,
        signal_type=body.signal_type.value,
        action=body.action.value,
        value=body.value,
    )

    # Update tag stats and weight
    tag_data = await get_interest_tag_by_name(body.tag)
    if tag_data:
        update_fields = {}
        action = body.action.value

        if action == "show":
            update_fields["show_count"] = tag_data.get("show_count", 0) + 1
        elif action == "hide":
            update_fields["hide_count"] = tag_data.get("hide_count", 0) + 1
        elif action == "click":
            update_fields["click_count"] = tag_data.get("click_count", 0) + 1
        elif action.startswith("dwell"):
            update_fields["total_time_spent"] = tag_data.get("total_time_spent", 0.0) + body.value

        if update_fields:
            await update_interest_tag(tag_data["id"], **update_fields)

        # Recalculate weight based on signals
        signals = await get_behavior_logs(anchor_id=body.anchor_id, limit=100)
        tag_signals = [s for s in signals if s.get("tag") == body.tag]
        if tag_signals:
            new_weight = update_tag_weight(
                tag_data.get("weight", 1.0),
                tag_signals,
                is_new_discovery=False
            )
            await update_interest_tag(tag_data["id"], weight=new_weight)

    return {"id": log_id, "status": "recorded"}


@router.post("/logs/batch", status_code=201)
async def create_logs_batch(body: BehaviorLogBatchCreate):
    """Batch record behavior logs"""
    count = await create_behavior_logs_batch([log.model_dump() for log in body.logs])
    return {"count": count, "status": "recorded"}


@router.get("/logs", response_model=list[dict])
async def list_logs(
    digest_id: Optional[int] = None,
    anchor_id: Optional[int] = None,
    limit: int = 100
):
    """Get behavior logs with optional filtering"""
    return await get_behavior_logs(digest_id=digest_id, anchor_id=anchor_id, limit=limit)


@router.post("/feedback", status_code=201)
async def create_feedback(body: DigestFeedbackCreate):
    """Record digest-level feedback (show/hide on an anchor)"""
    # Verify anchor exists
    anchor = await get_anchor_by_id(body.anchor_id)
    if not anchor:
        raise HTTPException(status_code=404, detail="Anchor not found")

    feedback_id = await create_digest_feedback(
        digest_id=body.digest_id,
        anchor_id=body.anchor_id,
        action=body.action.value,
    )

    return {"id": feedback_id, "status": "recorded"}


@router.get("/feedback/{digest_id}", response_model=list[dict])
async def list_feedback(digest_id: int):
    """Get all feedback for a digest"""
    return await get_digest_feedback(digest_id)
