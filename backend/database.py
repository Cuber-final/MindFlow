import sqlite3
import json
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any

DATABASE_PATH = Path(__file__).parent.parent / "data" / "ai_crawler.db"


def get_db():
    """Get database connection"""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initialize database schema"""
    conn = get_db()
    try:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS news_sources (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                source_type TEXT NOT NULL DEFAULT 'custom',
                api_base_url TEXT NOT NULL,
                auth_key TEXT DEFAULT '',
                config TEXT DEFAULT '{}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_fetch_at TIMESTAMP,
                article_count INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS articles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_id INTEGER NOT NULL,
                external_id TEXT DEFAULT '',
                title TEXT NOT NULL,
                link TEXT DEFAULT '',
                content TEXT DEFAULT '',
                summary TEXT DEFAULT '',
                author TEXT DEFAULT '',
                published_at TIMESTAMP,
                fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (source_id) REFERENCES news_sources(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS ai_config (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                provider TEXT NOT NULL DEFAULT 'siliconflow',
                api_key TEXT NOT NULL,
                base_url TEXT NOT NULL,
                model TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS fetch_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_id INTEGER,
                status TEXT,
                message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS anchor_points (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                article_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                dialectical_analysis TEXT,
                anchor_type TEXT DEFAULT 'opinion',
                significance REAL DEFAULT 0.5,
                source_article_title TEXT,
                source_article_link TEXT,
                source_name TEXT,
                tags TEXT DEFAULT '[]',
                related_tag_weights TEXT DEFAULT '{}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS daily_digests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date DATE UNIQUE NOT NULL,
                title TEXT NOT NULL,
                overview TEXT,
                sections TEXT,
                total_articles_processed INTEGER DEFAULT 0,
                anchor_count INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS user_interest_tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tag TEXT UNIQUE NOT NULL,
                weight REAL DEFAULT 1.0,
                status TEXT DEFAULT 'active',
                view_count INTEGER DEFAULT 0,
                show_count INTEGER DEFAULT 0,
                hide_count INTEGER DEFAULT 0,
                total_time_spent REAL DEFAULT 0,
                click_count INTEGER DEFAULT 0,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS user_behavior_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                digest_id INTEGER,
                anchor_id INTEGER,
                tag TEXT,
                signal_type TEXT,
                action TEXT,
                value REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS digest_feedback (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                digest_id INTEGER NOT NULL,
                anchor_id INTEGER NOT NULL,
                action TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            INSERT OR IGNORE INTO ai_config (id, provider, api_key, base_url, model)
            VALUES (1, 'siliconflow', '', 'https://api.siliconflow.cn/v1', 'Qwen/Qwen2.5-7B-Instruct');
        """)
        conn.commit()
    finally:
        conn.close()


# News Sources CRUD
def get_all_sources() -> List[Dict[str, Any]]:
    conn = get_db()
    try:
        rows = conn.execute("SELECT * FROM news_sources ORDER BY created_at DESC").fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def get_source_by_id(source_id: int) -> Optional[Dict[str, Any]]:
    conn = get_db()
    try:
        row = conn.execute("SELECT * FROM news_sources WHERE id = ?", (source_id,)).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def create_source(name: str, source_type: str, api_base_url: str, auth_key: str = "", config: dict = None) -> int:
    conn = get_db()
    try:
        cursor = conn.execute(
            """INSERT INTO news_sources (name, source_type, api_base_url, auth_key, config)
               VALUES (?, ?, ?, ?, ?)""",
            (name, source_type, api_base_url, auth_key, json.dumps(config or {}))
        )
        conn.commit()
        return cursor.lastrowid
    finally:
        conn.close()


def update_source(source_id: int, **kwargs) -> bool:
    fields = []
    values = []
    for k, v in kwargs.items():
        if k in ("name", "source_type", "api_base_url", "auth_key", "config"):
            fields.append(f"{k} = ?")
            values.append(json.dumps(v) if k == "config" else v)
    if not fields:
        return False
    fields.append("updated_at = CURRENT_TIMESTAMP")
    values.append(source_id)
    conn = get_db()
    try:
        conn.execute(f"UPDATE news_sources SET {', '.join(fields)} WHERE id = ?", values)
        conn.commit()
        return True
    finally:
        conn.close()


def delete_source(source_id: int) -> bool:
    conn = get_db()
    try:
        conn.execute("DELETE FROM articles WHERE source_id = ?", (source_id,))
        conn.execute("DELETE FROM news_sources WHERE id = ?", (source_id,))
        conn.commit()
        return True
    finally:
        conn.close()


def update_source_fetch_time(source_id: int, article_count: int):
    conn = get_db()
    try:
        conn.execute(
            """UPDATE news_sources
               SET last_fetch_at = CURRENT_TIMESTAMP, article_count = ?
               WHERE id = ?""",
            (article_count, source_id)
        )
        conn.commit()
    finally:
        conn.close()


# Articles CRUD
def get_articles(source_id: Optional[int] = None, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
    sql = "SELECT * FROM articles"
    params = []
    if source_id:
        sql += " WHERE source_id = ?"
        params.append(source_id)
    sql += " ORDER BY published_at DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    conn = get_db()
    try:
        rows = conn.execute(sql, params).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def get_article_by_id(article_id: int) -> Optional[Dict[str, Any]]:
    conn = get_db()
    try:
        row = conn.execute("SELECT * FROM articles WHERE id = ?", (article_id,)).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def get_article_by_external_id(source_id: int, external_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT * FROM articles WHERE source_id = ? AND external_id = ?",
            (source_id, external_id)
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def create_article(source_id: int, title: str, external_id: str = "", link: str = "",
                   content: str = "", author: str = "", published_at: datetime = None) -> int:
    conn = get_db()
    try:
        cursor = conn.execute(
            """INSERT INTO articles (source_id, external_id, title, link, content, author, published_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (source_id, external_id, title, link, content, author, published_at)
        )
        conn.commit()
        return cursor.lastrowid
    finally:
        conn.close()


def update_article_summary(article_id: int, summary: str):
    conn = get_db()
    try:
        conn.execute("UPDATE articles SET summary = ? WHERE id = ?", (summary, article_id))
        conn.commit()
    finally:
        conn.close()


# AI Config
def get_ai_config() -> Dict[str, Any]:
    conn = get_db()
    try:
        row = conn.execute("SELECT * FROM ai_config WHERE id = 1").fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def update_ai_config(provider: str, api_key: str, base_url: str, model: str):
    conn = get_db()
    try:
        conn.execute(
            """INSERT OR REPLACE INTO ai_config (id, provider, api_key, base_url, model, updated_at)
               VALUES (1, ?, ?, ?, ?, CURRENT_TIMESTAMP)""",
            (provider, api_key, base_url, model)
        )
        conn.commit()
    finally:
        conn.close()


# Fetch Logs
def add_fetch_log(source_id: Optional[int], status: str, message: str):
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO fetch_logs (source_id, status, message) VALUES (?, ?, ?)",
            (source_id, status, message)
        )
        conn.commit()
    finally:
        conn.close()


# Anchor Points CRUD
def create_anchor(
    article_id: int,
    title: str,
    content: str,
    dialectical_analysis: str,
    anchor_type: str,
    significance: float,
    source_article_title: str,
    source_article_link: str,
    source_name: str,
    tags: list[str],
    related_tag_weights: dict[str, float]
) -> int:
    conn = get_db()
    try:
        cursor = conn.execute(
            """INSERT INTO anchor_points
               (article_id, title, content, dialectical_analysis, anchor_type, significance,
                source_article_title, source_article_link, source_name, tags, related_tag_weights)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                article_id, title, content, dialectical_analysis, anchor_type, significance,
                source_article_title, source_article_link, source_name,
                json.dumps(tags), json.dumps(related_tag_weights)
            )
        )
        conn.commit()
        return cursor.lastrowid
    finally:
        conn.close()


def get_anchors(
    limit: int = 100,
    offset: int = 0,
    tags: Optional[list[str]] = None
) -> List[Dict[str, Any]]:
    sql = "SELECT * FROM anchor_points"
    params = []
    if tags:
        placeholders = ",".join("?" * len(tags))
        sql += f" WHERE tags LIKE '%' || ? || '%'"
        params.append(tags[0])
    sql += " ORDER BY significance DESC, created_at DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    conn = get_db()
    try:
        rows = conn.execute(sql, params).fetchall()
        return [_parse_anchor_row(dict(row)) for row in rows]
    finally:
        conn.close()


def get_anchor_by_id(anchor_id: int) -> Optional[Dict[str, Any]]:
    conn = get_db()
    try:
        row = conn.execute("SELECT * FROM anchor_points WHERE id = ?", (anchor_id,)).fetchone()
        return _parse_anchor_row(dict(row)) if row else None
    finally:
        conn.close()


def get_anchors_by_article(article_id: int) -> List[Dict[str, Any]]:
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT * FROM anchor_points WHERE article_id = ? ORDER BY significance DESC",
            (article_id,)
        ).fetchall()
        return [_parse_anchor_row(dict(row)) for row in rows]
    finally:
        conn.close()


def _parse_anchor_row(row: dict) -> dict:
    """Parse anchor row and convert JSON fields"""
    row["tags"] = json.loads(row.get("tags", "[]"))
    row["related_tag_weights"] = json.loads(row.get("related_tag_weights", "{}"))
    return row


# Daily Digest CRUD
def create_digest(
    date_str: str,
    title: str,
    overview: str,
    sections: list[dict],
    total_articles: int,
    anchor_count: int
) -> int:
    conn = get_db()
    try:
        cursor = conn.execute(
            """INSERT INTO daily_digests
               (date, title, overview, sections, total_articles_processed, anchor_count)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (date_str, title, overview, json.dumps(sections, ensure_ascii=False), total_articles, anchor_count)
        )
        conn.commit()
        return cursor.lastrowid
    finally:
        conn.close()


def get_digest_by_date(date_str: str) -> Optional[Dict[str, Any]]:
    conn = get_db()
    try:
        row = conn.execute("SELECT * FROM daily_digests WHERE date = ?", (date_str,)).fetchone()
        return _parse_digest_row(dict(row)) if row else None
    finally:
        conn.close()


def get_latest_digest() -> Optional[Dict[str, Any]]:
    conn = get_db()
    try:
        row = conn.execute("SELECT * FROM daily_digests ORDER BY date DESC LIMIT 1").fetchone()
        return _parse_digest_row(dict(row)) if row else None
    finally:
        conn.close()


def get_digests(limit: int = 30, offset: int = 0) -> List[Dict[str, Any]]:
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT * FROM daily_digests ORDER BY date DESC LIMIT ? OFFSET ?",
            (limit, offset)
        ).fetchall()
        return [_parse_digest_row(dict(row)) for row in rows]
    finally:
        conn.close()


def _parse_digest_row(row: dict) -> dict:
    """Parse digest row and convert JSON fields"""
    row["sections"] = json.loads(row.get("sections", "[]"))
    return row


def get_all_anchors_for_digest() -> List[Dict[str, Any]]:
    """Get all recent anchors for digest generation"""
    conn = get_db()
    try:
        # Get anchors from last 7 days
        rows = conn.execute(
            """SELECT * FROM anchor_points
               WHERE created_at >= datetime('now', '-7 days')
               ORDER BY significance DESC, created_at DESC"""
        ).fetchall()
        return [_parse_anchor_row(dict(row)) for row in rows]
    finally:
        conn.close()


# === Interest Tag CRUD ===

def get_all_interest_tags() -> List[Dict[str, Any]]:
    """Get all interest tags"""
    conn = get_db()
    try:
        rows = conn.execute("SELECT * FROM user_interest_tags ORDER BY weight DESC").fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def get_interest_tag_by_id(tag_id: int) -> Optional[Dict[str, Any]]:
    conn = get_db()
    try:
        row = conn.execute("SELECT * FROM user_interest_tags WHERE id = ?", (tag_id,)).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def get_interest_tag_by_name(tag: str) -> Optional[Dict[str, Any]]:
    conn = get_db()
    try:
        row = conn.execute("SELECT * FROM user_interest_tags WHERE tag = ?", (tag,)).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def create_interest_tag(tag: str) -> int:
    conn = get_db()
    try:
        cursor = conn.execute(
            "INSERT INTO user_interest_tags (tag) VALUES (?)",
            (tag,)
        )
        conn.commit()
        return cursor.lastrowid
    finally:
        conn.close()


def update_interest_tag(tag_id: int, **kwargs) -> bool:
    allowed_fields = ("weight", "status", "view_count", "show_count", "hide_count", "total_time_spent", "click_count")
    fields = []
    values = []
    for k, v in kwargs.items():
        if k in allowed_fields:
            fields.append(f"{k} = ?")
            values.append(v)
    if not fields:
        return False
    fields.append("last_updated = CURRENT_TIMESTAMP")
    values.append(tag_id)
    conn = get_db()
    try:
        conn.execute(f"UPDATE user_interest_tags SET {', '.join(fields)} WHERE id = ?", values)
        conn.commit()
        return True
    finally:
        conn.close()


def delete_interest_tag(tag_id: int) -> bool:
    conn = get_db()
    try:
        conn.execute("DELETE FROM user_interest_tags WHERE id = ?", (tag_id,))
        conn.commit()
        return True
    finally:
        conn.close()


def get_interest_tag_stats() -> dict:
    """Get interest tag statistics"""
    conn = get_db()
    try:
        row = conn.execute("""
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
                SUM(CASE WHEN status = 'frozen' THEN 1 ELSE 0 END) as frozen,
                SUM(CASE WHEN status = 'candidate' THEN 1 ELSE 0 END) as candidate
            FROM user_interest_tags
        """).fetchone()
        return dict(row) if row else {"total": 0, "active": 0, "frozen": 0, "candidate": 0}
    finally:
        conn.close()


# === Behavior Log CRUD ===

def create_behavior_log(
    digest_id: Optional[int],
    anchor_id: int,
    tag: str,
    signal_type: str,
    action: str,
    value: float = 0.0
) -> int:
    conn = get_db()
    try:
        cursor = conn.execute(
            """INSERT INTO user_behavior_logs
               (digest_id, anchor_id, tag, signal_type, action, value)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (digest_id, anchor_id, tag, signal_type, action, value)
        )
        conn.commit()
        return cursor.lastrowid
    finally:
        conn.close()


def create_behavior_logs_batch(logs: list[dict]) -> int:
    """Batch create behavior logs, return count of created logs"""
    conn = get_db()
    try:
        for log in logs:
            conn.execute(
                """INSERT INTO user_behavior_logs
                   (digest_id, anchor_id, tag, signal_type, action, value)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (
                    log.get("digest_id"),
                    log["anchor_id"],
                    log["tag"],
                    log["signal_type"],
                    log["action"],
                    log.get("value", 0.0)
                )
            )
        conn.commit()
        return len(logs)
    finally:
        conn.close()


def get_behavior_logs(
    digest_id: Optional[int] = None,
    anchor_id: Optional[int] = None,
    limit: int = 100
) -> List[Dict[str, Any]]:
    sql = "SELECT * FROM user_behavior_logs WHERE 1=1"
    params = []
    if digest_id is not None:
        sql += " AND digest_id = ?"
        params.append(digest_id)
    if anchor_id is not None:
        sql += " AND anchor_id = ?"
        params.append(anchor_id)
    sql += " ORDER BY created_at DESC LIMIT ?"
    params.append(limit)
    conn = get_db()
    try:
        rows = conn.execute(sql, params).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


# === Digest Feedback CRUD ===

def create_digest_feedback(digest_id: int, anchor_id: int, action: str) -> int:
    conn = get_db()
    try:
        cursor = conn.execute(
            """INSERT INTO digest_feedback (digest_id, anchor_id, action) VALUES (?, ?, ?)""",
            (digest_id, anchor_id, action)
        )
        conn.commit()
        return cursor.lastrowid
    finally:
        conn.close()


def get_digest_feedback(digest_id: int) -> List[Dict[str, Any]]:
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT * FROM digest_feedback WHERE digest_id = ? ORDER BY created_at DESC",
            (digest_id,)
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()
