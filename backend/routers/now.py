from fastapi import APIRouter, HTTPException, Query

from schemas import (
    NowDetailResponse,
    NowListResponse,
    NowStateResponse,
    NowStateUpdateRequest,
)
from services.now import (
    get_now_detail_payload,
    list_now_items_payload,
    update_now_state_payload,
)

router = APIRouter(prefix="/api/now", tags=["now"])


@router.get("", response_model=NowListResponse, response_model_exclude_unset=True)
async def list_now_items(limit: int = Query(default=20, ge=1, le=60)):
    return await list_now_items_payload(limit=limit)


@router.get("/{anchor_id}", response_model=NowDetailResponse, response_model_exclude_unset=True)
async def get_now_detail(anchor_id: int):
    payload = await get_now_detail_payload(anchor_id=anchor_id)
    if not payload:
        raise HTTPException(status_code=404, detail="Now item not found")
    return payload


@router.patch(
    "/{anchor_id}/state",
    response_model=NowStateResponse,
    response_model_exclude_unset=True,
)
async def update_now_state(anchor_id: int, body: NowStateUpdateRequest):
    payload = await update_now_state_payload(
        anchor_id=anchor_id,
        mark_read=body.mark_read,
        mark_processed=body.mark_processed,
    )
    if not payload:
        raise HTTPException(status_code=404, detail="Now item not found")
    return payload
