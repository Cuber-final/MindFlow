from fastapi import APIRouter, HTTPException
from schemas import (
    AIConfigUpdate,
    AIConfigResponse,
    AIConfigSaveResponse,
    AIConfigTestRequest,
    AIConfigTestResponse,
)
from database import get_ai_config, update_ai_config
from services.ai import test_ai_connection
from services.scheduler import get_jobs, update_schedule
from typing import Optional, Tuple

router = APIRouter(prefix="/api/config", tags=["系统配置"])

DEFAULT_PROVIDER = "siliconflow"
DEFAULT_BASE_URL = "https://api.siliconflow.cn/v1"
DEFAULT_MODEL = "Qwen/Qwen2.5-7B-Instruct"


def _format_updated_at(value) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, str):
        return value
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def _resolve_api_key(
    draft_api_key: Optional[str],
    stored_config: Optional[dict],
    allow_stored_fallback: bool = True
) -> Tuple[Optional[str], bool]:
    normalized = (draft_api_key or "").strip()
    if normalized:
        return normalized, False

    if allow_stored_fallback and stored_config and stored_config.get("api_key"):
        return stored_config["api_key"], True

    return None, False


def _resolve_draft_value(
    draft_value: Optional[str],
    stored_value: Optional[str],
    default_value: str,
) -> str:
    normalized = (draft_value or "").strip()
    if normalized:
        return normalized
    if stored_value:
        return stored_value
    return default_value


@router.get("/ai", response_model=AIConfigResponse)
async def get_ai():
    """获取 AI 配置"""
    config = await get_ai_config()
    if not config:
        return AIConfigResponse(
            provider=DEFAULT_PROVIDER,
            base_url=DEFAULT_BASE_URL,
            model=DEFAULT_MODEL,
            has_api_key=False,
            updated_at=None
        )
    return AIConfigResponse(
        provider=config.get("provider", DEFAULT_PROVIDER),
        base_url=config.get("base_url", DEFAULT_BASE_URL),
        model=config.get("model", DEFAULT_MODEL),
        has_api_key=bool(config.get("api_key")),
        updated_at=_format_updated_at(config.get("updated_at"))
    )


@router.put("/ai", response_model=AIConfigSaveResponse)
async def save_ai_config(config: AIConfigUpdate):
    """更新 AI 配置"""
    existing = await get_ai_config()
    resolved_api_key, _ = _resolve_api_key(
        draft_api_key=config.api_key,
        stored_config=existing,
        allow_stored_fallback=config.keep_existing_api_key
    )

    if not resolved_api_key:
        raise HTTPException(status_code=400, detail="首次配置必须填写 API Key")

    draft = {
        "provider": config.provider,
        "api_key": resolved_api_key,
        "base_url": config.base_url,
        "model": config.model,
    }

    success, message = await test_ai_connection(draft)
    if not success:
        raise HTTPException(status_code=400, detail=f"保存前验证失败：{message}")

    await update_ai_config(
        provider=config.provider,
        base_url=config.base_url,
        model=config.model,
        api_key=resolved_api_key,
        keep_existing_api_key=False
    )

    return {"success": True, "message": "AI 配置已更新并验证通过"}


@router.post("/ai/test", response_model=AIConfigTestResponse)
async def test_ai(body: Optional[AIConfigTestRequest] = None):
    """测试 AI 连接（默认测试当前草稿配置）"""
    existing = await get_ai_config()
    draft_body = body or AIConfigTestRequest()
    resolved_api_key, used_stored_key = _resolve_api_key(
        draft_api_key=draft_body.api_key,
        stored_config=existing,
        allow_stored_fallback=draft_body.use_stored_api_key
    )

    if not resolved_api_key:
        return AIConfigTestResponse(success=False, message="API Key 未配置")

    draft = {
        "provider": _resolve_draft_value(
            draft_body.provider,
            existing.get("provider") if existing else None,
            DEFAULT_PROVIDER,
        ),
        "api_key": resolved_api_key,
        "base_url": _resolve_draft_value(
            draft_body.base_url,
            existing.get("base_url") if existing else None,
            DEFAULT_BASE_URL,
        ),
        "model": _resolve_draft_value(
            draft_body.model,
            existing.get("model") if existing else None,
            DEFAULT_MODEL,
        ),
    }

    success, message = await test_ai_connection(draft)
    return AIConfigTestResponse(
        success=success,
        message=message,
        used_stored_api_key=used_stored_key,
    )


@router.get("/schedule")
async def get_schedule():
    """获取定时任务配置"""
    jobs = get_jobs()
    return {"jobs": jobs}


@router.put("/schedule")
async def save_schedule(hours: list[int]):
    """更新定时任务配置"""
    if not hours:
        return {"success": False, "message": "请提供小时列表"}
    update_schedule(hours)
    return {"success": True, "message": f"定时任务已更新为每天 {hours} 点"}
