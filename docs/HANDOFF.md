# Handoff

## Current state

- **Updated:** 2026-10-11
- **Stage:** V3.5-B.1 connection fix implemented; Worker config is live. User OAuth linking and real private-repository acceptance remain pending.
- **Implementation:** Workspace now starts GitHub user authorization directly for an existing installation. The Worker uses a signed, single-use, 10-minute state, finds the matching App installation in the authorized user's installation list, and discards the user token after verification. If no installation exists, it falls back to the install flow; setup callbacks accept installation and repository-scope updates. Short-lived installation tokens read selected repository metadata and commit activity; KV maps the validated Workspace user to the installation ID.
- **Frontend:** Projects can connect/refresh the GitHub App. Home pinned cards and AI Daily Brief use matching public or authorized private repository snapshots. Private snapshots stay in the current browser cache and are not sent to Supabase. Cached private information remains visible with offline/authorization status notices.
- **Deployment:** Cloudflare KV `GITHUB_INSTALLATIONS` is bound. Wrangler reports the GitHub Secret names without exposing values; Dashboard Variables are preserved with `--keep-vars`. Worker version `82e9677f-6093-4a6c-bfaf-85f486a69e27` is live at `https://daniel-workspace-api.ai-investment-dashboard.workers.dev`. No-session `/api/github/status` returns `401 github_session_required`, confirming the required configuration gate and KV binding are present; `/health` is healthy.
- **Verification:** Six targeted client/Worker tests pass for direct OAuth with an existing installation, install fallback, signed ownership checks, and private metadata/commit reads. A real OAuth session and private repository read still need the user to complete GitHub identity authorization after the static page update is published.
- **Data boundaries:** No Supabase tables, project records, or sync code changed. GitHub OAuth tokens/private keys are not stored in the repo or browser. `.gitignore` excludes `.dev.vars` and `.dev.vars.*`.

## Next action

After deployment, use Projects → Connect GitHub App and complete the GitHub identity authorization. The Worker should return to the original Workspace page, bind the existing installation, and load the selected repositories. Confirm each private `https://github.com/{owner}/{repo}` URL is in its matching Workspace project, then verify latest commit metadata and the daily brief.
