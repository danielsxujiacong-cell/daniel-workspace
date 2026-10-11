# Handoff

## Current state

- **Updated:** 2026-10-11
- **Stage:** V3.5-B.4 routes public GitHub reads through the Cloudflare Worker for desktop and mobile. The designated Workspace user remains the only caller; public reads verify `private === false`, private reads still recheck GitHub App installation scope, and the browser retains its prior snapshot on failure.
- **Worker:** `daniel-workspace-api` validates the Supabase access token through Supabase Auth and requires the exact `WORKSPACE_USER_ID`. Public reads prefer a Worker-generated App installation token and fall back to Worker-origin anonymous reads when that token cannot access a public repository. No App JWT or installation token is returned to the browser.
- **Workspace:** Public refresh sends only repository names and the signed-in Supabase Bearer session to `/api/github/public-snapshots`. Private App reads and local Companion remain separate sources. Snapshots stay in this browser and do not enter Supabase sync.
- **Deployment:** Worker version `4e700ebd-4d43-4a01-a945-1058ca6730bc` is live. `main` commit `5452975` is pushed; both `workspace.danielxu.cn` and GitHub Pages return the V3.5-B.4 cache-busted entry and modules. CLI checks returned `/health` 200, unauthenticated public snapshots 401 `github_session_required`, and Workspace-origin CORS preflight 204.
- **Verification:** 16 focused GitHub client/Worker tests passed, covering strict identity, token non-disclosure, public/private separation, App-token reads, anonymous fallback, and sanitized upstream HTTP status. The earlier direct GitHub request returned HTTP 403 with anonymous quota remaining 0. The live authenticated public read is still unverified: CLI received 401 before reaching GitHub because no Workspace session token was read or supplied.
- **Boundaries:** No Supabase tables, rows, RLS, sync code, or GitHub App permissions were changed. The old KV namespace and OAuth secrets were not deleted; the Worker no longer binds or uses them. `.gitignore` excludes `.dev.vars` and private-key files.

## Next action

Open the signed-in Workspace on a phone and use Projects → “刷新公开仓库”. Confirm a public repository refreshes without the former GitHub request failure and that private/local projects retain their existing source behavior. If refresh fails, report the visible sanitized HTTP status and keep the cached snapshot; do not change Supabase data or GitHub permissions.
