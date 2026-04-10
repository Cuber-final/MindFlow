#!/usr/bin/env python3
"""
SQLite to PostgreSQL data migration script

Usage:
1. Ensure PostgreSQL is running and database is created
2. Run `python export_sqlite_to_postgres.py`
"""
import sqlite3
import json
from datetime import datetime
from sqlalchemy import text
from backend.database import sync_engine, init_db_sync


def load_sqlite_data(db_path: str):
    """Load all data from SQLite database"""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    data = {}
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
    """Transfer all data to PostgreSQL"""
    with sync_engine.begin() as conn:
        # news_sources - config is JSON
        for row in data.get("news_sources", []):
            conn.execute(text("""
                INSERT INTO news_sources (id, name, source_type, api_base_url, auth_key, config,
                                         created_at, updated_at, last_fetch_at, article_count)
                VALUES (:id, :name, :source_type, :api_base_url, :auth_key, :config,
                        :created_at, :updated_at, :last_fetch_at, :article_count)
                ON CONFLICT (id) DO NOTHING
            """), {
                **row,
                "config": json.dumps(row.get("config", {})) if isinstance(row.get("config"), dict) else row.get("config", "{}"),
                "created_at": row.get("created_at") or datetime.utcnow().isoformat(),
                "updated_at": row.get("updated_at") or datetime.utcnow().isoformat(),
            })

        # articles
        for row in data.get("articles", []):
            conn.execute(text("""
                INSERT INTO articles (id, source_id, external_id, title, link, content,
                                     summary, author, published_at, fetched_at)
                VALUES (:id, :source_id, :external_id, :title, :link, :content,
                        :summary, :author, :published_at, :fetched_at)
                ON CONFLICT (id) DO NOTHING
            """), {
                **row,
                "published_at": row.get("published_at") or None,
                "fetched_at": row.get("fetched_at") or datetime.utcnow().isoformat(),
            })

        # ai_config
        for row in data.get("ai_config", []):
            conn.execute(text("""
                INSERT INTO ai_config (id, provider, api_key, base_url, model, updated_at)
                VALUES (:id, :provider, :api_key, :base_url, :model, :updated_at)
                ON CONFLICT (id) DO NOTHING
            """), {
                **row,
                "updated_at": row.get("updated_at") or datetime.utcnow().isoformat(),
            })

        # fetch_logs
        for row in data.get("fetch_logs", []):
            conn.execute(text("""
                INSERT INTO fetch_logs (id, source_id, status, message, created_at)
                VALUES (:id, :source_id, :status, :message, :created_at)
                ON CONFLICT (id) DO NOTHING
            """), {
                **row,
                "created_at": row.get("created_at") or datetime.utcnow().isoformat(),
            })

        # anchor_points - JSON fields
        for row in data.get("anchor_points", []):
            tags = row.get("tags", "[]")
            related = row.get("related_tag_weights", "{}")
            if isinstance(tags, str):
                tags = json.loads(tags) if tags else []
            if isinstance(related, str):
                related = json.loads(related) if related else {}
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
                "tags": json.dumps(tags),
                "related_tag_weights": json.dumps(related),
                "created_at": row.get("created_at") or datetime.utcnow().isoformat(),
            })

        # daily_digests - JSON fields
        for row in data.get("daily_digests", []):
            sections = row.get("sections", "[]")
            if isinstance(sections, str):
                sections = json.loads(sections) if sections else []
            conn.execute(text("""
                INSERT INTO daily_digests (id, date, title, overview, sections,
                                          total_articles_processed, anchor_count, created_at)
                VALUES (:id, :date, :title, :overview, :sections,
                        :total_articles_processed, :anchor_count, :created_at)
                ON CONFLICT (id) DO NOTHING
            """), {
                **row,
                "sections": json.dumps(sections),
                "created_at": row.get("created_at") or datetime.utcnow().isoformat(),
            })

        # user_interest_tags
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
                "last_updated": row.get("last_updated") or datetime.utcnow().isoformat(),
                "created_at": row.get("created_at") or datetime.utcnow().isoformat(),
            })

        # user_behavior_logs
        for row in data.get("user_behavior_logs", []):
            conn.execute(text("""
                INSERT INTO user_behavior_logs (id, digest_id, anchor_id, tag, signal_type,
                                               action, value, created_at)
                VALUES (:id, :digest_id, :anchor_id, :tag, :signal_type,
                        :action, :value, :created_at)
                ON CONFLICT (id) DO NOTHING
            """), {
                **row,
                "created_at": row.get("created_at") or datetime.utcnow().isoformat(),
            })

        # digest_feedback
        for row in data.get("digest_feedback", []):
            conn.execute(text("""
                INSERT INTO digest_feedback (id, digest_id, anchor_id, action, created_at)
                VALUES (:id, :digest_id, :anchor_id, :action, :created_at)
                ON CONFLICT (id) DO NOTHING
            """), {
                **row,
                "created_at": row.get("created_at") or datetime.utcnow().isoformat(),
            })

        print("Data migration completed!")


def main():
    sqlite_path = "../data/ai_crawler.db"
    print(f"Loading data from {sqlite_path}...")

    print("Initializing PostgreSQL schema...")
    init_db_sync()

    print("Loading SQLite data...")
    data = load_sqlite_data(sqlite_path)

    print("Migrating data to PostgreSQL...")
    migrate_data(data)

    print("\nMigration statistics:")
    for table, rows in data.items():
        print(f"  {table}: {len(rows)} records")


if __name__ == "__main__":
    main()
