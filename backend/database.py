import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool

# PostgreSQL configuration from environment
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "localhost")
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")
POSTGRES_DB = os.getenv("POSTGRES_DB", "mindflow")
POSTGRES_USER = os.getenv("POSTGRES_USER", "mindflow")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "")

DATABASE_URL = f"postgresql+asyncpg://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
SYNC_DATABASE_URL = f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"

# Global engine and sessionmakers
async_engine = create_async_engine(DATABASE_URL, echo=False, pool_pre_ping=True)
AsyncSessionLocal = async_sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)

sync_engine = create_engine(SYNC_DATABASE_URL, echo=False)
SyncSessionLocal = sessionmaker(sync_engine)


@asynccontextmanager
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Get async database session"""
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
    """Get sync database session (for migrations/scripts)"""
    session = SyncSessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


async def init_db():
    """Initialize database schema"""
    from models import Base

    async with async_engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)


async def check_db_health() -> bool:
    """Check whether PostgreSQL connection is available."""
    try:
        async with async_engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


def init_db_sync():
    """Sync version for migration scripts"""
    from models import Base

    with sync_engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        Base.metadata.create_all(conn)


# ============================================================================
# CRUD Functions - Async SQLAlchemy Pattern
# ============================================================================
from typing import Optional, List, Dict, Any
from datetime import datetime, date, timedelta
from models import (
    NewsSource, Article, AnchorPoint, DailyDigest,
    UserInterestTag, UserBehaviorLog, DigestFeedback, AIConfig, FetchLog
)
from sqlalchemy import select, func, or_


# --------------------------------------------------------------------------
# News Sources CRUD
# --------------------------------------------------------------------------

async def get_all_sources() -> List[Dict[str, Any]]:
    """Get all news sources ordered by creation date."""
    async with get_db() as session:
        result = await session.execute(
            select(NewsSource).order_by(NewsSource.created_at.desc())
        )
        sources = result.scalars().all()
        return [s.__dict__ for s in sources]


async def get_source_by_id(source_id: int) -> Optional[Dict[str, Any]]:
    """Get a single news source by ID."""
    async with get_db() as session:
        result = await session.execute(
            select(NewsSource).where(NewsSource.id == source_id)
        )
        source = result.scalar_one_or_none()
        return source.__dict__ if source else None


async def create_source(
    name: str,
    source_type: str,
    api_base_url: str,
    auth_key: str = "",
    config: dict = None
) -> int:
    """Create a new news source and return its ID."""
    async with get_db() as session:
        source = NewsSource(
            name=name,
            source_type=source_type,
            api_base_url=api_base_url,
            auth_key=auth_key,
            config=config or {}
        )
        session.add(source)
        await session.flush()
        await session.refresh(source)
        return source.id


async def update_source(source_id: int, **kwargs) -> bool:
    """Update a news source. Returns True if updated, False if not found."""
    async with get_db() as session:
        result = await session.execute(
            select(NewsSource).where(NewsSource.id == source_id)
        )
        source = result.scalar_one_or_none()
        if not source:
            return False
        for key, value in kwargs.items():
            if hasattr(source, key):
                setattr(source, key, value)
        source.updated_at = datetime.utcnow()
        return True


async def update_source_auth_state(
    source_id: int,
    *,
    auth_key: str,
    config: dict,
) -> bool:
    """Persist cached we-mp-rss auth state for a source."""
    return await update_source(
        source_id,
        auth_key=auth_key or "",
        config=config or {},
    )


async def delete_source(source_id: int) -> bool:
    """Delete a news source. Returns True if deleted, False if not found."""
    async with get_db() as session:
        result = await session.execute(
            select(NewsSource).where(NewsSource.id == source_id)
        )
        source = result.scalar_one_or_none()
        if not source:
            return False
        await session.delete(source)
        return True


async def update_source_fetch_time(source_id: int, article_count: int):
    """Update the last fetch time and article count for a source."""
    async with get_db() as session:
        result = await session.execute(
            select(NewsSource).where(NewsSource.id == source_id)
        )
        source = result.scalar_one_or_none()
        if source:
            source.last_fetch_at = datetime.utcnow()
            source.article_count = article_count


# --------------------------------------------------------------------------
# Articles CRUD
# --------------------------------------------------------------------------

async def get_articles(
    source_id: Optional[int] = None,
    limit: int = 50,
    offset: int = 0
) -> List[Dict[str, Any]]:
    """Get articles, optionally filtered by source_id."""
    async with get_db() as session:
        query = select(Article).order_by(Article.fetched_at.desc()).limit(limit).offset(offset)
        if source_id is not None:
            query = query.where(Article.source_id == source_id)
        result = await session.execute(query)
        articles = result.scalars().all()
        return [a.__dict__ for a in articles]


async def get_article_by_id(article_id: int) -> Optional[Dict[str, Any]]:
    """Get a single article by ID."""
    async with get_db() as session:
        result = await session.execute(
            select(Article).where(Article.id == article_id)
        )
        article = result.scalar_one_or_none()
        return article.__dict__ if article else None


async def get_article_by_external_id(
    source_id: int,
    external_id: str
) -> Optional[Dict[str, Any]]:
    """Get an article by source_id and external_id."""
    async with get_db() as session:
        result = await session.execute(
            select(Article).where(
                Article.source_id == source_id,
                Article.external_id == external_id
            )
        )
        article = result.scalar_one_or_none()
        return article.__dict__ if article else None


async def create_article(
    source_id: int,
    title: str,
    external_id: str = "",
    link: str = "",
    content: str = "",
    content_html: str = "",
    content_refresh_status: str = "ready",
    content_refresh_task_id: Optional[str] = None,
    content_refresh_requested_at: Optional[datetime] = None,
    content_refresh_checked_at: Optional[datetime] = None,
    content_refreshed_at: Optional[datetime] = None,
    content_refresh_error: Optional[str] = None,
    author: str = "",
    published_at: datetime = None
) -> int:
    """Create a new article and return its ID."""
    async with get_db() as session:
        article = Article(
            source_id=source_id,
            title=title,
            external_id=external_id,
            link=link,
            content=content,
            content_html=content_html,
            content_refresh_status=content_refresh_status,
            content_refresh_task_id=content_refresh_task_id,
            content_refresh_requested_at=content_refresh_requested_at,
            content_refresh_checked_at=content_refresh_checked_at,
            content_refreshed_at=content_refreshed_at,
            content_refresh_error=content_refresh_error,
            author=author,
            published_at=published_at
        )
        session.add(article)
        await session.flush()
        await session.refresh(article)
        return article.id


async def update_article_summary(article_id: int, summary: str):
    """Update the summary for an article."""
    async with get_db() as session:
        result = await session.execute(
            select(Article).where(Article.id == article_id)
        )
        article = result.scalar_one_or_none()
        if article:
            article.summary = summary


async def update_article_content_refresh(article_id: int, **kwargs) -> bool:
    """Update content refresh fields for one article."""
    async with get_db() as session:
        result = await session.execute(
            select(Article).where(Article.id == article_id)
        )
        article = result.scalar_one_or_none()
        if not article:
            return False

        for key, value in kwargs.items():
            if hasattr(article, key):
                setattr(article, key, value)
        return True


def _row_to_mapping(row) -> Optional[Dict[str, Any]]:
    """Convert SQLAlchemy row objects produced by explicit joins to plain dicts."""
    if row is None:
        return None
    return dict(row._mapping)


async def get_recent_now_candidates(hours: int = 48, limit: int = 60) -> List[Dict[str, Any]]:
    """Get recent anchor/article rows for the Now workbench using explicit joins."""
    cutoff = datetime.utcnow() - timedelta(hours=hours)

    async with get_db() as session:
        result = await session.execute(
            select(
                AnchorPoint.id.label("anchor_id"),
                AnchorPoint.article_id.label("anchor_article_id"),
                AnchorPoint.title.label("anchor_title"),
                AnchorPoint.content.label("anchor_content"),
                AnchorPoint.dialectical_analysis.label("dialectical_analysis"),
                AnchorPoint.anchor_type.label("anchor_type"),
                AnchorPoint.significance.label("significance"),
                AnchorPoint.source_article_link.label("source_article_link"),
                AnchorPoint.source_name.label("anchor_source_name"),
                AnchorPoint.tags.label("tags"),
                AnchorPoint.related_tag_weights.label("related_tag_weights"),
                AnchorPoint.created_at.label("anchor_created_at"),
                Article.id.label("article_id"),
                Article.source_id.label("source_id"),
                Article.title.label("article_title"),
                Article.link.label("article_link"),
                Article.content.label("article_content"),
                Article.summary.label("article_summary"),
                Article.author.label("article_author"),
                Article.published_at.label("published_at"),
                Article.fetched_at.label("fetched_at"),
                Article.read_at.label("read_at"),
                Article.processed_at.label("processed_at"),
                Article.last_opened_at.label("last_opened_at"),
                NewsSource.name.label("source_name"),
            )
            .select_from(AnchorPoint)
            .join(Article, AnchorPoint.article_id == Article.id)
            .outerjoin(NewsSource, Article.source_id == NewsSource.id)
            .where(
                or_(
                    AnchorPoint.created_at >= cutoff,
                    Article.fetched_at >= cutoff,
                    Article.published_at >= cutoff,
                )
            )
            .order_by(
                func.coalesce(Article.published_at, Article.fetched_at, AnchorPoint.created_at).desc(),
                AnchorPoint.significance.desc(),
            )
            .limit(limit)
        )
        return [_row_to_mapping(row) for row in result.all()]


async def get_articles_due_for_content_refresh(
    delay_minutes: int = 10,
    limit: int = 20,
) -> List[Dict[str, Any]]:
    """Get we-mp-rss articles ready to request protected content refresh."""
    cutoff = datetime.utcnow() - timedelta(minutes=delay_minutes)

    async with get_db() as session:
        result = await session.execute(
            select(
                Article.id.label("article_id"),
                Article.source_id.label("source_id"),
                Article.external_id.label("external_id"),
                Article.title.label("title"),
                Article.link.label("link"),
                Article.fetched_at.label("fetched_at"),
                Article.content_refresh_status.label("content_refresh_status"),
                Article.content_refresh_task_id.label("content_refresh_task_id"),
                NewsSource.source_type.label("source_type"),
                NewsSource.api_base_url.label("api_base_url"),
                NewsSource.auth_key.label("auth_key"),
                NewsSource.config.label("source_config"),
            )
            .select_from(Article)
            .join(NewsSource, Article.source_id == NewsSource.id)
            .where(
                NewsSource.source_type == "we_mp_rss",
                Article.content_refresh_status == "waiting_for_refresh",
                Article.external_id.is_not(None),
                Article.external_id != "",
                Article.fetched_at <= cutoff,
            )
            .order_by(Article.fetched_at.asc())
            .limit(limit)
        )
        return [_row_to_mapping(row) for row in result.all()]


async def get_articles_with_active_refresh_tasks(limit: int = 20) -> List[Dict[str, Any]]:
    """Get we-mp-rss articles whose protected refresh tasks should be polled."""
    async with get_db() as session:
        result = await session.execute(
            select(
                Article.id.label("article_id"),
                Article.source_id.label("source_id"),
                Article.external_id.label("external_id"),
                Article.title.label("title"),
                Article.link.label("link"),
                Article.content_refresh_status.label("content_refresh_status"),
                Article.content_refresh_task_id.label("content_refresh_task_id"),
                Article.content_refresh_requested_at.label("content_refresh_requested_at"),
                NewsSource.source_type.label("source_type"),
                NewsSource.api_base_url.label("api_base_url"),
                NewsSource.auth_key.label("auth_key"),
                NewsSource.config.label("source_config"),
            )
            .select_from(Article)
            .join(NewsSource, Article.source_id == NewsSource.id)
            .where(
                NewsSource.source_type == "we_mp_rss",
                Article.content_refresh_status.in_(["refresh_requested", "refresh_running"]),
                Article.content_refresh_task_id.is_not(None),
            )
            .order_by(Article.content_refresh_requested_at.asc().nullsfirst(), Article.id.asc())
            .limit(limit)
        )
        return [_row_to_mapping(row) for row in result.all()]


async def get_articles_ready_for_anchor_extraction(
    hours: int = 168,
    limit: int = 100,
) -> List[Dict[str, Any]]:
    """Get recent articles that are ready for anchor extraction."""
    cutoff = datetime.utcnow() - timedelta(hours=hours)

    async with get_db() as session:
        result = await session.execute(
            select(
                Article.id.label("article_id"),
                Article.source_id.label("source_id"),
                Article.external_id.label("external_id"),
                Article.title.label("title"),
                Article.link.label("link"),
                Article.content.label("content"),
                Article.content_html.label("content_html"),
                Article.summary.label("summary"),
                Article.author.label("author"),
                Article.published_at.label("published_at"),
                Article.fetched_at.label("fetched_at"),
                Article.content_refresh_status.label("content_refresh_status"),
                NewsSource.source_type.label("source_type"),
                NewsSource.name.label("source_name"),
            )
            .select_from(Article)
            .join(NewsSource, Article.source_id == NewsSource.id)
            .where(
                Article.fetched_at >= cutoff,
                or_(
                    NewsSource.source_type != "we_mp_rss",
                    Article.content_refresh_status == "detail_fetched",
                ),
            )
            .order_by(Article.fetched_at.desc(), Article.id.desc())
            .limit(limit)
        )
        return [_row_to_mapping(row) for row in result.all()]


async def get_now_detail_row(anchor_id: int) -> Optional[Dict[str, Any]]:
    """Get one explicit joined row for a Now workbench detail view."""
    async with get_db() as session:
        result = await session.execute(
            select(
                AnchorPoint.id.label("anchor_id"),
                AnchorPoint.article_id.label("anchor_article_id"),
                AnchorPoint.title.label("anchor_title"),
                AnchorPoint.content.label("anchor_content"),
                AnchorPoint.dialectical_analysis.label("dialectical_analysis"),
                AnchorPoint.anchor_type.label("anchor_type"),
                AnchorPoint.significance.label("significance"),
                AnchorPoint.source_article_link.label("source_article_link"),
                AnchorPoint.source_name.label("anchor_source_name"),
                AnchorPoint.tags.label("tags"),
                AnchorPoint.related_tag_weights.label("related_tag_weights"),
                AnchorPoint.created_at.label("anchor_created_at"),
                Article.id.label("article_id"),
                Article.source_id.label("source_id"),
                Article.title.label("article_title"),
                Article.link.label("article_link"),
                Article.content.label("article_content"),
                Article.summary.label("article_summary"),
                Article.author.label("article_author"),
                Article.published_at.label("published_at"),
                Article.fetched_at.label("fetched_at"),
                Article.read_at.label("read_at"),
                Article.processed_at.label("processed_at"),
                Article.last_opened_at.label("last_opened_at"),
                NewsSource.name.label("source_name"),
            )
            .select_from(AnchorPoint)
            .join(Article, AnchorPoint.article_id == Article.id)
            .outerjoin(NewsSource, Article.source_id == NewsSource.id)
            .where(AnchorPoint.id == anchor_id)
            .limit(1)
        )
        return _row_to_mapping(result.first())


async def touch_article_last_opened_by_anchor(anchor_id: int) -> Optional[Dict[str, Any]]:
    """Update last_opened_at for the article behind an anchor and return current state."""
    async with get_db() as session:
        result = await session.execute(
            select(Article)
            .select_from(Article)
            .join(AnchorPoint, AnchorPoint.article_id == Article.id)
            .where(AnchorPoint.id == anchor_id)
        )
        article = result.scalar_one_or_none()
        if not article:
            return None

        article.last_opened_at = datetime.utcnow()
        await session.flush()

        return {
            "anchor_id": anchor_id,
            "article_id": article.id,
            "last_opened_at": article.last_opened_at,
            "read_at": article.read_at,
            "processed_at": article.processed_at,
        }


async def update_article_workbench_state_by_anchor(
    anchor_id: int,
    *,
    mark_read: bool = False,
    mark_processed: bool = False,
) -> Optional[Dict[str, Any]]:
    """Update article workbench state for an anchor using explicit joins."""
    async with get_db() as session:
        result = await session.execute(
            select(Article)
            .select_from(Article)
            .join(AnchorPoint, AnchorPoint.article_id == Article.id)
            .where(AnchorPoint.id == anchor_id)
        )
        article = result.scalar_one_or_none()
        if not article:
            return None

        now = datetime.utcnow()
        if mark_read and article.read_at is None:
            article.read_at = now
        if mark_processed:
            if article.processed_at is None:
                article.processed_at = now
            if article.read_at is None:
                article.read_at = now
        if mark_read or mark_processed:
            article.last_opened_at = now

        await session.flush()

        return {
            "anchor_id": anchor_id,
            "article_id": article.id,
            "read_at": article.read_at,
            "processed_at": article.processed_at,
            "last_opened_at": article.last_opened_at,
        }


# --------------------------------------------------------------------------
# AI Config
# --------------------------------------------------------------------------

async def get_ai_config() -> Dict[str, Any]:
    """Get AI configuration."""
    async with get_db() as session:
        result = await session.execute(select(AIConfig).where(AIConfig.id == 1))
        config = result.scalar_one_or_none()
        return {k: v for k, v in config.__dict__.items() if not k.startswith("_")} if config else {}


async def update_ai_config(
    provider: str,
    base_url: str,
    model: str,
    api_key: Optional[str] = None,
    keep_existing_api_key: bool = True
):
    """Update AI configuration with optional API key replacement."""
    async with get_db() as session:
        result = await session.execute(select(AIConfig).where(AIConfig.id == 1))
        config = result.scalar_one_or_none()
        if config:
            config.provider = provider
            config.base_url = base_url
            config.model = model
            if api_key:
                config.api_key = api_key
            elif not keep_existing_api_key:
                config.api_key = ""
        else:
            if not api_key:
                raise ValueError("api_key_required_for_first_configuration")
            config = AIConfig(
                id=1,
                provider=provider,
                api_key=api_key,
                base_url=base_url,
                model=model
            )
            session.add(config)


# --------------------------------------------------------------------------
# Fetch Logs
# --------------------------------------------------------------------------

async def add_fetch_log(source_id: Optional[int], status: str, message: str):
    """Add a fetch log entry."""
    async with get_db() as session:
        log = FetchLog(source_id=source_id, status=status, message=message)
        session.add(log)


# --------------------------------------------------------------------------
# Anchor Points CRUD
# --------------------------------------------------------------------------

async def create_anchor(
    article_id: int,
    title: str,
    content: str,
    dialectical_analysis: str,
    anchor_type: str,
    significance: float,
    source_article_title: str,
    source_article_link: str,
    source_name: str,
    tags: list,
    related_tag_weights: dict
) -> int:
    """Create a new anchor point and return its ID."""
    async with get_db() as session:
        anchor = AnchorPoint(
            article_id=article_id,
            title=title,
            content=content,
            dialectical_analysis=dialectical_analysis,
            anchor_type=anchor_type,
            significance=significance,
            source_article_title=source_article_title,
            source_article_link=source_article_link,
            source_name=source_name,
            tags=tags,
            related_tag_weights=related_tag_weights
        )
        session.add(anchor)
        await session.flush()
        await session.refresh(anchor)
        return anchor.id


async def get_anchors(
    limit: int = 100,
    offset: int = 0,
    tags: Optional[list] = None
) -> List[Dict[str, Any]]:
    """Get anchor points with optional tag filtering using JSONB containment."""
    async with get_db() as session:
        query = select(AnchorPoint).order_by(
            AnchorPoint.significance.desc(),
            AnchorPoint.created_at.desc()
        ).limit(limit).offset(offset)

        if tags:
            query = query.where(AnchorPoint.tags.contains(tags))

        result = await session.execute(query)
        anchors = result.scalars().all()
        return [a.__dict__ for a in anchors]


async def get_anchor_by_id(anchor_id: int) -> Optional[Dict[str, Any]]:
    """Get a single anchor point by ID."""
    async with get_db() as session:
        result = await session.execute(
            select(AnchorPoint).where(AnchorPoint.id == anchor_id)
        )
        anchor = result.scalar_one_or_none()
        return anchor.__dict__ if anchor else None


async def get_anchors_by_article(article_id: int) -> List[Dict[str, Any]]:
    """Get all anchor points for a specific article."""
    async with get_db() as session:
        result = await session.execute(
            select(AnchorPoint).where(AnchorPoint.article_id == article_id)
        )
        anchors = result.scalars().all()
        return [a.__dict__ for a in anchors]


# --------------------------------------------------------------------------
# Daily Digest CRUD
# --------------------------------------------------------------------------

async def create_digest(
    date_str: str,
    title: str,
    overview: str,
    sections: list,
    total_articles: int,
    anchor_count: int
) -> int:
    """Create a new daily digest and return its ID."""
    from datetime import date
    async with get_db() as session:
        digest = DailyDigest(
            date=date.fromisoformat(date_str),
            title=title,
            overview=overview,
            sections=sections,
            total_articles_processed=total_articles,
            anchor_count=anchor_count
        )
        session.add(digest)
        await session.flush()
        await session.refresh(digest)
        return digest.id


async def get_digest_by_date(date_str: str) -> Optional[Dict[str, Any]]:
    """Get a daily digest by date string."""
    from datetime import date
    async with get_db() as session:
        result = await session.execute(
            select(DailyDigest).where(DailyDigest.date == date.fromisoformat(date_str))
        )
        digest = result.scalar_one_or_none()
        return {k: v for k, v in digest.__dict__.items() if not k.startswith("_")} if digest else None


async def get_latest_digest() -> Optional[Dict[str, Any]]:
    """Get the most recent daily digest."""
    async with get_db() as session:
        result = await session.execute(
            select(DailyDigest).order_by(DailyDigest.date.desc()).limit(1)
        )
        digest = result.scalar_one_or_none()
        return {k: v for k, v in digest.__dict__.items() if not k.startswith("_")} if digest else None


async def get_digests(
    limit: int = 30,
    offset: int = 0,
    week_start: Optional[date] = None,
    week_end: Optional[date] = None
) -> List[Dict[str, Any]]:
    """Get daily digests ordered by date descending with optional date range."""
    async with get_db() as session:
        query = select(DailyDigest)
        if week_start:
            query = query.where(DailyDigest.date >= week_start)
        if week_end:
            query = query.where(DailyDigest.date <= week_end)
        result = await session.execute(
            query.order_by(DailyDigest.date.desc()).limit(limit).offset(offset)
        )
        digests = result.scalars().all()
        return [{k: v for k, v in d.__dict__.items() if not k.startswith("_")} for d in digests]


async def get_digests_count(
    week_start: Optional[date] = None,
    week_end: Optional[date] = None
) -> int:
    """Get digest count with optional date range."""
    async with get_db() as session:
        query = select(func.count(DailyDigest.id))
        if week_start:
            query = query.where(DailyDigest.date >= week_start)
        if week_end:
            query = query.where(DailyDigest.date <= week_end)
        result = await session.execute(query)
        return int(result.scalar_one())


async def get_all_anchors_for_digest() -> List[Dict[str, Any]]:
    """Get all anchors for digest generation."""
    async with get_db() as session:
        result = await session.execute(
            select(AnchorPoint).order_by(AnchorPoint.created_at.desc())
        )
        anchors = result.scalars().all()
        return [a.__dict__ for a in anchors]


# --------------------------------------------------------------------------
# Interest Tag CRUD
# --------------------------------------------------------------------------

async def get_all_interest_tags() -> List[Dict[str, Any]]:
    """Get all user interest tags."""
    async with get_db() as session:
        result = await session.execute(
            select(UserInterestTag).order_by(UserInterestTag.tag)
        )
        tags = result.scalars().all()
        return [t.__dict__ for t in tags]


async def get_interest_tag_by_id(tag_id: int) -> Optional[Dict[str, Any]]:
    """Get a single interest tag by ID."""
    async with get_db() as session:
        result = await session.execute(
            select(UserInterestTag).where(UserInterestTag.id == tag_id)
        )
        tag = result.scalar_one_or_none()
        return tag.__dict__ if tag else None


async def get_interest_tag_by_name(tag: str) -> Optional[Dict[str, Any]]:
    """Get a single interest tag by name."""
    async with get_db() as session:
        result = await session.execute(
            select(UserInterestTag).where(UserInterestTag.tag == tag)
        )
        tag = result.scalar_one_or_none()
        return tag.__dict__ if tag else None


async def create_interest_tag(tag: str) -> int:
    """Create a new interest tag and return its ID."""
    async with get_db() as session:
        interest_tag = UserInterestTag(tag=tag)
        session.add(interest_tag)
        await session.flush()
        await session.refresh(interest_tag)
        return interest_tag.id


async def update_interest_tag(tag_id: int, **kwargs) -> bool:
    """Update an interest tag. Returns True if updated, False if not found."""
    async with get_db() as session:
        result = await session.execute(
            select(UserInterestTag).where(UserInterestTag.id == tag_id)
        )
        tag = result.scalar_one_or_none()
        if not tag:
            return False
        for key, value in kwargs.items():
            if hasattr(tag, key):
                setattr(tag, key, value)
        return True


async def delete_interest_tag(tag_id: int) -> bool:
    """Delete an interest tag. Returns True if deleted, False if not found."""
    async with get_db() as session:
        result = await session.execute(
            select(UserInterestTag).where(UserInterestTag.id == tag_id)
        )
        tag = result.scalar_one_or_none()
        if not tag:
            return False
        await session.delete(tag)
        return True


async def get_interest_tag_stats() -> dict:
    """Get aggregated statistics for interest tags."""
    async with get_db() as session:
        result = await session.execute(select(UserInterestTag))
        tags = result.scalars().all()

        total_views = sum(t.view_count or 0 for t in tags)
        total_shows = sum(t.show_count or 0 for t in tags)
        total_hides = sum(t.hide_count or 0 for t in tags)
        total_clicks = sum(t.click_count or 0 for t in tags)
        total_time = sum(t.total_time_spent or 0.0 for t in tags)

        return {
            "total_tags": len(tags),
            "total_views": total_views,
            "total_shows": total_shows,
            "total_hides": total_hides,
            "total_clicks": total_clicks,
            "total_time_spent": total_time
        }


# --------------------------------------------------------------------------
# Behavior Log CRUD
# --------------------------------------------------------------------------

async def create_behavior_log(
    digest_id: Optional[int],
    anchor_id: int,
    tag: str,
    signal_type: str,
    action: str,
    value: float = 0.0
) -> int:
    """Create a new behavior log entry and return its ID."""
    async with get_db() as session:
        log = UserBehaviorLog(
            digest_id=digest_id,
            anchor_id=anchor_id,
            tag=tag,
            signal_type=signal_type,
            action=action,
            value=value
        )
        session.add(log)
        await session.flush()
        await session.refresh(log)
        return log.id


async def create_behavior_logs_batch(logs: list[dict]) -> int:
    """Create multiple behavior log entries. Returns count created."""
    async with get_db() as session:
        log_objects = [
            UserBehaviorLog(**log_data) for log_data in logs
        ]
        session.add_all(log_objects)
        await session.flush()
        return len(log_objects)


async def get_behavior_logs(
    digest_id: Optional[int] = None,
    anchor_id: Optional[int] = None,
    limit: int = 100
) -> List[Dict[str, Any]]:
    """Get behavior logs with optional filtering."""
    async with get_db() as session:
        query = select(UserBehaviorLog).order_by(
            UserBehaviorLog.created_at.desc()
        ).limit(limit)

        if digest_id is not None:
            query = query.where(UserBehaviorLog.digest_id == digest_id)
        if anchor_id is not None:
            query = query.where(UserBehaviorLog.anchor_id == anchor_id)

        result = await session.execute(query)
        logs = result.scalars().all()
        return [l.__dict__ for l in logs]


# --------------------------------------------------------------------------
# Digest Feedback CRUD
# --------------------------------------------------------------------------

async def create_digest_feedback(digest_id: int, anchor_id: int, action: str) -> int:
    """Create a new digest feedback entry and return its ID."""
    async with get_db() as session:
        feedback = DigestFeedback(
            digest_id=digest_id,
            anchor_id=anchor_id,
            action=action
        )
        session.add(feedback)
        await session.flush()
        await session.refresh(feedback)
        return feedback.id


async def get_digest_feedback(digest_id: int) -> List[Dict[str, Any]]:
    """Get all feedback entries for a specific digest."""
    async with get_db() as session:
        result = await session.execute(
            select(DigestFeedback).where(DigestFeedback.digest_id == digest_id)
        )
        feedbacks = result.scalars().all()
        return [f.__dict__ for f in feedbacks]
