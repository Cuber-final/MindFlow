# We-MP-RSS Digest Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a `we_mp_rss` source close the loop from feed discovery to delayed content refresh, detail backfill, anchor extraction readiness, and Daily Digest generation input.

**Architecture:** Keep generic feed ingestion in `crawler.py`, but move all `we_mp_rss`-specific URL normalization and protected REST calls into a dedicated backend service. Extend the article model with content-refresh state so scheduler jobs can safely delay refresh by 10 minutes, poll task status, backfill normalized content, and only extract anchors once article content is ready.

**Tech Stack:** FastAPI, SQLAlchemy async ORM, Alembic, APScheduler, httpx, pytest

---

## Status

- Status: Completed
- Completed on: 2026-04-22
- Execution summary:
  - Real `we_mp_rss` feed discovery now normalizes `.rss/.xml/.atom` to `.json` and persists newly discovered articles as `waiting_for_refresh`.
  - MindFlow now stores article content-refresh state, runs a minute-level refresh job, backfills `content_html`, and only extracts anchors from content-ready articles.
  - Closed-loop verification was completed against the local `we-mp-rss` service on `127.0.0.1:8001` with real auth and mocked AI synthesis for digest generation.

## File Structure

- Create: `backend/services/we_mprss.py`
- Create: `backend/tests/test_we_mprss_flow.py`
- Create: `backend/alembic/versions/20260422_01_add_we_mprss_refresh_state.py`
- Create: `docs/superpowers/progress/2026-04-22-we-mp-rss-digest-closure-progress.md`
- Modify: `backend/models.py`
- Modify: `backend/database.py`
- Modify: `backend/services/crawler.py`
- Modify: `backend/services/scheduler.py`

## Task 1: Lock The We-MP-RSS Contract With Failing Tests

**Files:**
- Create: `backend/tests/test_we_mprss_flow.py`
- Modify: `backend/tests/test_full_flow.py`

- [x] Add a failing test that proves a `we_mp_rss` feed URL such as `http://127.0.0.1:8001/feed/MP_WXS_3941633310.rss?limit=5` is internally normalized to `.json` while preserving query parameters.
- [x] Run only that test and confirm it fails because the normalization helper does not exist yet.
- [x] Add a failing test that proves newly discovered `we_mp_rss` articles are persisted in a “waiting for refresh” state instead of being treated as fully ready content.
- [x] Run only that test and confirm it fails against the current crawler behavior.
- [x] Add a failing test that proves the refresh lifecycle can move `waiting_for_refresh -> refresh_requested -> refresh_running -> detail_fetched` when the remote refresh/task/detail endpoints are mocked.
- [x] Run the targeted test file and confirm the lifecycle test fails before any production changes.

## Task 2: Add Article Refresh State To The Data Model

**Files:**
- Create: `backend/alembic/versions/20260422_01_add_we_mprss_refresh_state.py`
- Modify: `backend/models.py`
- Modify: `backend/database.py`

- [x] Add the migration for article refresh fields needed by the loop: `content_html`, `content_refresh_status`, `content_refresh_task_id`, `content_refresh_requested_at`, `content_refresh_checked_at`, `content_refreshed_at`, `content_refresh_error`.
- [x] Update the SQLAlchemy `Article` model to expose the same fields.
- [x] Extend `create_article` so callers can persist initial refresh metadata without breaking existing generic source creation.
- [x] Add database helpers to:
- [x] Select `we_mp_rss` articles due for refresh after the 10-minute delay.
- [x] Select articles with in-flight refresh tasks that should be polled.
- [x] Update refresh task state and backfilled content/detail fields.
- [x] Select only articles that are eligible for anchor extraction.
- [x] Run the Task 1 test file again and confirm model/helper wiring is still red for behavior, not schema errors.

## Task 3: Implement The We-MP-RSS Client And Feed Discovery Integration

**Files:**
- Create: `backend/services/we_mprss.py`
- Modify: `backend/services/crawler.py`

- [x] Add a small `we_mprss.py` service with helpers to:
- [x] Detect whether a source/feed URL is a `we_mp_rss` single-channel feed.
- [x] Normalize `.rss/.xml/.atom` feed URLs to `.json` while preserving query parameters.
- [x] Derive the protected article API base from the feed URL host.
- [x] Build authenticated request headers from `source.auth_key`.
- [x] Call the protected refresh endpoint.
- [x] Poll the protected refresh-task endpoint.
- [x] Fetch protected article detail and choose `content_html > content`.
- [x] Update the generic crawler so `we_mp_rss` sources fetch discovery data from normalized JSON feed URLs.
- [x] Persist new `we_mp_rss` articles with a delayed-refresh status, while keeping non-`we_mp_rss` sources on the existing generic ready path.
- [x] Re-run the normalization/discovery tests and confirm they turn green.

## Task 4: Implement Scheduler-Orchestrated Refresh And Digest Readiness

**Files:**
- Modify: `backend/services/scheduler.py`
- Modify: `backend/database.py`
- Modify: `backend/tests/test_we_mprss_flow.py`

- [x] Fix the current scheduler’s async DB/service calls so jobs await async helpers instead of handling coroutine objects.
- [x] Add a minute-level scheduler job that:
- [x] Finds `we_mp_rss` articles whose first discovery time is at least 10 minutes old.
- [x] Requests remote content refresh and stores `task_id` plus status.
- [x] Polls in-flight refresh tasks.
- [x] On success, fetches article detail and writes normalized content back into `Article.content` plus `Article.content_html`.
- [x] On failure/timeout, records `content_refresh_error` and moves status to `refresh_failed`.
- [x] Change anchor extraction to only consider articles that are content-ready:
- [x] All non-`we_mp_rss` articles.
- [x] `we_mp_rss` articles with `detail_fetched`.
- [x] Add tests that cover:
- [x] Delayed refresh eligibility.
- [x] Refresh success backfill.
- [x] Refresh failure bookkeeping.
- [x] Anchor extraction gating.
- [x] Run targeted backend tests until they all pass.

## Task 5: Verify The Closed Loop End-To-End

**Files:**
- Modify: `backend/tests/test_full_flow.py`

- [x] Extend the mocked end-to-end verification so it covers:
- [x] `we_mp_rss` source fetch from `.json`.
- [x] Delayed refresh orchestration.
- [x] Detail backfill into article content.
- [x] Anchor extraction from refreshed content.
- [x] Digest generation input readiness.
- [x] Run the backend verification set:
- [x] `POSTGRES_PASSWORD=mindflow_dev backend/.venv/bin/pytest backend/tests/test_we_mprss_flow.py -q`
- [x] `POSTGRES_PASSWORD=mindflow_dev backend/.venv/bin/pytest backend/tests/test_full_flow.py -q`
- [x] `POSTGRES_PASSWORD=mindflow_dev backend/.venv/bin/pytest backend/tests/test_sources.py backend/tests/test_articles.py backend/tests/test_digests.py backend/tests/test_main.py backend/tests/test_config.py -q`
- [x] Run a live local-service probe against `127.0.0.1:8001` to confirm:
- [x] Public feed discovery works from the normalized `.json` endpoint.
- [x] Protected refresh/detail endpoints are reachable when `source.auth_key` is configured.
- [x] If local auth is unavailable, record that as an environment verification limit rather than a code failure.
- [x] Summarize the final evidence as:
- [x] mocked closed-loop tests,
- [x] local live feed discovery,
- [x] local protected API status.

## Verification Snapshot

- Local authenticated `we-mp-rss` probes succeeded against `127.0.0.1:8001`:
  - `POST /api/v1/wx/auth/token`
  - `POST /api/v1/wx/articles/{article_id}/refresh`
  - `GET /api/v1/wx/articles/refresh/tasks/{task_id}`
  - `GET /api/v1/wx/articles/{article_id}`
- Fresh verification source `source_id=4` completed the full local loop:
  - discovery fetch: `5` articles
  - post-refresh status: `5/5 detail_fetched`
  - persisted `content_html` lengths: `5991 / 8339 / 10525 / 8597 / 9615`
- Mocked AI verification persisted a new digest for `2026-04-22`:
  - latest digest `id=2`
  - latest digest title `2026-04-22 今日资讯`
  - latest digest overview `真实 we-mp-rss -> MindFlow 回填链路已验证，今日简报由 mock AI 合成。`

## Simplifications Kept

- `source.auth_key` is still the single configuration point for protected `we-mp-rss` API access.
- The minute-level refresh job requests the refresh task, polls it inline, and immediately falls back to article detail if the task poll fails but detail content is already present.
- Digest generation was verified with mocked AI synthesis rather than a live SiliconFlow model.
