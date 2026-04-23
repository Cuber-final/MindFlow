# We-MP-RSS Provider Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the old we-mp-rss feed-item discovery flow with a provider-driven sync chain based on `provider_source_id (mp_id)` and `provider_article_id`, while keeping article content backfill on the existing article model.

**Architecture:** Add neutral provider identifier fields to `news_sources` and `articles`, replace we-mp-rss source fetching with `rss_url -> provider_source_id -> provider article list -> today filter -> content refresh` logic, and migrate scheduler/detail refresh to use `provider_article_id` instead of `external_id`. Keep `external_id` as a compatibility field only.

**Tech Stack:** FastAPI, SQLAlchemy async ORM, PostgreSQL, Alembic, APScheduler, httpx, pytest, pytest-asyncio

---

## File Structure

- Modify: `backend/models.py`
- Modify: `backend/database.py`
- Modify: `backend/services/we_mprss.py`
- Modify: `backend/services/crawler.py`
- Modify: `backend/services/scheduler.py`
- Modify: `backend/schemas.py`
- Modify: `backend/routers/sources.py`
- Modify: `backend/tests/test_we_mprss_flow.py`
- Create: `backend/alembic/versions/20260423_01_add_provider_ids_for_we_mprss.py`
- Reference only: `backend/tests/mp_refresh_today_flow.py`

### Task 1: Lock the new provider-id contract with failing tests

**Files:**
- Modify: `backend/tests/test_we_mprss_flow.py`

- [ ] **Step 1: Add failing tests for provider id parsing and today-filtered article sync**

Add tests that prove:

- RSS URL `/feed/MP_WXS_3941633310.rss?limit=5` parses to `provider_source_id = "MP_WXS_3941633310"`
- `fetch_source_articles()` for `we_mp_rss` no longer depends on feed item ids
- provider article list ingestion uses `provider_article_id`
- only today’s articles are selected for refresh
- missing-content articles are marked for refresh or backfilled directly

- [ ] **Step 2: Run only the new failing tests**

Run:

```bash
cd backend && poetry run pytest tests/test_we_mprss_flow.py -q
```

Expected:

- FAIL on missing `provider_source_id` / `provider_article_id` support
- FAIL on old `external_id`-based fetch assumptions

### Task 2: Add provider identifier fields and DB helpers

**Files:**
- Modify: `backend/models.py`
- Modify: `backend/database.py`
- Create: `backend/alembic/versions/20260423_01_add_provider_ids_for_we_mprss.py`

- [ ] **Step 1: Add fields and helper signatures**

Add:

- `NewsSource.provider_source_id`
- `Article.provider_article_id`

Add database helpers for:

- lookup by `source_id + provider_article_id`
- create/update source with `provider_source_id`
- selecting refresh candidates by `provider_article_id`

- [ ] **Step 2: Add the Alembic migration**

Migration responsibilities:

- add nullable `provider_source_id` to `news_sources`
- add nullable `provider_article_id` to `articles`
- add an index or uniqueness guard suitable for `source_id + provider_article_id`

- [ ] **Step 3: Run focused schema tests**

Run:

```bash
cd backend && poetry run pytest tests/test_we_mprss_flow.py -q
```

Expected:

- tests still fail, but on unimplemented service/crawler logic rather than missing fields

### Task 3: Replace we-mp-rss discovery with provider-driven article sync

**Files:**
- Modify: `backend/services/we_mprss.py`
- Modify: `backend/services/crawler.py`

- [ ] **Step 1: Add provider sync helpers in `we_mprss.py`**

Implement helpers for:

- parsing `provider_source_id` from RSS URL
- triggering mp refresh
- fetching latest articles by provider source id
- filtering today articles in Asia/Shanghai
- deciding whether content backfill is needed

- [ ] **Step 2: Replace the `we_mp_rss` branch in `fetch_source_articles()`**

Implement flow:

1. parse or update `provider_source_id`
2. ensure auth state
3. trigger mp refresh
4. fetch latest articles
5. keep today’s articles
6. upsert by `source_id + provider_article_id`
7. mark content-ready articles as `detail_fetched`
8. mark missing-content articles as `waiting_for_refresh`
9. trigger refresh for missing-content today articles

- [ ] **Step 3: Re-run the we-mp-rss test file**

Run:

```bash
cd backend && poetry run pytest tests/test_we_mprss_flow.py -q
```

Expected:

- discovery tests pass
- scheduler/backfill tests may still fail on old `external_id` assumptions

### Task 4: Move scheduler/detail refresh off `external_id`

**Files:**
- Modify: `backend/services/we_mprss.py`
- Modify: `backend/services/scheduler.py`
- Modify: `backend/database.py`

- [ ] **Step 1: Switch refresh/detail calls to `provider_article_id`**

Replace article-id usage in:

- refresh trigger
- detail fetch
- refresh candidate selection

Fallback behavior:

- if `provider_article_id` is missing for `we_mp_rss`, fail with explicit provider-id error

- [ ] **Step 2: Keep `external_id` only as compatibility data**

Do not use `external_id` for:

- we-mp-rss dedupe
- we-mp-rss refresh/detail fetch

Leave the column and existing API field in place for compatibility.

- [ ] **Step 3: Re-run the target backend suite**

Run:

```bash
cd backend && poetry run pytest tests/test_we_mprss_flow.py tests/test_sources.py tests/test_config.py -q
```

Expected:

- PASS for updated we-mp-rss flow
- PASS for unrelated source/config coverage

### Task 5: Final verification and cleanup

**Files:**
- Modify: `backend/schemas.py`
- Modify: `backend/routers/sources.py`
- Optional updates only if tests require them elsewhere

- [ ] **Step 1: Expose the new provider id fields safely**

Add optional response fields:

- `NewsSourceResponse.provider_source_id`
- `ArticleResponse.provider_article_id`

- [ ] **Step 2: Run fresh verification commands**

Run:

```bash
cd backend && poetry run pytest tests/test_we_mprss_flow.py tests/test_sources.py tests/test_config.py tests/test_articles.py -q
```

Expected:

- all selected tests pass

- [ ] **Step 3: Check diff scope**

Run:

```bash
git status --short
git diff -- backend/models.py backend/database.py backend/services/we_mprss.py backend/services/crawler.py backend/services/scheduler.py backend/schemas.py backend/routers/sources.py backend/tests/test_we_mprss_flow.py backend/alembic/versions/20260423_01_add_provider_ids_for_we_mprss.py docs/superpowers/specs/2026-04-23-we-mprss-provider-sync-design.md docs/superpowers/plans/2026-04-23-we-mprss-provider-sync.md
```

Expected:

- only planned files changed

### Risks

- Existing local article rows created by the old we-mp-rss path will not automatically have `provider_article_id`
- Current article list APIs still return article rows without query-level large-field trimming
- Provider article list semantics may vary if upstream changes `publish_time` or `has_content`
