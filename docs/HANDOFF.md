# Handoff

## Current state

- **Updated:** 2026-10-10
- **Stage:** V3.1-A private Home implementation is committed as `bebe8dc` and pushed to `main`.
- **Private version:** `V3.1-A`; the isolated V3.0-C visitor experience remains separate.
- **Home:** Shows four clickable cloud-backed statistics, active project cards with real task progress/next task/update time, priority tasks, recent projects, and a lower-weight cloud-based AI suggestion. Companion status is secondary.
- **Filters:** Project statistics open Projects with either all records or `status=进行中`; task statistics open Tasks with incomplete or completed records. If cloud records are unavailable and no account cache exists, Home shows placeholders and the project/task lists do not expose local drafts as cloud records.
- **Verification so far:** `npm test` passes 7/7; changed JS syntax checks and `git diff --check` pass; a synthetic dashboard-model check passed. The existing logged-in production app showed 16 cloud projects (1 active), 2 tasks (2 incomplete, 0 complete), and the active `个人工作台` detail with its real next step and 0/1 task progress. The current Supabase status reported a sync failure while account data remained visible; no records were changed. After push, the public Pages root and `src/version.js` returned HTTP 200 and `V3.1-A`; the guest tab still renders the existing isolated demo. The production browser tab timed out after reload, so the deployed statistic-card interactions and Companion-offline Home are not yet browser-verified.
- **Delivery:** Source is pushed to `main`; the public Pages response serves `V3.1-A`. EdgeOne control-plane status was not available for an independent check. No database, login, Supabase permission, or visitor-demo code was changed.

## Next action

When the authenticated production tab responds again, verify the deployed V3.1-A Home against the baseline: all four clickable statistics and filtered records, project detail navigation, and the Home while Companion is unavailable. If any cloud count differs, report the discrepancy without changing data; otherwise finish the handoff with browser evidence.
