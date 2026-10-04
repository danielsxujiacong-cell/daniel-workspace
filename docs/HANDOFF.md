# Handoff

## Current state

- **Updated:** 2026-10-04
- **Stage:** V2.7 Worker and Workspace integration are implemented. The live Worker responds at `https://daniel-workspace-api.ai-investment-dashboard.workers.dev`; Pages publication is pending the current source push.
- **Model:** BigModel `glm-4-flash-250414`; Worker configuration sets `AI_BASE_URL` and `AI_MODEL`. `AI_API_KEY` is not configured yet. Live `/health` reports the correct model and `configured: false`; `/api/chat` explicitly returns `ai_not_configured`.
- **Secret setup:** From this repository root, run `node .\node_modules\wrangler\bin\wrangler.js secret put AI_API_KEY --config .\cloudflare\wrangler.jsonc`. Enter the key only at Wrangler's terminal prompt. Never paste it into chat or put it in a file.
- **Architecture:** The authenticated Workspace calls the dedicated Worker; only the Worker calls BigModel. Context is explicitly bounded and excludes local paths, repository URLs, credentials, session data, and Git hashes. A configured real-provider failure stays visible and retryable; Mock is used only when no safe endpoint is configured.
- **Verification:** Wrangler dry-run/deploy, local and live health checks, explicit missing-secret behavior, CORS denial, response shape, bounded history, context filtering, and single retry for 429/timeout passed. Context builder checks passed across Dashboard, Project, Projects, Tasks, Knowledge, and Decisions. Real model and 5–10-turn checks await the Secret.
- **Browser:** The local preview showed the login-only page. There was no authenticated session in that browser, so the private Assistant was not opened and no credentials were entered. After Secret setup, use an already authenticated session or sign in manually before the Assistant UI checks.
- **V2.6 data:** Supabase SQL remains applied. Keep the Knowledge acceptance record, do not recreate the deleted Decisions record, and do not rerun or delete the legacy `daniel-workspace-v1` migration data.
- **Scope:** Stop after V2.7 acceptance; do not start V2.8.

## Next actions

1. Finish the source commit and push to `main`; verify the Pages entry and the new versioned assets.
2. Ask the user to set `AI_API_KEY` with the Wrangler command above; never request the key in chat.
3. After the user confirms Secret setup, verify `/health` shows `configured: true`, then run real prompts for “你好”, “我今天最应该推进什么？” with Tasks/Projects context, a current Project issue, and 5–10 continuous turns. Confirm errors remain usable and Pages refresh does not affect Workspace data.
4. Update this handoff with actual model responses, Companion/context results, Pages status, `HEAD = origin/main`, and clean working tree; then stop at V2.7.
