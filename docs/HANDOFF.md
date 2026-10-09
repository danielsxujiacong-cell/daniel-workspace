# Handoff

## Current state

- **Updated:** 2026-10-10
- **Stage:** V3.0-C guest showcase polish is implemented, browser-checked, committed, and pushed to `main`.
- **Private version label:** Kept unchanged with the private mode; this handoff uses V3.0-C for the guest-only presentation update.
- **Visitor route:** `?mode=guest` loads the standalone demo with Home, Projects, Tasks, Knowledge, and Decisions. Home leads with the enterprise automation positioning and business value, labels the fixed-rule mock data and non-AI boundary, shows the five-stage TK-1001 flow, and provides a direct ticket entry. The two-minute tour is started manually; task filters, reset, and exit remain. TK-1001 still supports deterministic P1 guidance, a linked supplier exception SOP, solution selection, a simulated Decision, and completion with live Home/Tasks updates. Changes exist only in the mounted page's memory.
- **Isolation:** Guest and post-exit `?mode=login` routes skip Supabase config loading and session restoration. The browser request log for guest mode showed only the HTML, stylesheet, gate, route helper, visitor module, and favicon request; no Auth SDK, workspace storage, Companion, Codex Runner, or AI module was requested.
- **Private flow:** The normal route still restores a session through Supabase Auth; email/password login still verifies the user with `getUser()`, checks the configured allowlist, and only then imports `src/app.js`. Cloud sync, Companion, Codex Runner, and AI code were not changed.
- **Verification:** Desktop and 390×844 browser layouts were reviewed; the Home CTA opened TK-1001, and the browser completed its rule/SOP/Decision/completion flow. Reset returned to Home without starting the tour; exit showed `?mode=login` without restoring a session. `npm test` passes 7/7 checks; guest module/test syntax checks and `git diff --check` pass. Guest code remains free of private storage, network, and service modules. No credentials were entered or submitted.
- **Delivery:** The V3.0-C commit is on `origin/main`; the repository is configured for EdgeOne deployment from `main`. Live propagation is not independently checked because the deployment URL is not recorded in the repository.
- **Existing data:** No Supabase records, legacy `daniel-workspace-v1` data, schemas, or Companion services were modified.

## Next action

If a public EdgeOne propagation check is needed, use the site's configured URL from EdgeOne.
