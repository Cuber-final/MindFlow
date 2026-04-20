# MindFlow Daily Digest + Now Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把当前 `digest-first` MVP 演进成以 `Daily Digest + Now` 为双核心入口的私有化信息工作台，并让主链路稳定落到 `Daily Digest -> Detail -> Read Source`。

**Architecture:** 保留现有 `Source -> Article -> Anchor -> Digest` 数据链路，不重做抓取和 AI 生成；新增一个以 `anchor_id` 为入口、以 `article` 为阅读主体的 `Now` 工作台 API 与页面。为了保持 MVP 可落地，阅读状态直接落在 `articles` 表（单用户私有化前提），`Daily Digest` 保留显式兴趣纠偏，`Now / Detail` 只承接阅读、已读、已处理与跳原文动作。

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, PostgreSQL, React, TypeScript, React Router, TailwindCSS, React Markdown, Pytest

---

## Implementation Constraints

- 当前仓库没有前端自动化测试基建，且顶层 AGENTS.md 约束“未经明确请求不新增依赖”；因此本计划采用 **后端接口自动化测试 + 前端 `npm run build` + 浏览器 smoke checklist** 的组合验证，而不是在本轮引入新的前端测试库。
- `Daily Digest` 必须继续保留刊物感与显式兴趣纠偏；`Now / Detail` 禁止复用“减少这类话题内容”。
- `Now` 的排序必须稳定、可解释到工程层，但不需要对用户暴露公式 UI。
- 本轮不做收藏、归档、Backlog、Archive、复杂 explainability、多级批处理动作。

---

## File Structure

### Backend

- Modify: `backend/main.py` — 注册新的 `now` router。
- Modify: `backend/models.py` — 给 `Article` 增加 `read_at / processed_at / last_opened_at`，承接单用户工作台状态。
- Modify: `backend/schemas.py` — 增加 `NowListResponse / NowDetailResponse / NowStateUpdateRequest / NowStateResponse`。
- Modify: `backend/database.py` — 增加 `Now` 相关 join 查询与文章状态更新 helper。
- Create: `backend/services/now.py` — 组装队列、计算优先级、输出 detail payload。
- Create: `backend/routers/now.py` — 暴露 `GET /api/now`、`GET /api/now/{anchor_id}`、`PATCH /api/now/{anchor_id}/state`。
- Create: `backend/alembic/versions/20260420_01_add_article_workbench_state.py` — 新增 article 状态字段迁移。
- Create: `backend/tests/test_now_api.py` — 锁定新 API 契约与状态流。

### Frontend

- Modify: `frontend/src/App.tsx` — 新增 `/daily-digest`、`/now`、`/now/:anchorId`，并把 `/` 与 `/newsletter` 重定向到 `/daily-digest`。
- Modify: `frontend/src/api/newsletter.ts` — 增加 `Now` DTO 和 `nowApi`。
- Modify: `frontend/src/components/Sidebar.tsx` — 导航文案改为 `Daily Digest / Now / Interests / Sources / Settings`。
- Modify: `frontend/src/components/TopNav.tsx` — 同步顶导航文案。
- Modify: `frontend/src/components/MobileNav.tsx` — 同步移动端导航文案。
- Modify: `frontend/src/pages/Newsletter.tsx` — 把 Digest 卡片改成进入内部 Detail 的入口，保留 digest-only 负反馈，移除直达原文主出口。
- Create: `frontend/src/pages/Now.tsx` — `Now` 工作台页面，负责队列、详情、状态联动。
- Create: `frontend/src/components/now/NowContextRail.tsx` — 左栏上下文/状态摘要。
- Create: `frontend/src/components/now/NowQueueList.tsx` — 中栏优先级列表与展开/收起。
- Create: `frontend/src/components/now/NowDetailPane.tsx` — 右栏详情阅读、已读/已处理、Read Source。
- Modify: `README.md` — 更新产品定位、主路由与验证方式。

---

### Task 1: 先锁定 `Now` API 契约（红灯测试）

**Files:**
- Create: `backend/tests/test_now_api.py`

- [ ] **Step 1: 写出后端契约失败测试**

```python
import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    from main import app
    return TestClient(app)


def test_list_now_items_returns_priority_queue(client):
    mocked_items = [
        {
            "anchor_id": 101,
            "article_id": 301,
            "title": "AI agent memory is becoming product infrastructure",
            "excerpt": "Memory layers are moving from prompt glue to product primitives.",
            "source_name": "Latent Space",
            "source_article_link": "https://example.com/latent-space",
            "tags": ["agents", "memory"],
            "published_at": "2026-04-20T09:00:00",
            "significance": 0.91,
            "priority_score": 0.88,
            "priority_reason": "高显著性 + 高时效",
            "zone": "main",
            "is_read": False,
            "is_processed": False,
        },
        {
            "anchor_id": 102,
            "article_id": 302,
            "title": "AI infra is shifting back toward smaller models",
            "excerpt": "Cost pressure is changing deployment strategies for personal AI stacks.",
            "source_name": "The Batch",
            "source_article_link": "https://example.com/the-batch",
            "tags": ["agents", "inference"],
            "published_at": "2026-04-19T21:00:00",
            "significance": 0.73,
            "priority_score": 0.66,
            "priority_reason": "强兴趣匹配",
            "zone": "explore",
            "is_read": False,
            "is_processed": False,
        },
    ]

    with patch("routers.now.list_now_items_payload", new=AsyncMock(return_value=mocked_items)):
        response = client.get("/api/now?limit=2")

    assert response.status_code == 200
    data = response.json()
    assert data["items"][0]["anchor_id"] == 101
    assert data["items"][0]["priority_score"] >= data["items"][1]["priority_score"]
    assert data["items"][0]["priority_reason"] == "高显著性 + 高时效"


def test_get_now_detail_returns_summary_and_body(client):
    mocked_detail = {
        "anchor_id": 101,
        "article_id": 301,
        "title": "AI agent memory is becoming product infrastructure",
        "source_name": "Latent Space",
        "source_article_link": "https://example.com/latent-space",
        "tags": ["agents", "memory"],
        "published_at": "2026-04-20T09:00:00",
        "ai_summary": "Agent memory is shifting from a UX trick to a core product capability.",
        "dialectical_analysis": "Persistent memory improves usefulness but increases state-drift risk.",
        "body_markdown": "## Why it matters\n\nUsers now expect continuity across sessions.",
        "priority_score": 0.88,
        "priority_reason": "高显著性 + 高时效",
        "is_read": False,
        "is_processed": False,
        "read_at": None,
        "processed_at": None,
    }

    with patch("routers.now.get_now_detail_payload", new=AsyncMock(return_value=mocked_detail)):
        response = client.get("/api/now/101")

    assert response.status_code == 200
    data = response.json()
    assert data["anchor_id"] == 101
    assert data["ai_summary"]
    assert data["body_markdown"].startswith("## Why it matters")
    assert data["is_processed"] is False


def test_patch_now_state_marks_read_and_processed(client):
    mocked_state = {
        "anchor_id": 101,
        "article_id": 301,
        "is_read": True,
        "is_processed": True,
        "read_at": "2026-04-20T10:20:00",
        "processed_at": "2026-04-20T10:25:00",
    }

    with patch("routers.now.update_now_state_payload", new=AsyncMock(return_value=mocked_state)):
        response = client.patch(
            "/api/now/101/state",
            json={"mark_read": True, "mark_processed": True},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["anchor_id"] == 101
    assert data["is_read"] is True
    assert data["is_processed"] is True
    assert data["processed_at"] is not None
```

- [ ] **Step 2: 跑测试确认当前仓库还不支持 `Now`**

Run:
```bash
cd backend
source .venv/bin/activate
pytest tests/test_now_api.py -q
```

Expected: FAIL，至少出现一个 `404 Not Found` 或 `ModuleNotFoundError: No module named 'routers.now'`，证明契约尚未落地。

- [ ] **Step 3: 提交红灯测试**

```bash
git add backend/tests/test_now_api.py
git commit -F - <<'EOF'
Lock the Now workbench API contract before implementation

Add failing API tests for the queue, detail, and state-update flows
so backend and frontend can implement against one stable contract
instead of inventing payloads independently.

Constraint: Next-phase product spec requires a new Now surface but the repo has no existing route for it
Rejected: Start with frontend-only mocks | would hide backend contract drift until late integration
Confidence: high
Scope-risk: narrow
Directive: Keep the route shape stable once frontend implementation starts; change the tests first if the contract must move
Tested: pytest tests/test_now_api.py -q (expected red)
Not-tested: Runtime route implementation
EOF
```

---

### Task 2: 落地 `Now` 后端查询、排序与状态更新

**Files:**
- Modify: `backend/main.py`
- Modify: `backend/models.py`
- Modify: `backend/schemas.py`
- Modify: `backend/database.py`
- Create: `backend/services/now.py`
- Create: `backend/routers/now.py`
- Create: `backend/alembic/versions/20260420_01_add_article_workbench_state.py`

- [ ] **Step 1: 先写 Alembic 迁移，把工作台状态挂到 `articles`**

```python
"""add article workbench state"""

from alembic import op
import sqlalchemy as sa


revision = "20260420_01"
down_revision = "72af35b254e0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("articles", sa.Column("read_at", sa.DateTime(), nullable=True))
    op.add_column("articles", sa.Column("processed_at", sa.DateTime(), nullable=True))
    op.add_column("articles", sa.Column("last_opened_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("articles", "last_opened_at")
    op.drop_column("articles", "processed_at")
    op.drop_column("articles", "read_at")
```

- [ ] **Step 2: 更新 ORM 和 Pydantic 契约**

```python
# backend/models.py
class Article(Base):
    __tablename__ = "articles"
    id = Column(Integer, primary_key=True, autoincrement=True)
    source_id = Column(Integer, ForeignKey("news_sources.id", ondelete="CASCADE"))
    external_id = Column(String, default="")
    title = Column(String, nullable=False)
    link = Column(String, default="")
    content = Column(Text, default="")
    summary = Column(Text, default="")
    author = Column(String, default="")
    published_at = Column(DateTime)
    fetched_at = Column(DateTime, default=datetime.utcnow)
    read_at = Column(DateTime)
    processed_at = Column(DateTime)
    last_opened_at = Column(DateTime)
```

```python
# backend/schemas.py
class NowListItemResponse(BaseModel):
    anchor_id: int
    article_id: int
    title: str
    excerpt: str
    source_name: str
    source_article_link: str
    tags: list[str]
    published_at: Optional[str] = None
    significance: float
    priority_score: float
    priority_reason: str
    zone: str
    is_read: bool
    is_processed: bool


class NowListResponse(BaseModel):
    items: list[NowListItemResponse]
    generated_at: str


class NowDetailResponse(BaseModel):
    anchor_id: int
    article_id: int
    title: str
    source_name: str
    source_article_link: str
    tags: list[str]
    published_at: Optional[str] = None
    ai_summary: str
    dialectical_analysis: str
    body_markdown: str
    priority_score: float
    priority_reason: str
    is_read: bool
    is_processed: bool
    read_at: Optional[str] = None
    processed_at: Optional[str] = None


class NowStateUpdateRequest(BaseModel):
    mark_read: bool = False
    mark_processed: bool = False


class NowStateResponse(BaseModel):
    anchor_id: int
    article_id: int
    is_read: bool
    is_processed: bool
    read_at: Optional[str] = None
    processed_at: Optional[str] = None
```

- [ ] **Step 3: 在数据库层加 join 查询和状态更新 helper**

```python
# backend/database.py
from datetime import datetime, timedelta
from sqlalchemy import or_


async def get_recent_now_candidates(hours: int = 48, limit: int = 60) -> List[Dict[str, Any]]:
    cutoff = datetime.utcnow() - timedelta(hours=hours)
    async with get_db() as session:
        query = (
            select(
                AnchorPoint.id.label("anchor_id"),
                AnchorPoint.article_id.label("article_id"),
                AnchorPoint.title.label("anchor_title"),
                AnchorPoint.content.label("anchor_content"),
                AnchorPoint.dialectical_analysis.label("dialectical_analysis"),
                AnchorPoint.significance.label("significance"),
                AnchorPoint.tags.label("tags"),
                AnchorPoint.related_tag_weights.label("related_tag_weights"),
                Article.title.label("article_title"),
                Article.content.label("article_content"),
                Article.summary.label("article_summary"),
                Article.link.label("source_article_link"),
                Article.published_at.label("published_at"),
                Article.read_at.label("read_at"),
                Article.processed_at.label("processed_at"),
                NewsSource.name.label("source_name"),
            )
            .join(Article, Article.id == AnchorPoint.article_id)
            .join(NewsSource, NewsSource.id == Article.source_id)
            .where(or_(Article.published_at >= cutoff, Article.fetched_at >= cutoff))
            .order_by(Article.published_at.desc().nullslast(), AnchorPoint.significance.desc())
            .limit(limit)
        )
        result = await session.execute(query)
        return [dict(row._mapping) for row in result.all()]


async def get_now_detail_row(anchor_id: int) -> Optional[Dict[str, Any]]:
    async with get_db() as session:
        query = (
            select(
                AnchorPoint.id.label("anchor_id"),
                AnchorPoint.article_id.label("article_id"),
                AnchorPoint.title.label("anchor_title"),
                AnchorPoint.content.label("anchor_content"),
                AnchorPoint.dialectical_analysis.label("dialectical_analysis"),
                AnchorPoint.significance.label("significance"),
                AnchorPoint.tags.label("tags"),
                Article.title.label("article_title"),
                Article.content.label("article_content"),
                Article.summary.label("article_summary"),
                Article.link.label("source_article_link"),
                Article.published_at.label("published_at"),
                Article.read_at.label("read_at"),
                Article.processed_at.label("processed_at"),
                NewsSource.name.label("source_name"),
            )
            .join(Article, Article.id == AnchorPoint.article_id)
            .join(NewsSource, NewsSource.id == Article.source_id)
            .where(AnchorPoint.id == anchor_id)
        )
        result = await session.execute(query)
        row = result.first()
        return dict(row._mapping) if row else None


async def update_article_workbench_state_by_anchor(
    anchor_id: int,
    *,
    mark_read: bool = False,
    mark_processed: bool = False,
) -> Optional[Dict[str, Any]]:
    async with get_db() as session:
        result = await session.execute(
            select(Article, AnchorPoint.id.label("anchor_id"))
            .join(AnchorPoint, AnchorPoint.article_id == Article.id)
            .where(AnchorPoint.id == anchor_id)
        )
        row = result.first()
        if not row:
            return None

        article = row[0]
        now = datetime.utcnow()
        article.last_opened_at = now
        if mark_read and article.read_at is None:
            article.read_at = now
        if mark_processed:
            article.processed_at = now
            if article.read_at is None:
                article.read_at = now

        await session.flush()
        return {
            "anchor_id": anchor_id,
            "article_id": article.id,
            "is_read": article.read_at is not None,
            "is_processed": article.processed_at is not None,
            "read_at": article.read_at.isoformat() if article.read_at else None,
            "processed_at": article.processed_at.isoformat() if article.processed_at else None,
        }
```

- [ ] **Step 4: 用独立 service 固化排序，不把公式散落在 router**

```python
# backend/services/now.py
from datetime import datetime
from database import (
    get_all_interest_tags,
    get_behavior_logs,
    get_now_detail_row,
    get_recent_now_candidates,
    update_article_workbench_state_by_anchor,
)
from services.learning import get_content_zone


def _freshness_score(published_at) -> float:
    if not published_at:
        return 0.4
    if isinstance(published_at, str):
        published_at = datetime.fromisoformat(published_at)
    hours_old = max(0.0, (datetime.utcnow() - published_at.replace(tzinfo=None)).total_seconds() / 3600)
    if hours_old <= 6:
        return 1.0
    if hours_old <= 24:
        return 0.85
    if hours_old <= 48:
        return 0.6
    return 0.25


def _interest_score(tags: list[str], tag_lookup: dict[str, float]) -> float:
    if not tags:
        return 0.35
    matched = [tag_lookup.get(tag, 0.35) for tag in tags]
    return min(max(matched), 2.5) / 2.5


def _source_affinity(source_name: str, recent_logs: list[dict], anchor_source_map: dict[int, str]) -> float:
    positive = 0
    negative = 0
    for log in recent_logs:
        log_source = anchor_source_map.get(log.get("anchor_id"))
        if log_source != source_name:
            continue
        if log.get("action") in {"click", "show", "dwell"}:
            positive += 1
        if log.get("action") == "hide":
            negative += 1
    raw = 0.5 + positive * 0.08 - negative * 0.12
    return max(0.1, min(1.0, raw))


def _priority_reason(interest_score: float, freshness_score: float, significance: float) -> str:
    if significance >= 0.8 and freshness_score >= 0.85:
        return "高显著性 + 高时效"
    if interest_score >= 0.7:
        return "强兴趣匹配"
    return "近期仍值得处理"


async def list_now_items_payload(limit: int = 20) -> list[dict]:
    rows = await get_recent_now_candidates(limit=max(limit * 3, 20))
    tags = await get_all_interest_tags()
    logs = await get_behavior_logs(limit=500)
    tag_lookup = {tag["tag"]: tag.get("weight", 1.0) for tag in tags if tag.get("status") == "active"}
    anchor_source_map = {row["anchor_id"]: row["source_name"] for row in rows}

    items = []
    for row in rows:
        if row.get("processed_at"):
            continue
        interest = _interest_score(row.get("tags") or [], tag_lookup)
        freshness = _freshness_score(row.get("published_at"))
        source = _source_affinity(row.get("source_name", ""), logs, anchor_source_map)
        significance = float(row.get("significance") or 0.0)
        score = round(significance * 0.35 + interest * 0.30 + freshness * 0.20 + source * 0.15, 4)
        if row.get("read_at"):
            score = round(max(0.0, score - 0.15), 4)

        max_tag_weight = max([tag_lookup.get(tag, 1.0) for tag in row.get("tags") or []], default=1.0)
        items.append(
            {
                "anchor_id": row["anchor_id"],
                "article_id": row["article_id"],
                "title": row["anchor_title"],
                "excerpt": row["anchor_content"],
                "source_name": row["source_name"],
                "source_article_link": row["source_article_link"],
                "tags": row.get("tags") or [],
                "published_at": row["published_at"].isoformat() if row.get("published_at") else None,
                "significance": significance,
                "priority_score": score,
                "priority_reason": _priority_reason(interest, freshness, significance),
                "zone": get_content_zone(max_tag_weight),
                "is_read": row.get("read_at") is not None,
                "is_processed": False,
            }
        )

    items.sort(key=lambda item: item["priority_score"], reverse=True)
    return items[:limit]


async def get_now_detail_payload(anchor_id: int) -> dict | None:
    row = await get_now_detail_row(anchor_id)
    if not row:
        return None

    queue = await list_now_items_payload(limit=50)
    queue_item = next((item for item in queue if item["anchor_id"] == anchor_id), None)
    summary = (row.get("anchor_content") or row.get("article_summary") or "").strip()
    body = (row.get("article_content") or row.get("article_summary") or "").strip()

    return {
        "anchor_id": row["anchor_id"],
        "article_id": row["article_id"],
        "title": row.get("article_title") or row.get("anchor_title"),
        "source_name": row.get("source_name") or "未知来源",
        "source_article_link": row.get("source_article_link") or "",
        "tags": row.get("tags") or [],
        "published_at": row["published_at"].isoformat() if row.get("published_at") else None,
        "ai_summary": summary,
        "dialectical_analysis": row.get("dialectical_analysis") or "",
        "body_markdown": body,
        "priority_score": queue_item["priority_score"] if queue_item else 0.0,
        "priority_reason": queue_item["priority_reason"] if queue_item else "来自 Digest 入口",
        "is_read": row.get("read_at") is not None,
        "is_processed": row.get("processed_at") is not None,
        "read_at": row["read_at"].isoformat() if row.get("read_at") else None,
        "processed_at": row["processed_at"].isoformat() if row.get("processed_at") else None,
    }


async def update_now_state_payload(anchor_id: int, *, mark_read: bool, mark_processed: bool) -> dict | None:
    return await update_article_workbench_state_by_anchor(
        anchor_id,
        mark_read=mark_read,
        mark_processed=mark_processed,
    )
```

- [ ] **Step 5: 新建 router，并接入 `main.py`**

```python
# backend/routers/now.py
from datetime import datetime
from fastapi import APIRouter, HTTPException, Query
from schemas import NowDetailResponse, NowListResponse, NowStateResponse, NowStateUpdateRequest
from services.now import get_now_detail_payload, list_now_items_payload, update_now_state_payload


router = APIRouter(prefix="/api/now", tags=["now"])


@router.get("", response_model=NowListResponse)
async def list_now_items(limit: int = Query(default=20, ge=1, le=50)):
    items = await list_now_items_payload(limit=limit)
    return {
        "items": items,
        "generated_at": datetime.utcnow().isoformat(),
    }


@router.get("/{anchor_id}", response_model=NowDetailResponse)
async def get_now_detail(anchor_id: int):
    payload = await get_now_detail_payload(anchor_id)
    if not payload:
        raise HTTPException(status_code=404, detail="Now item not found")
    return payload


@router.patch("/{anchor_id}/state", response_model=NowStateResponse)
async def update_now_state(anchor_id: int, body: NowStateUpdateRequest):
    payload = await update_now_state_payload(
        anchor_id,
        mark_read=body.mark_read,
        mark_processed=body.mark_processed,
    )
    if not payload:
        raise HTTPException(status_code=404, detail="Now item not found")
    return payload
```

```python
# backend/main.py
from routers import sources, articles, config, digests, interests, behavior, now

app.include_router(now.router)
```

- [ ] **Step 6: 跑迁移并让红灯测试转绿**

Run:
```bash
cd backend
source .venv/bin/activate
alembic upgrade head
pytest tests/test_now_api.py tests/test_articles.py tests/test_digests.py -q
```

Expected: PASS；`tests/test_now_api.py` 全绿，且既有文章/简报接口测试没有被 `Article` 字段扩展破坏。

- [ ] **Step 7: 提交后端实现**

```bash
git add backend/main.py backend/models.py backend/schemas.py backend/database.py backend/services/now.py backend/routers/now.py backend/alembic/versions/20260420_01_add_article_workbench_state.py
git commit -F - <<'EOF'
Create a real Now backend so Daily Digest can hand off to detail reading

Add article workbench state, ranked queue assembly, detail payloads,
and idempotent read/processed mutations. The implementation keeps the
existing source-article-anchor-digest pipeline and only adds the minimum
state needed for a single-user private workbench.

Constraint: Must reuse the current data chain instead of introducing a parallel content pipeline
Constraint: Next-phase MVP needs stable ranking without exposing a formula editor
Rejected: Store read state on anchors | duplicate anchors from the same article would reappear as unfinished work
Rejected: Separate user_article_state table | extra joins without any current multi-user requirement
Confidence: medium
Scope-risk: moderate
Directive: If accounts are introduced later, move workbench state out of articles before shipping shared-user access
Tested: alembic upgrade head; pytest tests/test_now_api.py tests/test_articles.py tests/test_digests.py -q
Not-tested: Production-size queue performance over thousands of anchors
EOF
```

---

### Task 3: 切换前端路由语义，把双核心入口放进导航壳层

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Sidebar.tsx`
- Modify: `frontend/src/components/TopNav.tsx`
- Modify: `frontend/src/components/MobileNav.tsx`
- Create: `frontend/src/pages/Now.tsx`

- [ ] **Step 1: 更新主路由，保留旧 `/newsletter` 兼容跳转**

```tsx
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import TopNav from './components/TopNav';
import MobileNav from './components/MobileNav';
import Sources from './pages/Sources';
import Settings from './pages/Settings';
import Newsletter from './pages/Newsletter';
import InterestSettings from './pages/InterestSettings';
import Now from './pages/Now';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <div className="lg:ml-64">
          <TopNav />
          <main className="max-w-screen-2xl mx-auto w-full px-8 py-12">
            <Routes>
              <Route path="/" element={<Navigate to="/daily-digest" replace />} />
              <Route path="/newsletter" element={<Navigate to="/daily-digest" replace />} />
              <Route path="/daily-digest" element={<Newsletter />} />
              <Route path="/now" element={<Now />} />
              <Route path="/now/:anchorId" element={<Now />} />
              <Route path="/interests" element={<InterestSettings />} />
              <Route path="/sources" element={<Sources />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>
        <MobileNav />
      </div>
    </BrowserRouter>
  );
}
```

- [ ] **Step 2: 把导航文案改成产品定义里的双核心**

```tsx
// frontend/src/components/Sidebar.tsx
const navItems = [
  { path: '/daily-digest', label: 'Daily Digest', icon: 'auto_awesome' },
  { path: '/now', label: 'Now', icon: 'dashboard_customize' },
  { path: '/interests', label: 'Interests', icon: 'label_important' },
  { path: '/sources', label: 'Sources', icon: 'rss_feed' },
  { path: '/settings', label: 'Settings', icon: 'settings_suggest' },
];
```

```tsx
// frontend/src/components/TopNav.tsx
const navItems = [
  { path: '/daily-digest', label: 'Daily Digest' },
  { path: '/now', label: 'Now' },
  { path: '/interests', label: 'Interests' },
  { path: '/sources', label: 'Sources' },
  { path: '/settings', label: 'Settings' },
];
```

```tsx
// frontend/src/components/MobileNav.tsx
const navItems = [
  { path: '/daily-digest', label: 'Digest', icon: 'auto_awesome' },
  { path: '/now', label: 'Now', icon: 'dashboard_customize' },
  { path: '/interests', label: 'Interests', icon: 'label_important' },
  { path: '/sources', label: 'Sources', icon: 'rss_feed' },
  { path: '/settings', label: 'Settings', icon: 'settings_suggest' },
];
```

- [ ] **Step 3: 先放一个最小 `Now` 页面占位，保证新路由不白屏**

```tsx
// frontend/src/pages/Now.tsx
export default function Now() {
  return (
    <section className="rounded-2xl border border-[#c0c8cb]/20 bg-white p-10 shadow-sm">
      <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[#5e5e5e]">Workbench</p>
      <h1 className="font-['Newsreader'] text-5xl italic text-[#1a1c1b]">Now</h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-[#40484b]">
        This screen will host the current priority queue and the detail-reading workspace.
      </p>
    </section>
  );
}
```

- [ ] **Step 4: 编译确认新路由壳层没破坏现有页面**

Run:
```bash
cd frontend
npm run build
```

Expected: PASS，产出新的 `dist/`，且没有 React Router / TypeScript 类型错误。

- [ ] **Step 5: 做一次浏览器 smoke，确认入口已完成切换**

Run:
```bash
cd frontend
npm run dev
```

Manual check:
1. 打开 `http://localhost:5173/`，应自动跳转到 `/daily-digest`。
2. 顶部、侧边、移动端导航都能看到 `Now`。
3. 访问 `http://localhost:5173/newsletter` 时，应自动跳转到 `/daily-digest` 而不是 404。
4. 点击 `Now` 不应白屏。

- [ ] **Step 6: 提交路由壳层改动**

```bash
git add frontend/src/App.tsx frontend/src/components/Sidebar.tsx frontend/src/components/TopNav.tsx frontend/src/components/MobileNav.tsx frontend/src/pages/Now.tsx
git commit -F - <<'EOF'
Expose Daily Digest and Now as first-class product entry points

Switch the app shell from a newsletter-only IA to the new dual-core
routing model while preserving a compatibility redirect from the old
newsletter path. This keeps navigation changes isolated before the
page internals move.

Constraint: Existing shared shell components must keep Sources, Interests, and Settings untouched
Rejected: Rename Newsletter.tsx immediately | larger diff with no user-visible benefit at this stage
Confidence: high
Scope-risk: narrow
Directive: Keep /newsletter redirecting until README and any external links are updated
Tested: cd frontend && npm run build; manual route smoke on /, /newsletter, /daily-digest, /now
Not-tested: Mobile-device browser chrome behavior
EOF
```

---

### Task 4: 扩展前端 API 客户端，让 `Now` 页面只消费强类型 DTO

**Files:**
- Modify: `frontend/src/api/newsletter.ts`

- [ ] **Step 1: 给 `newsletter.ts` 增加 `Now` 类型**

```ts
export interface NowItem {
  anchor_id: number;
  article_id: number;
  title: string;
  excerpt: string;
  source_name: string;
  source_article_link: string;
  tags: string[];
  published_at: string | null;
  significance: number;
  priority_score: number;
  priority_reason: string;
  zone: 'main' | 'explore' | 'discover';
  is_read: boolean;
  is_processed: boolean;
}

export interface NowListResponse {
  items: NowItem[];
  generated_at: string;
}

export interface NowDetail {
  anchor_id: number;
  article_id: number;
  title: string;
  source_name: string;
  source_article_link: string;
  tags: string[];
  published_at: string | null;
  ai_summary: string;
  dialectical_analysis: string;
  body_markdown: string;
  priority_score: number;
  priority_reason: string;
  is_read: boolean;
  is_processed: boolean;
  read_at: string | null;
  processed_at: string | null;
}

export interface NowStateUpdatePayload {
  mark_read?: boolean;
  mark_processed?: boolean;
}

export interface NowStateResponse {
  anchor_id: number;
  article_id: number;
  is_read: boolean;
  is_processed: boolean;
  read_at: string | null;
  processed_at: string | null;
}
```

- [ ] **Step 2: 增加 `nowApi`，不要在页面里手写 `fetch`**

```ts
export const nowApi = {
  list: (limit: number = 20) =>
    fetchApi<NowListResponse>(`/now?limit=${limit}`),

  getDetail: (anchorId: number) =>
    fetchApi<NowDetail>(`/now/${anchorId}`),

  updateState: (anchorId: number, data: NowStateUpdatePayload) =>
    fetchApi<NowStateResponse>(`/now/${anchorId}/state`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};
```

- [ ] **Step 3: 编译验证 DTO 改动没有影响旧页面**

Run:
```bash
cd frontend
npm run build
```

Expected: PASS，`digestsApi / interestsApi / behaviorApi` 仍然可用，新增 `nowApi` 没有引入重复类型名冲突。

- [ ] **Step 4: 提交 API 客户端扩展**

```bash
git add frontend/src/api/newsletter.ts
git commit -F - <<'EOF'
Define one typed frontend client for the new Now workbench contract

Extend the existing API client instead of creating an ad hoc fetch layer,
so the new page can consume queue and detail payloads with the same
error-handling behavior already used elsewhere in the app.

Constraint: Keep the diff small by extending newsletter.ts rather than renaming the API surface mid-phase
Rejected: Create a second API client file | would duplicate fetchApi and split shared contracts too early
Confidence: high
Scope-risk: narrow
Directive: If newsletter.ts grows past comfortable review size after this phase, extract a shared api/client.ts in a follow-up cleanup
Tested: cd frontend && npm run build
Not-tested: Runtime API calls against a live backend
EOF
```

---

### Task 5: 把 `Daily Digest` 从阅读终点改成 `Detail` 入口，但保留 digest-only 纠偏

**Files:**
- Modify: `frontend/src/pages/Newsletter.tsx`

- [ ] **Step 1: 让 Digest 卡片跳内部 Detail，而不是把原文当主出口**

```tsx
import { useNavigate } from 'react-router-dom';

function MainChannelArticle({
  insight,
  badge,
  readTime,
  dismissing,
  feedbackDisabled,
  onFeedback,
  onOpenDetail,
}: {
  insight: InsightRef;
  badge: string;
  readTime: string;
  dismissing: boolean;
  feedbackDisabled: boolean;
  onFeedback: (insight: InsightRef) => void;
  onOpenDetail: (insight: InsightRef) => void;
}) {
  return (
    <article className={`group relative rounded-xl border border-[#c0c8cb]/5 bg-[#f4f4f2] p-8 ${dismissing ? 'pointer-events-none translate-y-2 scale-[0.98] opacity-0' : 'opacity-100'}`}>
      <div className="flex flex-col gap-10 lg:flex-row">
        <div className="flex-1">
          <div className="mb-6 flex items-center gap-3">
            <span className="rounded-full bg-[#0d4656]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#0d4656]">
              {badge}
            </span>
            <span className="text-[10px] uppercase tracking-widest text-[#40484b]">{readTime}</span>
          </div>
          <button onClick={() => onOpenDetail(insight)} className="text-left">
            <h4 className="mb-6 font-headline text-4xl leading-tight transition-colors group-hover:text-[#0d4656]">
              {insight.title}
            </h4>
          </button>
          <p className="mb-8 text-lg leading-relaxed text-[#40484b]">{insight.content}</p>
          <button
            onClick={() => onOpenDetail(insight)}
            className="inline-flex items-center gap-2 rounded-full border border-[#0d4656]/20 px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-[#0d4656] transition-colors hover:bg-[#0d4656] hover:text-white"
          >
            Open Detail
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        </div>
        <div className="lg:w-[280px]">
          <div className="flex h-64 items-center justify-center rounded border-2 border-dashed bg-[#e8e8e6] text-sm text-[#5e5e5e]">
            {insight.source_name}
          </div>
          <div className="mt-6 flex flex-col gap-4">
            <button
              onClick={() => onFeedback(insight)}
              disabled={feedbackDisabled}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[#c0c8cb]/20 px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-[#40484b] transition-colors hover:border-[#0d4656]/30 hover:text-[#0d4656] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-base">thumb_down</span>
              减少这类话题内容
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
```

- [ ] **Step 2: 在页面级用 `navigate()` 把用户送进 `Now` 详情上下文**

```tsx
const navigate = useNavigate();

function handleOpenDetail(insight: InsightRef) {
  if (!digest) return;

  void behaviorApi.recordLog({
    digest_id: digest.id,
    anchor_id: insight.anchor_id,
    tag: insight.tags[0] || 'general',
    signal_type: 'implicit',
    action: 'click',
    value: 1,
  }).catch(() => {
    // best-effort only
  });

  navigate(`/now/${insight.anchor_id}?from=digest&date=${digest.date}`);
}
```

```tsx
<MainChannelArticle
  key={insight.anchor_id}
  insight={insight}
  badge={index === 0 ? 'Core Insight' : 'Societal Shift'}
  readTime={`${8 + index * 4} min read`}
  dismissing={dismissingAnchorId === insight.anchor_id}
  feedbackDisabled={Boolean(pendingFeedback) || dismissingAnchorId !== null}
  onFeedback={handleNegativeFeedback}
  onOpenDetail={handleOpenDetail}
/>
```

- [ ] **Step 3: 同步把刊物标题文案对齐到 `Daily Digest`**

```tsx
<h2 className="mb-6 font-headline text-6xl leading-none tracking-tight md:text-8xl">
  Daily <br />
  <span className="italic text-[#0d4656]">Digest</span>
</h2>
<p className="max-w-xl text-lg leading-relaxed text-[#40484b]">
  {digest?.overview || 'Today’s editorial digest is ready for internal reading and triage.'}
</p>
```

- [ ] **Step 4: 编译并做主链路 smoke，验证 `Digest -> Detail` 已成立**

Run:
```bash
cd frontend
npm run build
```

Manual check:
1. 打开 `/daily-digest`，主卡片里应该出现 `Open Detail`。
2. 主卡片里不再出现 `Read Source` 主按钮。
3. 点击 `Open Detail` 后，路由应跳到 `/now/<anchorId>`。
4. `减少这类话题内容` 仍只存在于 Digest 页面。

- [ ] **Step 5: 提交 Digest 链路调整**

```bash
git add frontend/src/pages/Newsletter.tsx
git commit -F - <<'EOF'
Turn Daily Digest into an internal detail entry point instead of an exit ramp

Keep the editorial reading surface and explicit feedback on Digest, but
route the primary action into the internal detail workspace so the app
captures attention before users decide whether the source article is
worth opening.

Constraint: Product spec explicitly keeps explicit interest correction on Daily Digest only
Rejected: Leave Read Source as the primary CTA on digest cards | conflicts with the new main reading chain
Confidence: high
Scope-risk: moderate
Directive: Do not reintroduce direct-to-source prominence on digest cards unless the product spec changes
Tested: cd frontend && npm run build; manual smoke from /daily-digest to /now/:anchorId
Not-tested: Accessibility audit for keyboard-only navigation through the new CTA
EOF
```

---

### Task 6: 构建 `Now` 三栏工作台和同页 Detail 阅读体验

**Files:**
- Modify: `frontend/src/pages/Now.tsx`
- Create: `frontend/src/components/now/NowContextRail.tsx`
- Create: `frontend/src/components/now/NowQueueList.tsx`
- Create: `frontend/src/components/now/NowDetailPane.tsx`

- [ ] **Step 1: 先把 `Now` 页升级成真实容器，接 `nowApi` 与路由参数**

```tsx
// frontend/src/pages/Now.tsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { nowApi, type NowDetail, type NowItem } from '../api/newsletter';
import NowContextRail from '../components/now/NowContextRail';
import NowQueueList from '../components/now/NowQueueList';
import NowDetailPane from '../components/now/NowDetailPane';

export default function Now() {
  const navigate = useNavigate();
  const { anchorId } = useParams();
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState<NowItem[]>([]);
  const [detail, setDetail] = useState<NowDetail | null>(null);
  const [queueCollapsed, setQueueCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  const selectedAnchorId = anchorId ? Number(anchorId) : items[0]?.anchor_id ?? null;
  const fromDigest = searchParams.get('from') === 'digest';
  const digestDate = searchParams.get('date');

  useEffect(() => {
    void loadQueue();
  }, []);

  useEffect(() => {
    if (!selectedAnchorId) return;
    void loadDetail(selectedAnchorId);
  }, [selectedAnchorId]);

  async function loadQueue() {
    setLoading(true);
    try {
      const response = await nowApi.list();
      setItems(response.items);
      const requestedAnchorId = anchorId ? Number(anchorId) : null;
      const firstAnchorId = response.items[0]?.anchor_id ?? null;
      const nextAnchorId = response.items.some((item) => item.anchor_id === requestedAnchorId)
        ? requestedAnchorId
        : firstAnchorId;
      if (nextAnchorId && nextAnchorId !== requestedAnchorId) {
        navigate(`/now/${nextAnchorId}`, { replace: true });
      }
      if (!nextAnchorId) {
        setDetail(null);
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(targetAnchorId: number) {
    setDetailLoading(true);
    try {
      const payload = await nowApi.getDetail(targetAnchorId);
      setDetail(payload);
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleStateChange(patch: { mark_read?: boolean; mark_processed?: boolean }) {
    if (!selectedAnchorId) return;
    const nextState = await nowApi.updateState(selectedAnchorId, patch);
    const updatedItems = items
      .map((item) =>
        item.anchor_id === selectedAnchorId
          ? {
              ...item,
              is_read: nextState.is_read,
              is_processed: nextState.is_processed,
            }
          : item
      )
      .filter((item) => !item.is_processed);

    setItems(updatedItems);

    const nextFocusAnchorId = patch.mark_processed
      ? updatedItems[0]?.anchor_id ?? null
      : selectedAnchorId;

    if (!nextFocusAnchorId) {
      setDetail(null);
      return;
    }

    if (nextFocusAnchorId !== selectedAnchorId) {
      navigate(`/now/${nextFocusAnchorId}`, { replace: true });
    }

    await loadDetail(nextFocusAnchorId);
  }

  const stats = useMemo(
    () => ({
      total: items.length,
      unread: items.filter((item) => !item.is_read).length,
      strong: items.filter((item) => item.zone === 'main').length,
    }),
    [items]
  );

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[240px_minmax(320px,380px)_minmax(0,1fr)]">
      <NowContextRail
        total={stats.total}
        unread={stats.unread}
        strong={stats.strong}
        fromDigest={fromDigest}
        digestDate={digestDate}
      />
      <NowQueueList
        loading={loading}
        collapsed={queueCollapsed}
        items={items}
        selectedAnchorId={selectedAnchorId}
        onToggleCollapsed={() => setQueueCollapsed((prev) => !prev)}
        onSelect={(targetAnchorId) => navigate(`/now/${targetAnchorId}`)}
      />
      <NowDetailPane
        loading={detailLoading}
        detail={detail}
        onMarkRead={() => handleStateChange({ mark_read: true })}
        onMarkProcessed={() => handleStateChange({ mark_processed: true })}
      />
    </div>
  );
}
```

- [ ] **Step 2: 左栏只放“上下文感”，不堆历史归档**

```tsx
// frontend/src/components/now/NowContextRail.tsx
import dayjs from 'dayjs';

export default function NowContextRail({
  total,
  unread,
  strong,
  fromDigest,
  digestDate,
}: {
  total: number;
  unread: number;
  strong: number;
  fromDigest: boolean;
  digestDate: string | null;
}) {
  return (
    <aside className="rounded-2xl border border-[#c0c8cb]/20 bg-white p-6 shadow-sm">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#5e5e5e]">Now Context</p>
      <h1 className="font-['Newsreader'] text-4xl italic text-[#1a1c1b]">What to process now</h1>
      <p className="mt-4 text-sm leading-7 text-[#40484b]">
        The queue only contains today’s items and a small amount of high-priority carry-over work from the last 48 hours.
      </p>

      <dl className="mt-8 space-y-4">
        <div className="rounded-xl bg-[#f4f4f2] p-4">
          <dt className="text-[10px] font-bold uppercase tracking-widest text-[#5e5e5e]">Queue size</dt>
          <dd className="mt-2 text-3xl font-semibold text-[#1a1c1b]">{total}</dd>
        </div>
        <div className="rounded-xl bg-[#f4f4f2] p-4">
          <dt className="text-[10px] font-bold uppercase tracking-widest text-[#5e5e5e]">Unread</dt>
          <dd className="mt-2 text-3xl font-semibold text-[#1a1c1b]">{unread}</dd>
        </div>
        <div className="rounded-xl bg-[#f4f4f2] p-4">
          <dt className="text-[10px] font-bold uppercase tracking-widest text-[#5e5e5e]">Main-channel items</dt>
          <dd className="mt-2 text-3xl font-semibold text-[#1a1c1b]">{strong}</dd>
        </div>
      </dl>

      {fromDigest && digestDate && (
        <div className="mt-8 rounded-xl border border-[#0d4656]/10 bg-[#0d4656]/5 p-4 text-sm text-[#0d4656]">
          Entered from Daily Digest · {dayjs(digestDate).format('YYYY-MM-DD')}
        </div>
      )}
    </aside>
  );
}
```

- [ ] **Step 3: 中栏队列支持收起/展开，并明确优先级原因**

```tsx
// frontend/src/components/now/NowQueueList.tsx
import dayjs from 'dayjs';
import type { NowItem } from '../../api/newsletter';

export default function NowQueueList({
  loading,
  collapsed,
  items,
  selectedAnchorId,
  onToggleCollapsed,
  onSelect,
}: {
  loading: boolean;
  collapsed: boolean;
  items: NowItem[];
  selectedAnchorId: number | null;
  onToggleCollapsed: () => void;
  onSelect: (anchorId: number) => void;
}) {
  return (
    <section className="rounded-2xl border border-[#c0c8cb]/20 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#5e5e5e]">Priority Queue</p>
          <h2 className="font-['Newsreader'] text-3xl italic text-[#1a1c1b]">Now list</h2>
        </div>
        <button
          onClick={onToggleCollapsed}
          className="inline-flex items-center gap-2 rounded-full border border-[#c0c8cb]/20 px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-[#40484b]"
        >
          <span className="material-symbols-outlined text-sm">menu_open</span>
          {collapsed ? 'Expand' : 'Collapse'}
        </button>
      </div>

      {!collapsed && (
        <div className="space-y-3">
          {loading && <p className="text-sm text-[#5e5e5e]">Loading queue...</p>}
          {!loading && items.length === 0 && (
            <div className="rounded-xl bg-[#f4f4f2] p-6 text-sm text-[#40484b]">No items need processing right now.</div>
          )}
          {!loading && items.map((item) => (
            <button
              key={item.anchor_id}
              onClick={() => onSelect(item.anchor_id)}
              className={`w-full rounded-xl border p-4 text-left transition-colors ${selectedAnchorId === item.anchor_id ? 'border-[#0d4656] bg-[#0d4656]/5' : 'border-[#c0c8cb]/15 bg-[#f9f9f7] hover:bg-[#f4f4f2]'}`}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="rounded-full bg-[#0d4656]/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-[#0d4656]">
                  {item.zone}
                </span>
                <span className="text-[10px] uppercase tracking-widest text-[#5e5e5e]">
                  {item.published_at ? dayjs(item.published_at).format('MM/DD HH:mm') : 'No date'}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-[#1a1c1b]">{item.title}</h3>
              <p className="mt-2 max-h-[4.5rem] overflow-hidden text-sm leading-6 text-[#40484b]">{item.excerpt}</p>
              <div className="mt-4 flex items-center justify-between gap-3 text-[10px] uppercase tracking-widest text-[#5e5e5e]">
                <span>{item.priority_reason}</span>
                <span>Score {item.priority_score.toFixed(2)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: 右栏 Detail 必须把 AI 摘要和正文放在同一页，并把 Read Source 降级到次动作**

```tsx
// frontend/src/components/now/NowDetailPane.tsx
import dayjs from 'dayjs';
import ReactMarkdown from 'react-markdown';
import type { NowDetail } from '../../api/newsletter';

export default function NowDetailPane({
  loading,
  detail,
  onMarkRead,
  onMarkProcessed,
}: {
  loading: boolean;
  detail: NowDetail | null;
  onMarkRead: () => void;
  onMarkProcessed: () => void;
}) {
  if (loading) {
    return <section className="rounded-2xl border border-[#c0c8cb]/20 bg-white p-8 shadow-sm">Loading detail...</section>;
  }

  if (!detail) {
    return <section className="rounded-2xl border border-[#c0c8cb]/20 bg-white p-8 shadow-sm">Select an item from the queue.</section>;
  }

  return (
    <section className="rounded-2xl border border-[#c0c8cb]/20 bg-white p-8 shadow-sm">
      <header className="border-b border-[#c0c8cb]/15 pb-6">
        <div className="mb-3 flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-widest text-[#5e5e5e]">
          <span>{detail.source_name}</span>
          <span>·</span>
          <span>{detail.published_at ? dayjs(detail.published_at).format('YYYY-MM-DD HH:mm') : 'No publish time'}</span>
          <span>·</span>
          <span>{detail.priority_reason}</span>
        </div>
        <h2 className="font-['Newsreader'] text-5xl italic leading-tight text-[#1a1c1b]">{detail.title}</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {detail.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-[#0d4656]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#0d4656]">
              {tag}
            </span>
          ))}
        </div>
      </header>

      <div className="mt-8 rounded-2xl border border-[#0d4656]/10 bg-[#0d4656]/5 p-6">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#0d4656]">AI Summary</p>
        <p className="text-base leading-7 text-[#1a1c1b]">{detail.ai_summary}</p>
      </div>

      {detail.dialectical_analysis && (
        <div className="mt-6 rounded-2xl border border-[#c0c8cb]/15 bg-[#f4f4f2] p-6">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#5e5e5e]">Dialectical Insight</p>
          <p className="text-sm leading-7 text-[#40484b]">{detail.dialectical_analysis}</p>
        </div>
      )}

      <article className="mt-8 text-base leading-8 text-[#1a1c1b]">
        <ReactMarkdown>{detail.body_markdown}</ReactMarkdown>
      </article>

      <footer className="mt-10 flex flex-wrap items-center gap-3 border-t border-[#c0c8cb]/15 pt-6">
        <button
          onClick={onMarkRead}
          disabled={detail.is_read}
          className="inline-flex items-center gap-2 rounded-full border border-[#c0c8cb]/20 px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-[#40484b] disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-sm">done</span>
          {detail.is_read ? 'Read' : 'Mark Read'}
        </button>
        <button
          onClick={onMarkProcessed}
          disabled={detail.is_processed}
          className="inline-flex items-center gap-2 rounded-full bg-[#0d4656] px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-white disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-sm">task_alt</span>
          {detail.is_processed ? 'Processed' : 'Mark Processed'}
        </button>
        <a
          href={detail.source_article_link}
          target="_blank"
          rel="noreferrer"
          className="ml-auto inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#5e5e5e] hover:text-[#0d4656]"
        >
          Read Source
          <span className="material-symbols-outlined text-sm">arrow_outward</span>
        </a>
      </footer>
    </section>
  );
}
```

- [ ] **Step 5: 编译确认新增组件和 `react-markdown` 用法工作正常**

Run:
```bash
cd frontend
npm run build
```

Expected: PASS；`Now.tsx`、三个新组件和 `newsletter.ts` 的新类型都能通过 TypeScript 编译。

- [ ] **Step 6: 浏览器 smoke，检查 `Now` 是否满足 MVP 定义**

Run:
```bash
cd frontend
npm run dev
```

Manual check:
1. 直接打开 `/now`，默认应选中第一条优先级内容并在右侧展示详情。
2. 打开 `/now/<anchorId>`，应直接落到该详情。
3. 队列中栏可以 collapse / expand。
4. 详情页里应先看到 `AI Summary`，再看到正文。
5. 详情页里只能看到 `Mark Read / Mark Processed / Read Source`，不能出现 Digest 的兴趣纠偏按钮。
6. 点击 `Mark Processed` 后，当前项应从队列消失并自动切到下一条。

- [ ] **Step 7: 提交 `Now` 工作台实现**

```bash
git add frontend/src/pages/Now.tsx frontend/src/components/now/NowContextRail.tsx frontend/src/components/now/NowQueueList.tsx frontend/src/components/now/NowDetailPane.tsx
git commit -F - <<'EOF'
Build the Now workbench so internal detail reading becomes the default behavior

Implement the MVP three-column workbench with a collapsible queue, a
single-page detail reader, and minimal read/process actions. The layout
keeps context visible without turning the page into a historical archive.

Constraint: The next-phase MVP defines Now as a current-priority workspace, not a long-term backlog or archive
Rejected: Open detail in a separate route-only page without queue context | loses the workbench mental model the spec requires
Confidence: medium
Scope-risk: moderate
Directive: Keep explicit preference correction out of Now/Detail unless a future spec introduces a new higher-level feedback model
Tested: cd frontend && npm run build; manual smoke on /now and /now/:anchorId
Not-tested: Very long article rendering performance in low-memory mobile browsers
EOF
```

---

### Task 7: 更新文档并做整体验证，确保“下一阶段 MVP”是可运行而不是纸面切换

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 更新 README 的产品定位、主路径和验证命令**

````md
## 当前项目状态（2026-04-20）

### 已完成的下一阶段主链路
- ✅ Daily Digest 成为默认首页入口
- ✅ Now 成为第二核心入口，提供优先级队列 + 内部 Detail 阅读
- ✅ 主阅读链路调整为 `Daily Digest -> Detail -> Read Source`
- ✅ Detail 支持 AI 摘要、正文、已读、已处理
- ✅ Digest 保留显式兴趣纠偏，Detail 不再承载该动作

### 推荐验证

```bash
cd backend
source .venv/bin/activate
pytest tests/test_now_api.py tests/test_articles.py tests/test_digests.py tests/test_main.py -q

cd ../frontend
npm run build
```
````

- [ ] **Step 2: 跑一次完整验证，不要只测新增页面**

Run:
```bash
cd backend
source .venv/bin/activate
pytest tests/test_now_api.py tests/test_articles.py tests/test_digests.py tests/test_sources.py tests/test_config.py tests/test_main.py -q

cd ../frontend
npm run build
```

Expected: PASS；既有 Sources / Settings / Interests 不被新路由和新 DTO 影响。

- [ ] **Step 3: 做最终人工验收，覆盖文档 spec 的关键条目**

Manual check:
1. `/daily-digest` 仍保持刊物感与显式兴趣纠偏。
2. 从 Digest 进入 Detail 后，用户先消费系统内内容，而不是立即跳原文。
3. `/now` 只展示当前/近 48h 高优先级项目，不提供归档视图入口。
4. Detail 页面在同页展示摘要 + 正文。
5. `Read Source` 只在 Detail 中出现。
6. `Mark Read / Mark Processed` 会影响队列展示。
7. `Sources / Interests / Settings` 仍可访问，且导航语义统一为信息工作台控制面板。

- [ ] **Step 4: 提交文档与验收结果**

```bash
git add README.md
git commit -F - <<'EOF'
Document the workbench-era product model so the repo matches the shipped flow

Refresh the README so contributors understand that MindFlow is no
longer a digest-only product. The docs now point to the dual-core
entry model, the new verification commands, and the internal-reading
first flow.

Constraint: Product messaging must stop describing the app as a single newsletter container
Rejected: Leave README unchanged until later cleanup | would immediately drift from the shipped routes and behavior
Confidence: high
Scope-risk: narrow
Directive: Keep README route names synchronized with App.tsx whenever navigation labels change
Tested: pytest tests/test_now_api.py tests/test_articles.py tests/test_digests.py tests/test_sources.py tests/test_config.py tests/test_main.py -q; cd frontend && npm run build
Not-tested: Docker compose smoke after the new Now API is deployed
EOF
```

---

## Self-Review

### 1. Spec coverage

- **产品定义 / 双核心入口**：Task 3、Task 6、Task 7。
- **页面角色与关系**：Task 3 处理 IA；Task 5、Task 6 落地 Daily Digest / Now / Detail；Task 7 更新文档口径。
- **主链路 `Daily Digest -> Detail -> Read Source`**：Task 5、Task 6。
- **Now 的产品定义、内容边界、三栏布局、列表可收起**：Task 2、Task 6。
- **Detail 同页展示 AI 摘要 + 正文 + 已读/已处理 + 可选 Read Source**：Task 2、Task 6。
- **显式兴趣纠偏只保留在 Digest**：Task 5、Task 6。
- **系统底层继续复用 Source / Article / Anchor / Digest 数据链路**：Task 2。
- **Now 排序逻辑由来源相关性 / 兴趣匹配 / 显著性 / 时效性 / 处理状态共同决定**：Task 2。
- **不进入本阶段 MVP 的能力**：整个计划没有引入收藏、归档、Backlog、Archive、复杂 explainability、多级批处理。

结论：规格 1-10 节均有对应任务，没有遗漏主要求。

### 2. Placeholder scan

已检查本计划，没有 `TODO / TBD / implement later / similar to Task N` 一类占位描述；每个任务都给出了具体文件、命令、代码片段与验收方式。

### 3. Type consistency

- 后端统一使用 `anchor_id` 作为路由入口、`article_id` 作为阅读主体关联键。
- 前端与后端统一使用 `mark_read / mark_processed` 请求体。
- `Now` 列表与详情统一使用 `priority_score / priority_reason / is_read / is_processed` 字段。
- Digest 到 Detail 的跳转统一是 `/now/:anchorId`。
