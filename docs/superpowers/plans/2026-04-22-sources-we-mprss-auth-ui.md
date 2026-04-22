# Sources We-MP-RSS Auth UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Execution status (2026-04-23):** Implemented with evidence from commits `a334ac3` and `17dec71`, validated by a fresh `npm run build`, and manually verified in the live UI for create / reopen / unchanged-password save / changed-password save flows.

**Goal:** Add `we_mp_rss` username/password configuration to the existing `Sources` modal, collapse frontend source types to `Generic RSS` and `微信公众号`, and preserve masked-password edit behavior across refreshes.

**Architecture:** Keep the existing `Sources` page and `SourceModal` as the only UI surface. Extend the frontend `NewsSource` handling to read/write `config.we_mprss_auth`, map old `rsshub` rows to the new generic type presentation, and track password masking state locally so unchanged passwords are preserved without being re-shown in clear text.

**Tech Stack:** React, TypeScript, Vite, existing `sourcesApi`, FastAPI `sources` backend contract

## Retrospective Verification Notes

- Evidence sources used for this update:
  - commit `a334ac3` — `Unify source ingestion around feed-based inputs`
  - commit `17dec71` — `Expose we-mp-rss credentials in the Sources modal`
  - current-file spot checks in `frontend/src/pages/Sources.tsx` and `frontend/src/api/newsletter.ts`
  - fresh frontend verification: `cd frontend && npm run build`
- What git history can prove well:
  - source-type collapse
  - credential field implementation
  - masked-password preservation logic
  - `we_mprss_auth` config writing and validation
  - build-level verification
- What git history cannot prove on its own:
  - browser-clicked manual create/edit flows against a live running UI
  - backend-retained password behavior observed through actual save/reload interactions

---

## File Structure

- Modify: `frontend/src/pages/Sources.tsx`
- Modify: `frontend/src/api/newsletter.ts`
- Optional modify: `README.md` (only if the UI wording/documentation needs to reflect the two-type model)

## Task 1: Prepare Source Type And Config Helpers

**Files:**
- Modify: `frontend/src/pages/Sources.tsx`
- Modify: `frontend/src/api/newsletter.ts`

- [x] **Step 1: Write the failing type/behavior test notes inline in the plan target comments**

Add temporary implementation comments or TODO markers in `Sources.tsx` describing the expected behavior:

```ts
// Expected behavior to implement:
// - modal only offers Generic RSS and We-MP-RSS
// - existing rsshub rows render as Generic RSS
// - we_mprss_auth is read from config when present
```

Retrospective note:

- This was a pre-implementation scaffolding step.
- It was not reconstructed after the feature had already shipped; later commit evidence and current-file spot checks were used instead.

- [x] **Step 2: Run a frontend type/build command to capture the current baseline**

Run:

```bash
npm run build
```

Expected:

- If dependencies are not installed in the worktree, capture that first and run `npm install`
- After install, build should pass before functional edits start

Retrospective note:

- The original pre-edit baseline build was not re-created after the fact.
- Equivalent evidence exists from commit `17dec71` (`Tested: npm run build`) plus a fresh current-branch build verification.

- [x] **Step 3: Add source config helper types**

In `frontend/src/api/newsletter.ts`, extend the frontend-side source typing with narrow helpers, for example:

```ts
export interface WeMpRssAuthConfig {
  username?: string;
  password?: string;
  access_token?: string;
  refresh_token?: string;
  token_updated_at?: string;
  verified_at?: string;
}
```

and add local helper readers in `Sources.tsx` for:

```ts
function getWeMpRssAuth(config: Record<string, unknown>): WeMpRssAuthConfig | null
function isGenericSourceType(sourceType: string): boolean
```

- [x] **Step 4: Re-run build**

Run:

```bash
npm run build
```

Expected:

- PASS

## Task 2: Collapse The Modal To Two User-Facing Types

**Files:**
- Modify: `frontend/src/pages/Sources.tsx`

- [x] **Step 1: Update the modal type union**

Replace the modal-facing source type union with two values only:

```ts
type SourceType = 'native_rss' | 'we_mp_rss';
```

- [x] **Step 2: Normalize existing rows for edit mode**

Make the modal treat `rsshub` as `native_rss` on load:

```ts
const initialType: SourceType =
  source?.source_type === 'we_mp_rss' ? 'we_mp_rss' : 'native_rss';
```

- [x] **Step 3: Update labels and helper copy**

Change label helpers so:

```ts
if (sourceType === 'we_mp_rss') return isZh ? '微信公众号' : 'We-MP-RSS';
return isZh ? '通用 RSS' : 'Generic RSS';
```

Remove the `RSSHub` option from the modal select and replace the generic helper text with feed-oriented copy.

- [x] **Step 4: Re-run build**

Run:

```bash
npm run build
```

Expected:

- PASS

## Task 3: Add We-MP-RSS Username/Password Fields

**Files:**
- Modify: `frontend/src/pages/Sources.tsx`

- [x] **Step 1: Add modal state for auth credentials**

Add local state for:

```ts
const [authUsername, setAuthUsername] = useState(existingUsername);
const [authPassword, setAuthPassword] = useState(maskedOrBlankPassword);
const [authPasswordDirty, setAuthPasswordDirty] = useState(false);
const [existingPassword, setExistingPassword] = useState(realStoredPassword);
```

- [x] **Step 2: Render conditional auth fields**

Only for `sourceType === 'we_mp_rss'`, render:

```tsx
<input value={authUsername} ... />
<input type="password" value={authPassword} ... />
```

and helper copy explaining that password remains hidden after save.

- [x] **Step 3: Implement masked-password behavior**

When editing an existing source:

- input displays `••••••••`
- `existingPassword` stores the real password from config
- first actual user edit flips `authPasswordDirty = true`

On submit:

```ts
const nextPassword =
  source && !authPasswordDirty ? existingPassword : authPassword;
```

- [x] **Step 4: Re-run build**

Run:

```bash
npm run build
```

Expected:

- PASS

## Task 4: Save And Preserve `we_mprss_auth`

**Files:**
- Modify: `frontend/src/pages/Sources.tsx`

- [x] **Step 1: Build outgoing config shape explicitly**

In `handleSubmit`, replace the current flat config creation with:

```ts
const config: Record<string, unknown> = { feed_url: apiBaseUrl };

if (sourceType === 'we_mp_rss') {
  config.we_mprss_auth = {
    username: authUsername.trim(),
    password: nextPassword,
  };
}
```

- [x] **Step 2: Strip stale auth config for generic sources**

Ensure `we_mprss_auth` is omitted when `sourceType === 'native_rss'`.

- [x] **Step 3: Add frontend validation**

Require on create/save for `we_mp_rss`:

```ts
if (sourceType === 'we_mp_rss' && !authUsername.trim()) ...
if (sourceType === 'we_mp_rss' && !nextPassword.trim()) ...
```

while still allowing unchanged masked passwords on edit.

- [x] **Step 4: Re-run build**

Run:

```bash
npm run build
```

Expected:

- PASS

## Task 5: Verify The Saved/Edit Flow End-To-End

**Files:**
- Modify: `frontend/src/pages/Sources.tsx`

- [x] **Step 1: Manually create a we-mp-rss source through the modal**

Use:

- type = `微信公众号`
- feed URL = a valid local `we-mp-rss` feed
- username/password = working local credentials

- [x] **Step 2: Refresh the page and reopen the source**

Verify:

- username is visible
- password field is masked
- password is not blanked accidentally

- [x] **Step 3: Save without changing password**

Verify the backend still receives/retains the original password in `config.we_mprss_auth.password`.

- [x] **Step 4: Change password and save**

Verify the backend updates `config.we_mprss_auth.password`.

- [x] **Step 5: Run final build verification**

Run:

```bash
npm run build
```

Expected:

- PASS

## Evidence Snapshot

- Commit `17dec71` explicitly records:
  - modal collapsed to `Generic RSS` and `We-MP-RSS`
  - username/password capture in the existing Sources modal
  - masked-password preservation
  - legacy `rsshub` rows rendered as `Generic RSS`
  - tested with `npm run build`
- Current file spot checks confirm:
  - `SourceType = 'native_rss' | 'we_mp_rss'`
  - `WeMpRssAuthConfig` exists in `frontend/src/api/newsletter.ts`
  - `getWeMpRssAuth`, `MASKED_PASSWORD_PLACEHOLDER`, `authPasswordDirty`, `buildAuthKey`, and `validateWeMpRssAuth` exist in `frontend/src/pages/Sources.tsx`
  - `config.we_mprss_auth` is written only for `we_mp_rss`
  - UI copy now presents only `Generic RSS` and `微信公众号`
- Fresh verification on current branch:
  - `cd frontend && npm run build`
  - result: PASS
- Manual live-UI verification reported on 2026-04-23:
  - create a `we-mp-rss` source through the modal: PASS
  - refresh and reopen the saved source: PASS
  - save without changing password: PASS
  - change password and save: PASS

## Follow-Up UX Notes (2026-04-23)

- Replace the current browser-native delete confirmation with an in-product confirmation dialog that matches the Sources page visual language.
- Add a future bulk setup flow for multiple WeChat RSS feeds so users do not need to configure each `we-mp-rss` source one by one.
- Revisit the `Quick Add RSS` flow:
  - its current value is limited
  - future logic should infer the likely source type from the feed URL and guide the user into the right configuration path
