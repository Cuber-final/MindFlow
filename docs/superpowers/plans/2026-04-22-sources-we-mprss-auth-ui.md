# Sources We-MP-RSS Auth UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `we_mp_rss` username/password configuration to the existing `Sources` modal, collapse frontend source types to `Generic RSS` and `微信公众号`, and preserve masked-password edit behavior across refreshes.

**Architecture:** Keep the existing `Sources` page and `SourceModal` as the only UI surface. Extend the frontend `NewsSource` handling to read/write `config.we_mprss_auth`, map old `rsshub` rows to the new generic type presentation, and track password masking state locally so unchanged passwords are preserved without being re-shown in clear text.

**Tech Stack:** React, TypeScript, Vite, existing `sourcesApi`, FastAPI `sources` backend contract

---

## File Structure

- Modify: `frontend/src/pages/Sources.tsx`
- Modify: `frontend/src/api/newsletter.ts`
- Optional modify: `README.md` (only if the UI wording/documentation needs to reflect the two-type model)

## Task 1: Prepare Source Type And Config Helpers

**Files:**
- Modify: `frontend/src/pages/Sources.tsx`
- Modify: `frontend/src/api/newsletter.ts`

- [ ] **Step 1: Write the failing type/behavior test notes inline in the plan target comments**

Add temporary implementation comments or TODO markers in `Sources.tsx` describing the expected behavior:

```ts
// Expected behavior to implement:
// - modal only offers Generic RSS and We-MP-RSS
// - existing rsshub rows render as Generic RSS
// - we_mprss_auth is read from config when present
```

- [ ] **Step 2: Run a frontend type/build command to capture the current baseline**

Run:

```bash
npm run build
```

Expected:

- If dependencies are not installed in the worktree, capture that first and run `npm install`
- After install, build should pass before functional edits start

- [ ] **Step 3: Add source config helper types**

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

- [ ] **Step 4: Re-run build**

Run:

```bash
npm run build
```

Expected:

- PASS

## Task 2: Collapse The Modal To Two User-Facing Types

**Files:**
- Modify: `frontend/src/pages/Sources.tsx`

- [ ] **Step 1: Update the modal type union**

Replace the modal-facing source type union with two values only:

```ts
type SourceType = 'native_rss' | 'we_mp_rss';
```

- [ ] **Step 2: Normalize existing rows for edit mode**

Make the modal treat `rsshub` as `native_rss` on load:

```ts
const initialType: SourceType =
  source?.source_type === 'we_mp_rss' ? 'we_mp_rss' : 'native_rss';
```

- [ ] **Step 3: Update labels and helper copy**

Change label helpers so:

```ts
if (sourceType === 'we_mp_rss') return isZh ? '微信公众号' : 'We-MP-RSS';
return isZh ? '通用 RSS' : 'Generic RSS';
```

Remove the `RSSHub` option from the modal select and replace the generic helper text with feed-oriented copy.

- [ ] **Step 4: Re-run build**

Run:

```bash
npm run build
```

Expected:

- PASS

## Task 3: Add We-MP-RSS Username/Password Fields

**Files:**
- Modify: `frontend/src/pages/Sources.tsx`

- [ ] **Step 1: Add modal state for auth credentials**

Add local state for:

```ts
const [authUsername, setAuthUsername] = useState(existingUsername);
const [authPassword, setAuthPassword] = useState(maskedOrBlankPassword);
const [authPasswordDirty, setAuthPasswordDirty] = useState(false);
const [existingPassword, setExistingPassword] = useState(realStoredPassword);
```

- [ ] **Step 2: Render conditional auth fields**

Only for `sourceType === 'we_mp_rss'`, render:

```tsx
<input value={authUsername} ... />
<input type="password" value={authPassword} ... />
```

and helper copy explaining that password remains hidden after save.

- [ ] **Step 3: Implement masked-password behavior**

When editing an existing source:

- input displays `••••••••`
- `existingPassword` stores the real password from config
- first actual user edit flips `authPasswordDirty = true`

On submit:

```ts
const nextPassword =
  source && !authPasswordDirty ? existingPassword : authPassword;
```

- [ ] **Step 4: Re-run build**

Run:

```bash
npm run build
```

Expected:

- PASS

## Task 4: Save And Preserve `we_mprss_auth`

**Files:**
- Modify: `frontend/src/pages/Sources.tsx`

- [ ] **Step 1: Build outgoing config shape explicitly**

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

- [ ] **Step 2: Strip stale auth config for generic sources**

Ensure `we_mprss_auth` is omitted when `sourceType === 'native_rss'`.

- [ ] **Step 3: Add frontend validation**

Require on create/save for `we_mp_rss`:

```ts
if (sourceType === 'we_mp_rss' && !authUsername.trim()) ...
if (sourceType === 'we_mp_rss' && !nextPassword.trim()) ...
```

while still allowing unchanged masked passwords on edit.

- [ ] **Step 4: Re-run build**

Run:

```bash
npm run build
```

Expected:

- PASS

## Task 5: Verify The Saved/Edit Flow End-To-End

**Files:**
- Modify: `frontend/src/pages/Sources.tsx`

- [ ] **Step 1: Manually create a we-mp-rss source through the modal**

Use:

- type = `微信公众号`
- feed URL = a valid local `we-mp-rss` feed
- username/password = working local credentials

- [ ] **Step 2: Refresh the page and reopen the source**

Verify:

- username is visible
- password field is masked
- password is not blanked accidentally

- [ ] **Step 3: Save without changing password**

Verify the backend still receives/retains the original password in `config.we_mprss_auth.password`.

- [ ] **Step 4: Change password and save**

Verify the backend updates `config.we_mprss_auth.password`.

- [ ] **Step 5: Run final build verification**

Run:

```bash
npm run build
```

Expected:

- PASS
