from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from services.crawler import fetch_all_sources
from database import get_articles, create_anchor
from services.ai import extract_anchor
import asyncio


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


async def extract_anchors_from_recent_articles():
    """Extract anchors from recent articles that don't have anchors yet"""
    from database import get_anchors_by_article

    # Get recent articles (last 7 days)
    articles = get_articles(limit=50, offset=0)
    print(f"[Scheduler] 找到 {len(articles)} 篇最近文章，开始提取锚点...")

    for article in articles:
        article_id = article["id"]
        # Check if anchors already exist for this article
        existing = get_anchors_by_article(article_id)
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
            create_anchor(
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
        except Exception as e:
            print(f"[Scheduler] 锚点提取失败 (article {article_id}): {e}")


async def fetch_all_sources_job():
    """Job wrapper for fetching all sources and extracting anchors"""
    print("[Scheduler] 开始定时抓取所有新闻源...")
    try:
        results = await fetch_all_sources()
        for source_id, (count, msg) in results.items():
            print(f"[Scheduler] 源 {source_id}: {msg} ({count} 篇)")

        # After fetching, extract anchors from new articles
        print("[Scheduler] 开始提取锚点...")
        await extract_anchors_from_recent_articles()
    except Exception as e:
        print(f"[Scheduler] 定时任务出错: {e}")


async def generate_digest_job():
    """Job wrapper for generating daily digest"""
    from database import get_all_anchors_for_digest, create_digest, get_digest_by_date
    from datetime import date
    from services.ai import synthesize_digest

    today = date.today().isoformat()
    print(f"[Scheduler] 开始生成 {today} 简报...")

    try:
        # Check if digest already exists
        existing = get_digest_by_date(today)
        if existing:
            print(f"[Scheduler] {today} 简报已存在，跳过")
            return

        # Get all recent anchors
        anchors = get_all_anchors_for_digest()
        if not anchors:
            print("[Scheduler] 暂无锚点数据，简报生成取消")
            return

        # Synthesize digest
        digest_data = await synthesize_digest(anchors)

        # Calculate stats
        article_ids = set(a["article_id"] for a in anchors)
        total_articles = len(article_ids)

        # Save to database
        digest_id = create_digest(
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
