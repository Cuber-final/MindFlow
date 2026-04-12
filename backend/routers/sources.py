from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from schemas import NewsSourceCreate, NewsSourceUpdate, NewsSourceResponse, FetchResponse
from database import (
    get_all_sources, get_source_by_id, create_source,
    update_source, delete_source, add_fetch_log
)
from services.crawler import fetch_source_articles, search_account_by_url, get_author_info
import json


class ParseUrlRequest(BaseModel):
    url: str


class ParseUrlResponse(BaseModel):
    fakeid: str
    nickname: str
    alias: str = ""
    is_verify: int = 0
    verify_info: str = ""
    signature: str = ""
    avatar: str = ""

router = APIRouter(prefix="/api/sources", tags=["新闻源管理"])


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
    if result.get("config") and isinstance(result["config"], str):
        try:
            result["config"] = json.loads(result["config"])
        except json.JSONDecodeError:
            result["config"] = {}
    result["created_at"] = _format_datetime(result.get("created_at"))
    result["updated_at"] = _format_datetime(result.get("updated_at"))
    result["last_fetch_at"] = _format_datetime(result.get("last_fetch_at"))
    return result


@router.get("", response_model=list[NewsSourceResponse])
async def list_sources():
    """获取所有新闻源"""
    sources = await get_all_sources()
    return [_source_to_response(s) for s in sources]


@router.post("/parse-url", response_model=ParseUrlResponse)
async def parse_article_url(request: ParseUrlRequest):
    """
    通过文章链接解析公众号信息
    用户提供微信公众号文章链接，后端自动获取该公众号的 fakeid 和基本信息
    """
    try:
        # 调用 accountbyurl 接口获取公众号信息
        accounts = await search_account_by_url(request.url)

        if not accounts:
            raise HTTPException(status_code=404, detail="未找到该文章对应的公众号")

        account = accounts[0]
        fakeid = account.get("fakeid", "")

        if not fakeid:
            raise HTTPException(status_code=400, detail="无法获取公众号 fakeid")

        # 获取更详细的主体信息
        author_info = {}
        try:
            author_info = await get_author_info(fakeid)
        except Exception:
            pass

        return ParseUrlResponse(
            fakeid=fakeid,
            nickname=account.get("nickname", ""),
            alias=account.get("alias", ""),
            is_verify=account.get("verify_status", 0),
            verify_info=author_info.get("identity_name", ""),
            signature=account.get("signature", ""),
            avatar=account.get("avatar", "")
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"解析失败: {str(e)}")


@router.post("", response_model=NewsSourceResponse)
async def add_source(source: NewsSourceCreate):
    """添加新闻源"""
    source_id = await create_source(
        name=source.name,
        source_type=source.source_type,
        api_base_url=source.api_base_url,
        auth_key=source.auth_key,
        config=source.config
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
