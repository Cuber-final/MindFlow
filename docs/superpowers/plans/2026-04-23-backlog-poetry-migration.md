# Backlog And Backend Poetry Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the requirements backlog to reflect completed and re-prioritized work, then migrate backend Python dependency management from `requirements.txt` to Poetry with an in-project `.venv`.

**Architecture:** Keep the product/docs updates localized to the backlog and active onboarding docs, while migrating backend dependency installation to a single Poetry source of truth. Preserve the existing runtime entrypoint and Docker deployment shape, but switch dependency resolution and local developer commands to Poetry-managed workflows.

**Tech Stack:** Markdown docs, FastAPI backend, Poetry, Docker, pytest

---

### Task 1: Align backlog status and priority

**Files:**
- Modify: `docs/requirements-backlog.md`

- [ ] Review which backlog items are already proven complete in the current codebase and docs.
- [ ] Mark completed items as `done` with notes reflecting the verification basis.
- [ ] Reorder and reprioritize the remaining P1/P2 items so the next implementation lane matches the latest recommendation: observability first, schedule UI second, search/filter/read-closure next.

### Task 2: Migrate backend dependency management to Poetry

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/poetry.toml`
- Modify: `backend/Dockerfile`
- Delete: `backend/requirements.txt`

- [ ] Translate the current runtime dependency set from `backend/requirements.txt` into Poetry dependencies.
- [ ] Add the backend test dependencies required by the current pytest suite.
- [ ] Configure Poetry to create the virtualenv inside `backend/.venv`.
- [ ] Update the Docker build to install dependencies from Poetry without creating a nested container virtualenv.

### Task 3: Update active developer docs and verify locally

**Files:**
- Modify: `README.md`
- Modify: `docs/deploy.md`

- [ ] Replace active local-development instructions that still point to `pip install -r requirements.txt`.
- [ ] Add the Poetry-based local bootstrap and test commands, using the in-project `.venv`.
- [ ] Run Poetry install in `backend/` and verify that `backend/.venv` is created.
- [ ] Run backend verification commands through Poetry and confirm the updated environment works.
