# Handoff

## Current state

- **Updated:** 2026-10-09
- **Stage:** V3.0-B visitor ticket workflow is implemented, regression-tested, committed, and pushed to `main`.
- **Version:** `src/version.js` reports `V3.0-B`.
- **Visitor route:** `?mode=guest` loads the standalone demo. It contains Home, Projects, Tasks, Knowledge, and Decisions; a skippable two-minute tour; task filters; reset; and exit. TK-1001 supports deterministic P1 guidance, a linked supplier exception SOP, solution selection, a simulated Decision, and completion with live Home/Tasks updates. Changes exist only in the mounted page's memory.
- **Isolation:** Guest and post-exit `?mode=login` routes skip Supabase config loading and session restoration. The browser request log for guest mode showed only the HTML, stylesheet, gate, route helper, visitor module, and favicon request; no Auth SDK, workspace storage, Companion, Codex Runner, or AI module was requested.
- **Private flow:** The normal route still restores a session through Supabase Auth; email/password login still verifies the user with `getUser()`, checks the configured allowlist, and only then imports `src/app.js`. Cloud sync, Companion, Codex Runner, and AI code were not changed.
- **Verification:** `npm test` passes 7/7 checks; guest module/test syntax checks and `git diff --check` pass. Browser checks completed TK-1001, verified Home changing from 5 open/8 completed to 4/9, reset, and the independent second visitor session. The guest route requested only local static app files; `?mode=login` displayed the private login form without session restoration. No real credentials were entered or submitted.
- **Delivery:** Release commit `39e8394` is on `origin/main`; the repository is configured for EdgeOne deployment from `main`. Live propagation is not independently checked because the deployment URL is not recorded in the repository.
- **Existing data:** No Supabase records, legacy `daniel-workspace-v1` data, schemas, or Companion services were modified.

## Next action

If a public EdgeOne propagation check is needed, use the site's configured URL from EdgeOne.
