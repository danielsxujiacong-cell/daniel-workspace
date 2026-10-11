# Handoff

## Current state

- **Updated:** 2026-10-11
- **Stage:** V3.5-A.1 Companion origin routing repair.
- **Diagnosis:** The deployed `workspace.danielxu.cn` origin had no Companion endpoint route in `src/app.js`; the Companion CORS allowlist also omitted it. The page therefore never requested local inventory, leaving the GitHub unavailable placeholder visible.
- **Fix:** Added exact-origin routing and CORS permission, retained loopback-only read-only API behavior, and made local card data take precedence over empty/unavailable GitHub status.
- **Verification:** Before restart, custom-origin OPTIONS returned 403. After restarting the existing Companion task with the updated source, OPTIONS returned 204 with the exact allowed origin and private-network header; GET returned 200 with both n8n (`master`, dirty) and project-hub (`main`, clean). Six targeted JS tests and two Python origin tests pass; syntax and diff checks pass. Cache-busted EdgeOne index, app, and companion module return 200 with V3.5-A.1 source markers. No Supabase requests or mutations. Signed-in page rendering remains pending.

## Next action

In the signed-in Home page, verify the n8n AI Automation Lab and Daniel Project Hub cards show local commit/time/branch/dirty state, with Companion as the source; confirm cloud cards remain available when Companion is offline.
