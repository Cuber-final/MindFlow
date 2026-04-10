import pytest
import pytest_asyncio
import asyncio
from datetime import datetime

# Tests require running PostgreSQL - mark accordingly
pytestmark = pytest.mark.skipif(
    True,  # Set to False when PostgreSQL is available
    reason="PostgreSQL not available - run after docker-compose up -d postgres"
)


@pytest.fixture(scope="module")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="module")
async def setup_database():
    """Initialize database - requires PostgreSQL"""
    from database import init_db
    await init_db()
    yield


@pytest.mark.asyncio
async def test_create_and_get_source(setup_database):
    """Test news source CRUD operations"""
    from database import create_source, get_source_by_id, get_all_sources, delete_source

    source_id = await create_source(
        name="Test RSS Source",
        source_type="rss",
        api_base_url="https://example.com/feed.xml",
        auth_key="test_key",
        config={"timeout": 30}
    )
    assert source_id > 0

    source = await get_source_by_id(source_id)
    assert source is not None
    assert source["name"] == "Test RSS Source"
    assert source["source_type"] == "rss"
    assert source["config"]["timeout"] == 30

    all_sources = await get_all_sources()
    assert len(all_sources) >= 1
    assert any(s["id"] == source_id for s in all_sources)


@pytest.mark.asyncio
async def test_anchor_jsonb_query(setup_database):
    """Test anchor point with JSONB tag filtering"""
    from database import create_anchor, get_anchors

    anchor_id = await create_anchor(
        article_id=1,
        title="Test AI Breakthrough",
        content="A breakthrough in AI research",
        dialectical_analysis="【支持】Evidence shows...【质疑】But limitations exist...【延伸】Future implications...",
        anchor_type="breakthrough",
        significance=0.9,
        source_article_title="Original Article",
        source_article_link="https://example.com/article",
        source_name="TestSource",
        tags=["AI", "Machine Learning", "Research"],
        related_tag_weights={"AI": 1.5, "ML": 1.2, "Research": 0.8}
    )
    assert anchor_id > 0

    # Test JSONB contains query
    anchors_with_ai = await get_anchors(tags=["AI"])
    assert len(anchors_with_ai) >= 1
    assert any(a["id"] == anchor_id for a in anchors_with_ai)
    assert "AI" in anchors_with_ai[0]["tags"]

    anchors_with_ml = await get_anchors(tags=["Machine Learning"])
    assert len(anchors_with_ml) >= 1


@pytest.mark.asyncio
async def test_digest_crud(setup_database):
    """Test daily digest CRUD operations"""
    from database import create_digest, get_digest_by_date, get_latest_digest, get_digests

    date_str = "2026-04-10"
    sections = [
        {
            "domain": "AI领域",
            "domain_icon": "🤖",
            "insights": []
        }
    ]

    digest_id = await create_digest(
        date_str=date_str,
        title=f"{date_str} 今日资讯",
        overview="Test overview for the day",
        sections=sections,
        total_articles=10,
        anchor_count=5
    )
    assert digest_id > 0

    digest = await get_digest_by_date(date_str)
    assert digest is not None
    assert digest["title"] == f"{date_str} 今日资讯"
    assert len(digest["sections"]) == 1

    latest = await get_latest_digest()
    assert latest is not None


@pytest.mark.asyncio
async def test_interest_tag_crud(setup_database):
    """Test user interest tag CRUD operations"""
    from database import create_interest_tag, get_all_interest_tags, get_interest_tag_by_name, update_interest_tag

    tag_id = await create_interest_tag("Python")
    assert tag_id > 0

    tags = await get_all_interest_tags()
    assert len(tags) >= 1

    tag = await get_interest_tag_by_name("Python")
    assert tag is not None
    assert tag["tag"] == "Python"
    assert tag["weight"] == 1.0  # default

    await update_interest_tag(tag_id, weight=1.5)
    updated = await get_interest_tag_by_name("Python")
    assert updated["weight"] == 1.5
