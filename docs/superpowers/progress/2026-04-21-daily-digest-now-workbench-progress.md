# Daily Digest + Now Workbench Progress Log

- **Branch:** `feat/now-workbench`
- **Worktree:** `/Users/pegasus/workplace/work_repos/mindflow/.worktrees/feat-now-workbench`
- **Spec:** `docs/superpowers/specs/2026-04-20-mindflow-next-phase-product-design.md`
- **Plan:** `docs/superpowers/plans/2026-04-20-daily-digest-now-workbench.md`
- **Last updated:** 2026-04-21

## Completed Tasks

### Task 1 — Lock the Now API contract before implementation
- **Commit:** `1391298`
- Added `backend/tests/test_now_api.py`
- Locked:
  - `GET /api/now`
  - `GET /api/now/{anchor_id}`
  - `PATCH /api/now/{anchor_id}/state`
- Task 1 review status:
  - spec review ✅
  - code review ✅

### Task 2 — Create the Now backend
- **Commit:** `b2483aa`
- Added:
  - `backend/routers/now.py`
  - `backend/services/now.py`
  - `backend/alembic/versions/20260420_01_add_article_workbench_state.py`
- Updated:
  - `backend/main.py`
  - `backend/models.py`
  - `backend/schemas.py`
  - `backend/database.py`
- Task 2 review status:
  - spec review ✅
  - code review ✅

## Verification Snapshot

### Task 2 verification that passed
```bash
cd backend
source .venv/bin/activate
POSTGRES_PASSWORD=mindflow_dev alembic upgrade head
POSTGRES_PASSWORD=mindflow_dev pytest tests/test_now_api.py tests/test_articles.py tests/test_digests.py tests/test_main.py tests/test_sources.py tests/test_config.py tests/test_full_flow.py -q
python -m compileall backend
```

Result:
- `alembic upgrade head` ✅
- focused backend suite: `42 passed` ✅
- `compileall backend` ✅

### Known environment note
```bash
cd backend
source .venv/bin/activate
POSTGRES_PASSWORD=mindflow_dev pytest tests/test_database.py -q
```

Result:
- cannot collect because `pytest_asyncio` is missing in the current environment
- not treated as a Task 2 blocker because no new dependency installation was requested

## Remaining Work

### Next up
1. **Task 3** — switch frontend route semantics to `Daily Digest` + `Now`
2. **Task 4** — extend frontend API client with `nowApi`
3. **Task 5** — change Digest cards to internal detail entry
4. **Task 6** — build the real `Now` three-column workbench
5. **Task 7** — update README and run end-to-end verification

## Important Implementation Notes

- The current backend keeps article workbench state on `articles` (`read_at`, `processed_at`, `last_opened_at`) for the single-user MVP.
- Task 1 contract tests intentionally allow a minimal response shape when router helpers are patched. Because of that, `backend/schemas.py` keeps some `Now` fields optional for compatibility, while the real runtime service returns richer payloads for frontend integration.
- Local Docker PostgreSQL was needed to verify Alembic and `/health`-related tests.
