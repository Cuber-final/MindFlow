from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from services.crawler import fetch_all_sources
from database import (
    create_anchor,
    get_all_anchors_for_digest,
    get_articles_due_for_content_refresh,
    get_articles_ready_for_anchor_extraction,
    get_anchors_by_article,
    get_digest_by_date,
    update_source_auth_state,
    update_article_content_refresh,
)
from services.ai import extract_anchor
from services.we_mprss import refresh_article_content_and_fetch_detail


scheduler = AsyncIOScheduler()


def init_scheduler():
    """Initialize the scheduler with default jobs"""
    # Default: run at 8:00, 12:00, 18:00 every day for fetching
    scheduler.add_job(
        fetch_all_sources_job,
        CronTrigger(hour="8,12,18", minute="0"),
        id="daily_fetch",
        replace_existing=True
    )

    # Generate digest at 9:00 every day
    scheduler.add_job(
        generate_digest_job,
        CronTrigger(hour="9", minute="0"),
        id="daily_digest",
        replace_existing=True
    )

    scheduler.add_job(
        process_pending_we_mp_rss_articles,
        CronTrigger(minute="*"),
        id="we_mp_rss_content_refresh",
        replace_existing=True
    )

    scheduler.add_job(
        extract_anchors_from_recent_articles,
        CronTrigger(minute="*/5"),
        id="anchor_extract",
        replace_existing=True
    )


async def process_pending_we_mp_rss_articles() -> int:
    """Refresh due we-mp-rss articles and persist the backfilled content."""
    due_articles = await get_articles_due_for_content_refresh()
    processed = 0

    for row in due_articles:
        source = {
            "id": row.get("source_id"),
            "source_type": row.get("source_type"),
            "api_base_url": row.get("api_base_url"),
            "auth_key": row.get("auth_key"),
            "config": row.get("source_config") or {},
        }
        article = {
            "id": row.get("article_id"),
            "external_id": row.get("external_id"),
            "content_refresh_status": row.get("content_refresh_status"),
        }

        refresh_result = await refresh_article_content_and_fetch_detail(
            source=source,
            article=article,
            poll_interval_seconds=1.0,
        )
        article_update = dict(refresh_result)
        source_update = article_update.pop("source_update", None)
        if isinstance(source_update, dict):
            await update_source_auth_state(
                row["source_id"],
                auth_key=source_update.get("auth_key") or "",
                config=source_update.get("config") or {},
            )
        await update_article_content_refresh(row["article_id"], **article_update)
        processed += 1

    return processed


async def extract_anchors_from_recent_articles():
    """Extract anchors from recent articles that don't have anchors yet"""
    articles = await get_articles_ready_for_anchor_extraction(limit=50)
    print(f"[Scheduler] 找到 {len(articles)} 篇可提锚点文章，开始提取锚点...")
    extracted = 0

    for article in articles:
        article_id = article["article_id"]
        # Check if anchors already exist for this article
        existing = await get_anchors_by_article(article_id)
        if existing:
            continue

        # Extract anchor
        try:
            anchor_data = await extract_anchor(
                title=article["title"],
                content=article.get("content", "") or article.get("summary", ""),
                article_link=article.get("link", ""),
                source_name=article.get("source_name", "")
            )

            # Save to database
            await create_anchor(
                article_id=article_id,
                title=anchor_data["title"],
                content=anchor_data["content"],
                dialectical_analysis=anchor_data["dialectical_analysis"],
                anchor_type=anchor_data.get("anchor_type", "opinion"),
                significance=anchor_data.get("significance", 0.5),
                source_article_title=anchor_data.get("source_article_title", article["title"]),
                source_article_link=anchor_data.get("source_article_link", article.get("link", "")),
                source_name=anchor_data.get("source_name", article.get("source_name", "")),
                tags=anchor_data.get("tags", []),
                related_tag_weights=anchor_data.get("related_tag_weights", {})
            )
            print(f"[Scheduler] 文章 {article_id} 锚点提取成功: {anchor_data['title'][:30]}")
            extracted += 1
        except Exception as e:
            print(f"[Scheduler] 锚点提取失败 (article {article_id}): {e}")

    return extracted


async def fetch_all_sources_job():
    """Job wrapper for fetching all sources and extracting anchors"""
    print("[Scheduler] 开始定时抓取所有新闻源...")
    try:
        results = await fetch_all_sources()
        for source_id, (count, msg) in results.items():
            print(f"[Scheduler] 源 {source_id}: {msg} ({count} 篇)")

        refreshed = await process_pending_we_mp_rss_articles()
        print(f"[Scheduler] we-mp-rss 正文回填处理 {refreshed} 篇")

        print("[Scheduler] 开始提取锚点...")
        extracted = await extract_anchors_from_recent_articles()
        print(f"[Scheduler] 本轮新增锚点 {extracted} 条")
    except Exception as e:
        print(f"[Scheduler] 定时任务出错: {e}")


async def generate_digest_job():
    """Job wrapper for generating daily digest"""
    from database import create_digest
    from datetime import date
    from services.ai import synthesize_digest

    today = date.today().isoformat()
    print(f"[Scheduler] 开始生成 {today} 简报...")

    try:
        # Check if digest already exists
        existing = await get_digest_by_date(today)
        if existing:
            print(f"[Scheduler] {today} 简报已存在，跳过")
            return

        # Get all recent anchors
        anchors = await get_all_anchors_for_digest()
        if not anchors:
            print("[Scheduler] 暂无锚点数据，简报生成取消")
            return

        # Synthesize digest
        digest_data = await synthesize_digest(anchors)

        # Calculate stats
        article_ids = set(a["article_id"] for a in anchors)
        total_articles = len(article_ids)

        # Save to database
        digest_id = await create_digest(
            date_str=today,
            title=f"{today} 今日资讯",
            overview=digest_data.get("overview", ""),
            sections=digest_data.get("sections", []),
            total_articles=total_articles,
            anchor_count=len(anchors)
        )

        print(f"[Scheduler] 简报生成成功 (id={digest_id})")
    except Exception as e:
        print(f"[Scheduler] 简报生成失败: {e}")


def start_scheduler():
    """Start the scheduler"""
    if not scheduler.running:
        init_scheduler()
        scheduler.start()
        print("[Scheduler] 定时任务已启动")


def stop_scheduler():
    """Stop the scheduler"""
    if scheduler.running:
        scheduler.shutdown()
        print("[Scheduler] 定时任务已停止")


def get_jobs():
    """Get all scheduled jobs"""
    return [
        {
            "id": job.id,
            "name": job.name,
            "next_run": str(job.next_run_time) if job.next_run_time else None
        }
        for job in scheduler.get_jobs()
    ]


def update_schedule(hours: list[int]):
    """Update the schedule with new hours"""
    scheduler.remove_job("daily_fetch")
    scheduler.add_job(
        fetch_all_sources_job,
        CronTrigger(hour=",".join(str(h) for h in hours), minute="0"),
        id="daily_fetch",
        replace_existing=True
    )
    print(f"[Scheduler] 定时任务已更新为每天 {hours} 点")
