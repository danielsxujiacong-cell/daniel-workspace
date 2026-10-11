# Handoff

## Current state

- **Updated:** 2026-10-11
- **Stage:** V3.5-B.3 replaces GitHub user OAuth redirects and KV installation mapping with server-side GitHub App installation tokens. The designated signed-in Workspace user has already completed a live read; final Companion-offline acceptance is for the user.
- **Worker:** `daniel-workspace-api` validates the Supabase access token through Supabase Auth and requires the exact `WORKSPACE_USER_ID`. It signs a short-lived GitHub App JWT with the existing private key, obtains installation tokens, lists repositories in installation scope, and rechecks each requested repository before reading. App JWTs and installation tokens stay in Worker memory and never enter a response.
- **Workspace:** Projects automatically reads private repositories and provides a manual “刷新私有仓库” action. It sends only the signed-in Supabase Bearer session and selected repository names. Snapshots remain in the current browser and do not enter Supabase sync.
- **Live evidence:** The signed-in Workspace session displayed 3 authorized repositories and refreshed the private `daniel-workspace` card to latest commit `docs: record V3.5-B.2 deployment status` (`0926e3c…`, branch `main`). The first real upstream attempt returned GitHub HTTP 403 because the Worker lacked a `User-Agent`; a fixed Worker `User-Agent` resolved the issue, and the subsequent signed-in read succeeded.
- **Verification:** Seven focused GitHub client/Worker tests pass, including generated App JWT signature, installation token exchange, latest commit read, strict identity rejection, token non-disclosure, and sanitized upstream errors. Changed JavaScript syntax checks and `git diff --check` pass.
- **Boundaries:** No Supabase tables, rows, RLS, sync code, or GitHub App permissions were changed. The old KV namespace and OAuth secrets were not deleted; the Worker no longer binds or uses them. `.gitignore` excludes `.dev.vars` and private-key files.

## Next action

Stop Local Companion on this computer, then refresh the signed-in Workspace and confirm GitHub private commit data still appears while the local scan reports Companion offline. Companion only supplies this device’s local Git and file state; it is not needed for the Worker’s private GitHub reads.
