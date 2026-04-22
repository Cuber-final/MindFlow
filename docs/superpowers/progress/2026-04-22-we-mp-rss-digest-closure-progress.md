# We-MP-RSS Digest Closure Progress Log

- **Branch:** `codex/we-mp-rss-digest-closure`
- **Plan:** `docs/superpowers/plans/2026-04-22-we-mp-rss-digest-closure-plan.md`
- **Last updated:** 2026-04-22

## Scope

Close the `we_mp_rss` path from:

- feed discovery
- delayed protected content refresh
- article detail backfill
- anchor extraction readiness
- Daily Digest persistence

with real local `we-mp-rss` service verification and mocked AI synthesis for digest generation.

## Completed Work

### Backend implementation

- Added `backend/services/we_mprss.py`
  - `.rss/.xml/.atom -> .json` normalization
  - protected `refresh / refresh-task / article-detail` client helpers
  - authenticated request header handling
  - `content_html > content` detail selection
  - fallback-to-detail behavior when refresh-task polling fails but detail is already available

- Added article content-refresh state to the backend:
  - `backend/models.py`
  - `backend/database.py`
  - `backend/alembic/versions/20260422_01_add_we_mprss_refresh_state.py`

- Updated `backend/services/crawler.py`
  - `we_mp_rss` discovery now uses normalized `.json` feed URLs
  - current JSON parsing supports real `we-mp-rss` field names such as `name`, `link`, `items[].content`, `items[].updated`
  - new `we_mp_rss` articles are persisted as `waiting_for_refresh`

- Updated `backend/services/scheduler.py`
  - fixed async DB/service usage
  - added minute-level `we_mp_rss` content refresh processing
  - anchor extraction now only consumes content-ready articles

### Test coverage

- Added `backend/tests/test_we_mprss_flow.py`
  - URL normalization
  - discovery state persistence
  - refresh lifecycle success path
  - refresh error handling
  - detail fallback behavior
  - scheduler refresh and anchor gating behavior

## Verification Evidence

### Automated verification

Ran:

```bash
POSTGRES_PASSWORD=mindflow_dev ../backend/.venv/bin/python -m pytest \
  tests/test_we_mprss_flow.py \
  tests/test_full_flow.py \
  tests/test_sources.py \
  tests/test_articles.py \
  tests/test_digests.py \
  tests/test_main.py \
  tests/test_config.py \
  -q
```

Result:

- `48 passed`

### Real local service verification

Used the local `we-mp-rss` service on `127.0.0.1:8001` with `.env` credentials:

- `USERNAME=admin`
- `PASSWORD=admin@123`

Observed:

- `POST /api/v1/wx/auth/token` returned a bearer token
- `POST /api/v1/wx/articles/{article_id}/refresh` returned a real `task_id`
- `GET /api/v1/wx/articles/refresh/tasks/{task_id}` reached `success`
- `GET /api/v1/wx/articles/{article_id}` returned non-empty `content_html`

### Fresh isolated closure run

Created a fresh verification source:

- `source_id = 4`
- name: `PaperAgent closure source`
- feed URL: `http://127.0.0.1:8001/feed/MP_WXS_3941633310.rss?limit=5`

Then verified:

1. discovery fetch inserted `5` new articles
2. all `5` articles entered `waiting_for_refresh`
3. forced them into the 10-minute refresh window
4. ran `process_pending_we_mp_rss_articles()`
5. all `5` articles transitioned to `detail_fetched`
6. all `5` articles stored non-empty `content_html`

Persisted article evidence for `source_id=4`:

- article `7`: `detail_fetched`, `html_len=5991`
- article `8`: `detail_fetched`, `html_len=8339`
- article `9`: `detail_fetched`, `html_len=10525`
- article `10`: `detail_fetched`, `html_len=8597`
- article `11`: `detail_fetched`, `html_len=9615`

### Digest generation verification

Used mocked AI extraction/synthesis to avoid live SiliconFlow dependency.

Verified:

- `5` anchors written for `source_id=4`
- a new daily digest persisted for `2026-04-22`
- `routers.digests.get_latest()` returned that digest successfully

Persisted digest evidence:

- latest digest `id = 2`
- latest digest title `2026-04-22 今日资讯`
- latest digest overview `真实 we-mp-rss -> MindFlow 回填链路已验证，今日简报由 mock AI 合成。`

## Remaining Risks

- The local environment still relies on a bearer token stored in `source.auth_key`; there is no token refresh flow yet.
- Verification used mocked AI synthesis, so the digest-generation contract is proven, but not the live SiliconFlow provider path.
- Local verification sources and digest rows were intentionally written into the development database during testing.
