from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date
from enum import Enum


class AnchorType(str, Enum):
    BREAKTHROUGH = "breakthrough"
    CONTROVERSY = "controversy"
    DATA = "data"
    OPINION = "opinion"


class ZoneType(str, Enum):
    MAIN = "main"
    EXPLORE = "explore"
    SURPRISE = "surprise"


# News Source Models
class NewsSourceCreate(BaseModel):
    name: str
    source_type: str = "custom"
    api_base_url: str
    auth_key: str = ""
    config: dict = {}


class NewsSourceUpdate(BaseModel):
    name: Optional[str] = None
    source_type: Optional[str] = None
    api_base_url: Optional[str] = None
    auth_key: Optional[str] = None
    config: Optional[dict] = None


class NewsSourceResponse(BaseModel):
    id: int
    name: str
    source_type: str
    api_base_url: str
    auth_key: str
    config: dict
    created_at: Optional[str]
    updated_at: Optional[str]
    last_fetch_at: Optional[str]
    article_count: int


# Article Models
class ArticleResponse(BaseModel):
    id: int
    source_id: int
    external_id: str
    title: str
    link: str
    content: str
    summary: str
    author: str
    published_at: Optional[str]
    fetched_at: str
    source_name: Optional[str] = None


class ArticleListResponse(BaseModel):
    items: list[ArticleResponse]
    total: int
    limit: int
    offset: int


# AI Config Models
class AIConfigUpdate(BaseModel):
    provider: str
    api_key: str
    base_url: str
    model: str


class AIConfigResponse(BaseModel):
    provider: str
    base_url: str
    model: str
    updated_at: Optional[str]


# Fetch Response
class FetchResponse(BaseModel):
    success: bool
    message: str
    articles_added: int = 0


# Summarize Request
class SummarizeRequest(BaseModel):
    article_id: int


# === V2: Anchor Models ===

class AnchorPoint(BaseModel):
    """从文章中提取的关键洞察"""
    id: int
    article_id: int
    title: str
    content: str
    dialectical_analysis: str
    anchor_type: AnchorType
    significance: float
    source_article_title: str
    source_article_link: str
    source_name: str
    tags: list[str]
    related_tag_weights: dict[str, float]
    created_at: Optional[str] = None


class AnchorPointCreate(BaseModel):
    """创建锚点请求"""
    article_id: int
    title: str
    content: str
    dialectical_analysis: str
    anchor_type: AnchorType
    significance: float = 0.5
    tags: list[str] = []
    related_tag_weights: dict[str, float] = {}


class AnchorPointResponse(BaseModel):
    """锚点响应"""
    id: int
    article_id: int
    title: str
    content: str
    dialectical_analysis: str
    anchor_type: str
    significance: float
    source_article_title: str
    source_article_link: str
    source_name: str
    tags: list[str]
    related_tag_weights: dict[str, float]
    created_at: Optional[str] = None


# === V2: Digest Models ===

class InsightRef(BaseModel):
    """简报中的洞察引用"""
    anchor_id: int
    title: str
    content: str
    dialectical_analysis: str
    source_article_link: str
    source_name: str
    tags: list[str]
    zone: ZoneType


class DigestSection(BaseModel):
    """简报分组"""
    domain: str
    domain_icon: str
    insights: list[InsightRef]


class DailyDigest(BaseModel):
    """每日资讯简报"""
    id: int
    date: date
    title: str
    overview: str
    sections: list[DigestSection]
    total_articles_processed: int
    anchor_count: int
    created_at: Optional[str] = None


class DailyDigestResponse(BaseModel):
    """简报响应"""
    id: int
    date: str
    title: str
    overview: str
    sections: list[DigestSection]
    total_articles_processed: int
    anchor_count: int
    created_at: Optional[str] = None


class DigestGenerateRequest(BaseModel):
    """手动触发简报生成请求"""
    target_date: Optional[date] = None
    force_regenerate: bool = False


# === V2: Interest Tag Models ===

class TagStatus(str, Enum):
    ACTIVE = "active"
    FROZEN = "frozen"
    CANDIDATE = "candidate"


class SignalType(str, Enum):
    EXPLICIT = "explicit"
    IMPLICIT = "implicit"


class UserInterestTag(BaseModel):
    """用户兴趣标签"""
    id: int
    tag: str
    weight: float
    status: TagStatus
    view_count: int
    show_count: int
    hide_count: int
    total_time_spent: float
    click_count: int
    last_updated: Optional[str] = None
    created_at: Optional[str] = None


class UserInterestTagCreate(BaseModel):
    """创建兴趣标签请求"""
    tag: str


class UserInterestTagUpdate(BaseModel):
    """更新兴趣标签请求"""
    weight: Optional[float] = None
    status: Optional[TagStatus] = None


class UserInterestTagResponse(BaseModel):
    """兴趣标签响应"""
    id: int
    tag: str
    weight: float
    status: str
    view_count: int
    show_count: int
    hide_count: int
    total_time_spent: float
    click_count: int
    last_updated: Optional[str] = None
    created_at: Optional[str] = None


class InterestStats(BaseModel):
    """兴趣统计"""
    total_tags: int
    active_tags: int
    frozen_tags: int
    candidate_tags: int


# === V2: Behavior Log Models ===

class BehaviorAction(str, Enum):
    SHOW = "show"
    HIDE = "hide"
    CLICK = "click"
    DWELL = "dwell"
    SCROLL = "scroll"
    REVISIT = "revisit"


class BehaviorLogCreate(BaseModel):
    """行为日志创建"""
    digest_id: Optional[int] = None
    anchor_id: int
    tag: str
    signal_type: SignalType
    action: BehaviorAction
    value: float = 0.0


class BehaviorLogBatchCreate(BaseModel):
    """批量行为日志创建"""
    logs: list[BehaviorLogCreate]


class DigestFeedbackCreate(BaseModel):
    """简报反馈创建"""
    digest_id: int
    anchor_id: int
    action: BehaviorAction
