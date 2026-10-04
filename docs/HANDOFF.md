# Handoff

## Current state

- **Updated:** 2026-10-04
- **Stage:** V2.7 is complete. The user confirmed the live signed-in acceptance: GLM conversations, Workspace Context, and Companion context all work.
- **Model:** BigModel `glm-4-flash-250414`; live `/health` reports `configured: true`. Wrangler Secret listing confirms `AI_API_KEY` exists as `secret_text`; the value was never read or logged.
- **Secret setup:** If the secret must be rotated later, run `node .\node_modules\wrangler\bin\wrangler.js secret put AI_API_KEY --config .\cloudflare\wrangler.jsonc` from this repository root and enter the key only at Wrangler's terminal prompt. Never paste the key into chat or put it in a file.
- **Architecture:** The authenticated Workspace calls the dedicated Worker; only the Worker calls BigModel. Context is explicitly bounded and excludes local paths, repository URLs, credentials, session data, and Git hashes. A configured real-provider failure stays visible and retryable; Mock is used only when no safe endpoint is configured.
- **Verification:** Live prompts “你好”, “我今天最应该推进什么？” and a current-project issue question all returned HTTP 200 from `glm-4-flash-250414`. An 8-turn conversation recalled its opening marker `K7`. Invalid requests return HTTP 400 with `ai_invalid_request`; an unapproved origin returns HTTP 403. Those direct Worker probes used synthetic context. The user subsequently confirmed that signed-in live GLM conversations, Workspace Context, and Companion context all work. Context-builder checks passed for Dashboard, Project, Projects, Tasks, Knowledge, Decisions, selection, and Companion summaries; path/URL/hash filtering and retry/error behavior passed earlier focused checks.
- **GitHub Pages:** The public entry, versioned Auth gate, app, AI config/service/context, and stylesheet returned HTTP 200 with V2.7 markers after deployment.
- **Git:** This completion record is committed and pushed to `main`; final fetch confirms `HEAD = origin/main` and a clean working tree.
- **Browser:** The user completed the signed-in online acceptance and confirmed real GLM conversation, Workspace Context, and Companion context work.
- **V2.6 data:** Supabase SQL remains applied. Keep the Knowledge acceptance record, do not recreate the deleted Decisions record, and do not rerun or delete the legacy `daniel-workspace-v1` migration data.
- **Scope:** Stop after V2.7 acceptance; do not start V2.8.

## Completion

V2.7 acceptance is complete. Stop here; do not start V2.8.
