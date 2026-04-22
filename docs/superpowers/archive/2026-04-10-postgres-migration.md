# PostgreSQL 数据库迁移计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将后端数据库从 SQLite 迁移到 PostgreSQL + pgvector，支持 JSONB 元数据索引、全文搜索和向量相似度搜索。

**Architecture:**
- 迁移 `backend/database.py` 中的所有 CRUD 函数到 SQLAlchemy 2.0 ORM 模式
- 保留 SQLite 数据库文件用于数据导出
- 新增 pgvector 支持未来向量搜索
- 添加 Alembic 进行 schema 迁移管理

**Tech Stack:** PostgreSQL, SQLAlchemy 2.0 (async), asyncpg, Alembic, pgvector

---

## 文件结构

```
backend/
├── database.py              # 重写：SQLAlchemy ORM + async 支持
├── models.py                # 扩展：新增 embedding 向量字段
├── requirements.txt         # 更新：新增 psycopg2-binary/asyncpg, alembic, pgvector
├── alembic/                 # 新增：Alembic 迁移目录
│   ├── env.py
│   └── versions/
├── migrations/               # 新增：SQLite 数据导出脚本
│   └── export_sqlite_to_postgres.py
└── tests/
    └── test_database.py     # 新增：数据库迁移后测试
```

---

## Task 1: 更新依赖和配置

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/.env.example` (PostgreSQL 配置)

- [ ] **Step 1: 更新 requirements.txt**

```
# 新增依赖
psycopg2-binary>=2.9.9      # PostgreSQL 驱动（同步）
asyncpg>=0.29.0             # PostgreSQL 异步驱动
alembic>=1.13.0             # 数据库迁移工具
sqlalchemy[asyncio]>=2.0.25 # SQLAlchemy 异步支持
pgvector>=0.2.0             # 向量搜索扩展
# 保留现有
fastapi>=0.109.0
uvicorn[standard]>=0.27.0
pydantic>=2.5.0
aiosqlite>=0.19.0           # 保留用于测试
```

- [ ] **Step 2: 更新 .env.example 添加 PostgreSQL 配置**

```env
# PostgreSQL 配置
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=mindflow
POSTGRES_USER=mindflow
POSTGRES_PASSWORD=your_password_here

# AI API 配置
SILICONFLOW_API_KEY=${SILICONFLOW_API_KEY:-}
AI_BASE_URL=${AI_BASE_URL:-https://api.siliconflow.cn/v1}
AI_MODEL=${AI_MODEL:-Qwen/Qwen2.5-7B-Instruct}
```

- [ ] **Step 3: Commit**

```bash
git add backend/requirements.txt backend/.env.example
git commit -m "feat(db): add PostgreSQL dependencies and env config"
```

---

## Task 2: 创建 SQLAlchemy 模型和数据库层

**Files:**
- Modify: `backend/database.py` (完全重写)
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`

- [ ] **Step 1: 创建 database.py 核心结构**

```python
# backend/database.py
import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool

# 从环境变量读取 PostgreSQL 配置
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "localhost")
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")
POSTGRES_DB = os.getenv("POSTGRES_DB", "mindflow")
POSTGRES_USER = os.getenv("POSTGRES_USER", "mindflow")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "")

DATABASE_URL = f"postgresql+asyncpg://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
SYNC_DATABASE_URL = f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"

# 全局 engine 和 sessionmaker
async_engine = create_async_engine(DATABASE_URL, echo=False, pool_pre_ping=True)
AsyncSessionLocal = async_sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)

sync_engine = create_engine(SYNC_DATABASE_URL, echo=False)
SyncSessionLocal = sessionmaker(sync_engine)


@asynccontextmanager
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """获取异步数据库会话"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


def get_sync_db() -> Session:
    """获取同步数据库会话（用于脚本和迁移）"""
    session = SyncSessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
```

- [ ] **Step 2: 创建 SQLAlchemy ORM 模型**

```python
# backend/models.py (新增模型定义)
from sqlalchemy import Column, Integer, String, Text, Float, Date, DateTime, ForeignKey, JSON, Index
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.dialects.postgresql import JSONB
from datetime import datetime

Base = declarative_base()


class NewsSource(Base):
    __tablename__ = "news_sources"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    source_type = Column(String, default="custom")
    api_base_url = Column(String, nullable=False)
    auth_key = Column(String, default="")
    config = Column(JSON, default={})  # SQLite 用 JSON.dumps，PG 用 JSONB
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_fetch_at = Column(DateTime)
    article_count = Column(Integer, default=0)

    articles = relationship("Article", back_populates="source")


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

    source = relationship("NewsSource", back_populates="articles")
    anchor_points = relationship("AnchorPoint", back_populates="article")


class AnchorPoint(Base):
    __tablename__ = "anchor_points"
    id = Column(Integer, primary_key=True, autoincrement=True)
    article_id = Column(Integer, ForeignKey("articles.id", ondelete="CASCADE"))
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    dialectical_analysis = Column(Text)
    anchor_type = Column(String, default="opinion")
    significance = Column(Float, default=0.5)
    source_article_title = Column(String)
    source_article_link = Column(String)
    source_name = Column(String)
    tags = Column(JSON, default=list)  # JSONB list
    related_tag_weights = Column(JSON, default=dict)  # JSONB dict
    # 未来向量搜索用
    # embedding = Column(Vector(1536))  # pgvector
    created_at = Column(DateTime, default=datetime.utcnow)

    article = relationship("Article", back_populates="anchor_points")

    # GIN 索引用于 JSONB containment 查询
    __table_args__ = (
        Index("idx_anchor_tags", "tags", postgresql_using="gin"),
        Index("idx_anchor_related_weights", "related_tag_weights", postgresql_using="gin"),
    )


class DailyDigest(Base):
    __tablename__ = "daily_digests"
    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(Date, unique=True, nullable=False)
    title = Column(String, nullable=False)
    overview = Column(Text)
    sections = Column(JSON, default=list)  # JSONB
    total_articles_processed = Column(Integer, default=0)
    anchor_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    # GIN 索引用于 JSONB sections 查询
    __table_args__ = (
        Index("idx_digest_sections", "sections", postgresql_using="gin"),
    )


class UserInterestTag(Base):
    __tablename__ = "user_interest_tags"
    id = Column(Integer, primary_key=True, autoincrement=True)
    tag = Column(String, unique=True, nullable=False)
    weight = Column(Float, default=1.0)
    status = Column(String, default="active")
    view_count = Column(Integer, default=0)
    show_count = Column(Integer, default=0)
    hide_count = Column(Integer, default=0)
    total_time_spent = Column(Float, default=0.0)
    click_count = Column(Integer, default=0)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)


class UserBehaviorLog(Base):
    __tablename__ = "user_behavior_logs"
    id = Column(Integer, primary_key=True, autoincrement=True)
    digest_id = Column(Integer)
    anchor_id = Column(Integer)
    tag = Column(String)
    signal_type = Column(String)
    action = Column(String)
    value = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)


class DigestFeedback(Base):
    __tablename__ = "digest_feedback"
    id = Column(Integer, primary_key=True, autoincrement=True)
    digest_id = Column(Integer, nullable=False)
    anchor_id = Column(Integer, nullable=False)
    action = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class AIConfig(Base):
    __tablename__ = "ai_config"
    id = Column(Integer, primary_key=True, default=1)
    provider = Column(String, nullable=False, default="siliconflow")
    api_key = Column(String, nullable=False)
    base_url = Column(String, nullable=False)
    model = Column(String, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class FetchLog(Base):
    __tablename__ = "fetch_logs"
    id = Column(Integer, primary_key=True, autoincrement=True)
    source_id = Column(Integer)
    status = Column(String)
    message = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
```

- [ ] **Step 3: 创建 init_db 函数**

```python
async def init_db():
    """初始化数据库 schema"""
    from models import Base

    async with async_engine.begin() as conn:
        # 启用 pgvector 扩展
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        # 创建所有表
        await conn.run_sync(Base.metadata.create_all)


def init_db_sync():
    """同步版本用于迁移脚本"""
    from models import Base

    with sync_engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        Base.metadata.create_all(conn)
```

- [ ] **Step 4: Commit**

```bash
git add backend/database.py backend/models.py
git commit -m "feat(db): rewrite database layer with SQLAlchemy ORM and PostgreSQL"
```

---

## Task 3: 迁移 CRUD 函数到异步模式

**Files:**
- Modify: `backend/database.py` (添加所有 CRUD 函数)

- [ ] **Step 1: 添加 news_sources CRUD**

```python
# === News Sources CRUD ===

async def get_all_sources():
    async with get_db() as session:
        result = await session.execute(
            select(NewsSource).order_by(NewsSource.created_at.desc())
        )
        return [row.__dict__ for row in result.scalars().all()]


async def get_source_by_id(source_id: int):
    async with get_db() as session:
        result = await session.execute(
            select(NewsSource).where(NewsSource.id == source_id)
        )
        source = result.scalar_one_or_none()
        return source.__dict__ if source else None


async def create_source(name: str, source_type: str, api_base_url: str,
                        auth_key: str = "", config: dict = None):
    async with get_db() as session:
        source = NewsSource(
            name=name, source_type=source_type,
            api_base_url=api_base_url, auth_key=auth_key,
            config=config or {}
        )
        session.add(source)
        await session.flush()
        return source.id


async def update_source(source_id: int, **kwargs):
    async with get_db() as session:
        result = await session.execute(
            select(NewsSource).where(NewsSource.id == source_id)
        )
        source = result.scalar_one_or_none()
        if not source:
            return False
        for key, value in kwargs.items():
            if key in ("name", "source_type", "api_base_url", "auth_key", "config"):
                setattr(source, key, value)
        source.updated_at = datetime.utcnow()
        return True
```

- [ ] **Step 2: 添加 anchor_points CRUD (支持 JSONB 查询)**

```python
# === Anchor Points CRUD ===

async def create_anchor(
    article_id: int, title: str, content: str,
    dialectical_analysis: str, anchor_type: str, significance: float,
    source_article_title: str, source_article_link: str, source_name: str,
    tags: list, related_tag_weights: dict
) -> int:
    async with get_db() as session:
        anchor = AnchorPoint(
            article_id=article_id, title=title, content=content,
            dialectical_analysis=dialectical_analysis, anchor_type=anchor_type,
            significance=significance,
            source_article_title=source_article_title,
            source_article_link=source_article_link, source_name=source_name,
            tags=tags, related_tag_weights=related_tag_weights
        )
        session.add(anchor)
        await session.flush()
        return anchor.id


async def get_anchors(limit: int = 100, offset: int = 0, tags: list = None):
    async with get_db() as session:
        query = select(AnchorPoint).order_by(
            AnchorPoint.significance.desc(), AnchorPoint.created_at.desc()
        ).limit(limit).offset(offset)

        if tags:
            # JSONB containment 查询
            query = query.where(AnchorPoint.tags.contains(tags))
            result = await session.execute(query)
        else:
            result = await session.execute(query)

        return [row.__dict__ for row in result.scalars().all()]


async def get_digest_by_date(date_str: str):
    async with get_db() as session:
        result = await session.execute(
            select(DailyDigest).where(DailyDigest.date == date_str)
        )
        digest = result.scalar_one_or_none()
        return digest.__dict__ if digest else None


async def get_latest_digest():
    async with get_db() as session:
        result = await session.execute(
            select(DailyDigest).order_by(DailyDigest.date.desc()).limit(1)
        )
        digest = result.scalar_one_or_none()
        return digest.__dict__ if digest else None


async def get_digests(limit: int = 30, offset: int = 0):
    async with get_db() as session:
        result = await session.execute(
            select(DailyDigest).order_by(DailyDigest.date.desc())
            .limit(limit).offset(offset)
        )
        return [row.__dict__ for row in result.scalars().all()]


async def create_digest(
    date_str: str, title: str, overview: str,
    sections: list, total_articles: int, anchor_count: int
) -> int:
    async with get_db() as session:
        digest = DailyDigest(
            date=date_str, title=title, overview=overview,
            sections=sections, total_articles_processed=total_articles,
            anchor_count=anchor_count
        )
        session.add(digest)
        await session.flush()
        return digest.id
```

- [ ] **Step 3: 添加 user_interest_tags CRUD**

```python
# === Interest Tag CRUD ===

async def get_all_interest_tags():
    async with get_db() as session:
        result = await session.execute(
            select(UserInterestTag).order_by(UserInterestTag.weight.desc())
        )
        return [row.__dict__ for row in result.scalars().all()]


async def create_interest_tag(tag: str) -> int:
    async with get_db() as session:
        interest_tag = UserInterestTag(tag=tag)
        session.add(interest_tag)
        await session.flush()
        return interest_tag.id


async def update_interest_tag(tag_id: int, **kwargs) -> bool:
    async with get_db() as session:
        result = await session.execute(
            select(UserInterestTag).where(UserInterestTag.id == tag_id)
        )
        tag_obj = result.scalar_one_or_none()
        if not tag_obj:
            return False
        allowed_fields = ("weight", "status", "view_count", "show_count",
                          "hide_count", "total_time_spent", "click_count")
        for key, value in kwargs.items():
            if key in allowed_fields:
                setattr(tag_obj, key, value)
        tag_obj.last_updated = datetime.utcnow()
        return True
```

- [ ] **Step 4: Commit**

```bash
git add backend/database.py
git commit -m "feat(db): add async CRUD functions with JSONB support"
```

---

## Task 4: 创建 Alembic 迁移配置

**Files:**
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`
- Create: `backend/alembic/script.py.mako`

- [ ] **Step 1: 创建 alembic.ini**

```ini
[alembic]
script_location = alembic
prepend_sys_path = .
version_path_separator = os

[post_write_hooks]

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console
qualname =

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
```

- [ ] **Step 2: 创建 alembic/env.py**

```python
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from models import Base
from database import SYNC_DATABASE_URL

config = context.config
config.set_main_option("sqlalchemy.url", SYNC_DATABASE_URL)

if config.config_file_name:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

- [ ] **Step 3: 创建初始迁移**

```bash
cd backend
alembic revision --autogenerate -m "initial migration"
```

- [ ] **Step 4: Commit**

```bash
git add backend/alembic.ini backend/alembic/
git commit -m "feat(db): add Alembic migration configuration"
```

---

## Task 5: 创建数据迁移脚本

**Files:**
- Create: `backend/migrations/export_sqlite_to_postgres.py`

- [ ] **Step 1: 创建迁移脚本**

```python
#!/usr/bin/env python3
"""
SQLite 到 PostgreSQL 数据迁移脚本

使用方式:
1. 确保 PostgreSQL 已运行且数据库已创建
2. 运行 `python export_sqlite_to_postgres.py`
"""
import sqlite3
import json
from datetime import datetime
from sqlalchemy import text
from backend.database import sync_engine, init_db_sync


def load_sqlite_data(db_path: str):
    """从 SQLite 读取所有数据"""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    data = {}

    # 读取各表数据
    tables = [
        "news_sources", "articles", "ai_config", "fetch_logs",
        "anchor_points", "daily_digests", "user_interest_tags",
        "user_behavior_logs", "digest_feedback"
    ]

    for table in tables:
        cursor = conn.execute(f"SELECT * FROM {table}")
        rows = cursor.fetchall()
        data[table] = [dict(row) for row in rows]

    conn.close()
    return data


def migrate_data(data: dict):
    """将数据写入 PostgreSQL"""
    with sync_engine.begin() as conn:
        # 迁移 news_sources
        for row in data.get("news_sources", []):
            conn.execute(text("""
                INSERT INTO news_sources (id, name, source_type, api_base_url, auth_key, config,
                                         created_at, updated_at, last_fetch_at, article_count)
                VALUES (:id, :name, :source_type, :api_base_url, :auth_key, :config,
                        :created_at, :updated_at, :last_fetch_at, :article_count)
                ON CONFLICT (id) DO NOTHING
            """), {
                **row,
                "config": json.dumps(row.get("config", {})),
                "created_at": row.get("created_at") or datetime.utcnow(),
                "updated_at": row.get("updated_at") or datetime.utcnow(),
            })

        # 迁移 articles
        for row in data.get("articles", []):
            conn.execute(text("""
                INSERT INTO articles (id, source_id, external_id, title, link, content,
                                     summary, author, published_at, fetched_at)
                VALUES (:id, :source_id, :external_id, :title, :link, :content,
                        :summary, :author, :published_at, :fetched_at)
                ON CONFLICT (id) DO NOTHING
            """), row)

        # 迁移 anchor_points (JSON fields)
        for row in data.get("anchor_points", []):
            conn.execute(text("""
                INSERT INTO anchor_points (id, article_id, title, content, dialectical_analysis,
                                          anchor_type, significance, source_article_title,
                                          source_article_link, source_name, tags,
                                          related_tag_weights, created_at)
                VALUES (:id, :article_id, :title, :content, :dialectical_analysis,
                        :anchor_type, :significance, :source_article_title,
                        :source_article_link, :source_name, :tags, :related_tag_weights, :created_at)
                ON CONFLICT (id) DO NOTHING
            """), {
                **row,
                "tags": json.dumps(row.get("tags", [])),
                "related_tag_weights": json.dumps(row.get("related_tag_weights", {})),
                "created_at": row.get("created_at") or datetime.utcnow(),
            })

        # 迁移 daily_digests (JSON fields)
        for row in data.get("daily_digests", []):
            conn.execute(text("""
                INSERT INTO daily_digests (id, date, title, overview, sections,
                                          total_articles_processed, anchor_count, created_at)
                VALUES (:id, :date, :title, :overview, :sections,
                        :total_articles_processed, :anchor_count, :created_at)
                ON CONFLICT (id) DO NOTHING
            """), {
                **row,
                "sections": json.dumps(row.get("sections", [])),
                "created_at": row.get("created_at") or datetime.utcnow(),
            })

        # 迁移 user_interest_tags
        for row in data.get("user_interest_tags", []):
            conn.execute(text("""
                INSERT INTO user_interest_tags (id, tag, weight, status, view_count, show_count,
                                              hide_count, total_time_spent, click_count,
                                              last_updated, created_at)
                VALUES (:id, :tag, :weight, :status, :view_count, :show_count,
                        :hide_count, :total_time_spent, :click_count, :last_updated, :created_at)
                ON CONFLICT (id) DO NOTHING
            """), {
                **row,
                "last_updated": row.get("last_updated") or datetime.utcnow(),
                "created_at": row.get("created_at") or datetime.utcnow(),
            })

        # 迁移 user_behavior_logs
        for row in data.get("user_behavior_logs", []):
            conn.execute(text("""
                INSERT INTO user_behavior_logs (id, digest_id, anchor_id, tag, signal_type,
                                               action, value, created_at)
                VALUES (:id, :digest_id, :anchor_id, :tag, :signal_type,
                        :action, :value, :created_at)
                ON CONFLICT (id) DO NOTHING
            """), {
                **row,
                "created_at": row.get("created_at") or datetime.utcnow(),
            })

        # 迁移 digest_feedback
        for row in data.get("digest_feedback", []):
            conn.execute(text("""
                INSERT INTO digest_feedback (id, digest_id, anchor_id, action, created_at)
                VALUES (:id, :digest_id, :anchor_id, :action, :created_at)
                ON CONFLICT (id) DO NOTHING
            """), {
                **row,
                "created_at": row.get("created_at") or datetime.utcnow(),
            })

        print("数据迁移完成!")


def main():
    sqlite_path = "../data/ai_crawler.db"
    print(f"从 {sqlite_path} 读取数据...")

    print("初始化 PostgreSQL schema...")
    init_db_sync()

    print("加载 SQLite 数据...")
    data = load_sqlite_data(sqlite_path)

    print("迁移数据到 PostgreSQL...")
    migrate_data(data)

    print(f"迁移统计:")
    for table, rows in data.items():
        print(f"  {table}: {len(rows)} 条记录")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Commit**

```bash
git add backend/migrations/export_sqlite_to_postgres.py
git commit -m "feat(db): add SQLite to PostgreSQL migration script"
```

---

## Task 6: 更新 main.py 适配异步 init

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: 更新 lifespan 函数**

```python
from database import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup - 使用新的异步 init_db
    await init_db()
    start_scheduler()
    yield
    # Shutdown
    stop_scheduler()
```

- [ ] **Step 2: Commit**

```bash
git add backend/main.py
git commit -m "fix(db): update main.py to use async init_db"
```

---

## Task 7: 更新 Docker Compose 添加 PostgreSQL

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: 添加 PostgreSQL 服务**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: mindflow-postgres
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_DB=mindflow
      - POSTGRES_USER=mindflow
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-mindflow_dev}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U mindflow"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    # ... existing config ...
    environment:
      # ... existing env vars ...
      - POSTGRES_HOST=postgres
      - POSTGRES_PORT=5432
      - POSTGRES_DB=mindflow
      - POSTGRES_USER=mindflow
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-mindflow_dev}
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  postgres-data:
```

- [ ] **Step 2: Commit**

```bash
git add docker-compose.yml
git commit -m "feat(db): add PostgreSQL service to Docker Compose"
```

---

## Task 8: 运行测试验证

**Files:**
- Create: `backend/tests/test_database.py`

- [ ] **Step 1: 创建测试**

```python
import pytest
import asyncio
from database import get_db, init_db
from models import NewsSource, AnchorPoint


@pytest.fixture(scope="module")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="module", autouse=True)
async def setup_database():
    await init_db()
    yield


@pytest.mark.asyncio
async def test_create_and_get_source():
    """测试创建和获取新闻源"""
    source_id = await create_source(
        name="Test Source",
        source_type="rss",
        api_base_url="https://example.com/feed"
    )
    assert source_id > 0

    source = await get_source_by_id(source_id)
    assert source is not None
    assert source["name"] == "Test Source"


@pytest.mark.asyncio
async def test_anchor_jsonb_query():
    """测试 JSONB containment 查询"""
    # 创建带标签的锚点
    anchor_id = await create_anchor(
        article_id=1, title="Test Anchor", content="Test content",
        dialectical_analysis="Test analysis", anchor_type="opinion",
        significance=0.8, source_article_title="Source",
        source_article_link="https://example.com",
        source_name="TestSource",
        tags=["AI", "Machine Learning"],
        related_tag_weights={"AI": 1.5, "ML": 1.2}
    )

    # 测试 JSONB contains 查询
    anchors = await get_anchors(tags=["AI"])
    assert len(anchors) >= 1
    assert any(a["id"] == anchor_id for a in anchors)
```

- [ ] **Step 2: 运行测试**

```bash
cd backend && python -m pytest tests/test_database.py -v
```

Expected: 所有测试通过

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_database.py
git commit -m "test(db): add database layer tests"
```

---

## Task 9: 执行完整迁移

- [ ] **Step 1: 启动 PostgreSQL**

```bash
docker-compose up -d postgres
```

- [ ] **Step 2: 运行 Alembic 迁移**

```bash
cd backend
alembic upgrade head
```

- [ ] **Step 3: 运行数据迁移脚本**

```bash
python migrations/export_sqlite_to_postgres.py
```

- [ ] **Step 4: 启动完整服务**

```bash
docker-compose up -d
```

- [ ] **Step 5: 验证服务运行**

```bash
curl http://localhost:8000/health
curl http://localhost:8000/api/digests/latest
```

---

## 验收标准

- [ ] `docker-compose up -d postgres` 成功启动 PostgreSQL
- [ ] `alembic upgrade head` 成功创建所有表
- [ ] 数据迁移脚本成功迁移所有历史数据
- [ ] `curl http://localhost:8000/api/digests/latest` 返回正确数据
- [ ] `curl http://localhost:8000/api/interests` 返回正确数据
- [ ] 前端页面正常加载
- [ ] 所有测试通过
- [ ] 代码已提交并推送到远程

---

## 回滚计划

如果迁移失败，切回 SQLite：

```bash
git checkout master
docker-compose down
# 编辑 docker-compose.yml 移除 postgres 服务
# 注释掉 backend 的 POSTGRES_* 环境变量
docker-compose up -d
```
