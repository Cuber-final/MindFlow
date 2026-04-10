from sqlalchemy import Column, Integer, String, Text, Float, Date, DateTime, ForeignKey, JSON, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import declarative_base
from datetime import datetime

Base = declarative_base()


class NewsSource(Base):
    __tablename__ = "news_sources"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    source_type = Column(String, default="custom")
    api_base_url = Column(String, nullable=False)
    auth_key = Column(String, default="")
    config = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_fetch_at = Column(DateTime)
    article_count = Column(Integer, default=0)


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
    tags = Column(JSONB, default=list)
    related_tag_weights = Column(JSONB, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)

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
    sections = Column(JSONB, default=list)
    total_articles_processed = Column(Integer, default=0)
    anchor_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

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
