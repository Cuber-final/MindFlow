# Sources We-MP-RSS Auth UI Design

## Goal

Add `we_mp_rss` authentication inputs to the existing `Sources` modal so users can configure username/password directly from the frontend, while keeping passwords visually masked after save and preserving current backend storage in `source.config.we_mprss_auth`.

## Scope

This design covers:

- the `Sources` modal interaction model
- source type presentation in the frontend
- how `we_mprss_auth` is read, displayed, masked, edited, and saved
- compatibility handling for existing `rsshub` and legacy source data

This design does not cover:

- adding new backend schema fields
- changing the existing backend `sources` API contract
- adding a separate settings page or a dedicated auth-management page

## Current Context

The current `Sources` modal lives in [Sources.tsx](/Users/pegasus/workplace/work_repos/mindflow/.worktrees/codex-sources-auth-ui/frontend/src/pages/Sources.tsx). It still exposes three frontend source types:

- `native_rss`
- `rsshub`
- `we_mp_rss`

The backend `sources` API already accepts and returns arbitrary `config` objects via [newsletter.ts](/Users/pegasus/workplace/work_repos/mindflow/.worktrees/codex-sources-auth-ui/frontend/src/api/newsletter.ts) and [sources.py](/Users/pegasus/workplace/work_repos/mindflow/.worktrees/codex-sources-auth-ui/backend/routers/sources.py). The recently accepted auth-stability backend work reads credentials from `config.we_mprss_auth`.

## Approved Design

### 1. Frontend Type Model

The user-facing frontend will show only two source types:

- `通用 RSS` / `Generic RSS`
- `微信公众号` / `We-MP-RSS`

Internal mapping:

- `Generic RSS` saves as `native_rss`
- `微信公众号` saves as `we_mp_rss`

Existing `rsshub` rows remain backend-compatible, but the frontend will treat them as `Generic RSS` when displayed or edited. This means:

- list/table labels for both `native_rss` and `rsshub` become `通用 RSS` / `Generic RSS`
- editing an old `rsshub` source and saving it will normalize it to `native_rss`

### 2. Modal Interaction

The existing `SourceModal` remains the only editing surface.

When the selected type is `Generic RSS`:

- show `Name`
- show `Type`
- show `Feed URL`
- do not show auth credential fields

When the selected type is `微信公众号`:

- show `Name`
- show `Type`
- show `Feed URL`
- show `用户名` / `Username`
- show `密码` / `Password`

The credential fields appear inline in the same form, below `Feed URL`.

### 3. Password Display Rules

When creating a new `we_mp_rss` source:

- username is blank
- password is blank
- both must be entered if the user wants auth configured immediately

When editing an existing `we_mp_rss` source:

- username is shown as the real stored value
- password input shows a masked placeholder value such as `••••••••`
- the UI does not re-render the real password in the input

Behavior on submit:

- if the user does not modify the password field, keep the stored password
- if the user types a new password, replace the stored password
- if the user clears the password intentionally, save an empty password

To distinguish “unchanged masked password” from “user entered a new value”, the frontend will track a password dirty flag separately from the input text.

### 4. Stored Data Shape

The frontend writes credentials into:

```json
{
  "feed_url": "http://127.0.0.1:8001/feed/xxx.rss",
  "we_mprss_auth": {
    "username": "admin",
    "password": "admin@123"
  }
}
```

If a source is not `we_mp_rss`, `we_mprss_auth` should be omitted from the saved payload.

If a source is switched from `we_mp_rss` to `Generic RSS`, the frontend should remove `we_mprss_auth` from the outgoing config so stale credentials are not retained accidentally.

### 5. List and Detail Presentation

On the main `Sources` page:

- type chips/labels must show only `通用 RSS` or `微信公众号`
- no password is shown in the list/table
- no raw username/password is shown outside the modal

Optional small status copy inside the modal:

- if editing an existing `we_mp_rss` source with stored credentials, show a helper note that auth is already configured

### 6. Error Handling

Frontend validation:

- `Feed URL` remains required
- for `we_mp_rss`, `Username` and `Password` should be required on create

Edit validation:

- username remains required for `we_mp_rss`
- password may remain masked and unchanged
- if the user actively clears the password, allow save and let the backend/runtime decide whether later auth can succeed

### 7. Verification

The implementation is accepted when:

- `mp_text` no longer appears anywhere in the `Sources` modal UI
- `rsshub` no longer appears as a selectable type in the modal
- existing `rsshub` rows render as `Generic RSS`
- a `we_mp_rss` source can be created with username/password and those values are persisted in `config.we_mprss_auth`
- refreshing the page and reopening the modal shows:
  - real username
  - masked password placeholder
- editing and saving without changing the password preserves the stored password
- editing and changing the password replaces the stored password
- frontend build passes after the change

## Risks

- Because the backend currently returns the full `config`, the browser still receives the stored password on edit. This design only masks it in UI presentation; it does not solve transport-level exposure inside trusted admin UI flows.
- Old `rsshub` sources will silently normalize to `native_rss` on save. This is intentional, but should be called out in verification.
