from fastapi import APIRouter
from schemas import AIConfigUpdate, AIConfigResponse
from database import get_ai_config, update_ai_config
from services.ai import test_ai_connection
from services.scheduler import get_jobs, update_schedule

router = APIRouter(prefix="/api/config", tags=["系统配置"])


@router.get("/ai", response_model=AIConfigResponse)
async def get_ai():
    """获取 AI 配置"""
    config = await get_ai_config()
    if not config:
        return AIConfigResponse(
            provider="siliconflow",
            base_url="https://api.siliconflow.cn/v1",
            model="Qwen/Qwen2.5-7B-Instruct",
            updated_at=None
        )
    return AIConfigResponse(
        provider=config["provider"],
        base_url=config["base_url"],
        model=config["model"],
        updated_at=config.get("updated_at")
    )


@router.put("/ai")
async def save_ai_config(config: AIConfigUpdate):
    """更新 AI 配置"""
    await update_ai_config(
        provider=config.provider,
        api_key=config.api_key,
        base_url=config.base_url,
        model=config.model
    )
    return {"success": True, "message": "AI 配置已更新"}


@router.post("/ai/test")
async def test_ai():
    """测试 AI 连接"""
    success, message = await test_ai_connection()
    return {"success": success, "message": message}


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
