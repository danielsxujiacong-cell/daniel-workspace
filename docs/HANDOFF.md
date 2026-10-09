# Handoff

## Current state

- **Updated:** 2026-10-09
- **Stage:** V3.0-A visitor demo is implemented, regression-tested, and pushed to `main`.
- **Version:** `src/version.js` reports `V3.0-A`.
- **Visitor route:** `?mode=guest` loads the standalone read-only demo. It contains simulated Home, Projects, Tasks, Knowledge, and Decisions data; a skippable two-minute tour; task filters; reset; and exit. State exists only in page memory.
- **Isolation:** Guest and post-exit `?mode=login` routes skip Supabase config loading and session restoration. The browser request log for guest mode showed only the HTML, stylesheet, gate, route helper, visitor module, and favicon request; no Auth SDK, workspace storage, Companion, Codex Runner, or AI module was requested.
- **Private flow:** The normal route still restores a session through Supabase Auth; email/password login still verifies the user with `getUser()`, checks the configured allowlist, and only then imports `src/app.js`. Cloud sync, Companion, Codex Runner, and AI code were not changed.
- **Verification:** `npm test` passes 4/4 isolation/login regression checks; JavaScript syntax checks and `git diff --check` pass. Browser checks covered the visitor link, all five pages, guided tour next/complete/skip, completed-task filter, reset, exit, and the post-exit login form. No real credentials were entered, so a credentialed successful sign-in was not retested.
- **Delivery:** Release source is on `main`. EdgeOne is configured to deploy from `main`; public propagation was not independently checked because this repository does not document the EdgeOne URL.
- **Existing data:** No Supabase records, legacy `daniel-workspace-v1` data, schemas, or Companion services were modified.

## Next action

If a public EdgeOne propagation check is needed, use the site's configured URL from EdgeOne. V3.0-B work is out of scope.
