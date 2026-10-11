# Handoff

## Current state

- **Updated:** 2026-10-11
- **Stage:** V3.5-B GitHub App private repository read-only integration implemented; Worker deployed, GitHub App setup pending.
- **Implementation:** GitHub App install flow uses a signed, single-use, 10-minute state; setup callback is followed by GitHub user authorization and an installation-ownership check. The user OAuth token is discarded after verification. Short-lived installation tokens read selected repository metadata and commit activity; KV maps the validated Workspace user to the installation ID.
- **Frontend:** Projects can connect/refresh the GitHub App. Home pinned cards and AI Daily Brief use matching public or authorized private repository snapshots. Private snapshots stay in the current browser cache and are not sent to Supabase. Cached private information remains visible with offline/authorization status notices.
- **Deployment:** Cloudflare KV `GITHUB_INSTALLATIONS` namespace created and bound. Worker version `38a766ae-c4f4-4f8b-881c-2b959d7fb4ef` deployed to `https://daniel-workspace-api.ai-investment-dashboard.workers.dev`. A cryptographically random `GITHUB_STATE_SECRET` is provisioned as a Worker Secret. `/health` is healthy; `/api/github/status` correctly returns `github_not_configured` until GitHub App credentials are added.
- **Verification:** 14 targeted Node tests pass for GitHub App auth/ownership/metadata reads, private daily brief evidence, public GitHub behavior, and AI context; syntax and `git diff --check` pass. Authenticated UI, real GitHub installation and private repo activity have not been verified.
- **Data boundaries:** No Supabase tables, project records, or sync code changed. GitHub OAuth tokens/private keys are not stored in the repo or browser. `.gitignore` excludes `.dev.vars` and `.dev.vars.*`.

## Next action

Create a private GitHub App with Repository `Contents: Read-only` and `Metadata: Read-only`, configure Setup URL `https://daniel-workspace-api.ai-investment-dashboard.workers.dev/api/github/callback` and OAuth Callback URL `https://daniel-workspace-api.ai-investment-dashboard.workers.dev/api/github/oauth/callback`, then add `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `GITHUB_APP_PRIVATE_KEY` as Cloudflare Worker Secrets and redeploy. `GITHUB_STATE_SECRET` is already generated and stored server-side. Never send secret values in chat or commit them. After setup, use Projects → Connect GitHub App, select repositories, approve the GitHub identity check, and add each private `https://github.com/{owner}/{repo}` URL to its Workspace project.
