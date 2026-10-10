# Handoff

## Current state

- **Updated:** 2026-10-10
- **Stage:** V3.1-A private Home implementation is ready for authenticated real-data acceptance. Changes are local and not committed or pushed.
- **Private version:** `V3.1-A`; the isolated V3.0-C visitor experience remains separate.
- **Home:** Shows four clickable cloud-backed statistics, active project cards with real task progress/next task/update time, priority tasks, recent projects, and a lower-weight cloud-based AI suggestion. Companion status is secondary.
- **Filters:** Project statistics open Projects with either all records or `status=进行中`; task statistics open Tasks with incomplete or completed records. If cloud records are unavailable and no account cache exists, Home shows placeholders and the project/task lists do not expose local drafts as cloud records.
- **Verification so far:** `npm test` passes 7/7; changed JS syntax checks and `git diff --check` pass; a synthetic dashboard-model check passed. The existing logged-in production app showed 16 cloud projects (1 active), 2 tasks (2 incomplete, 0 complete), and the active `个人工作台` detail with its real next step and 0/1 task progress. The current Supabase status reports a sync failure while account data remains visible; no records were changed. These counts are the acceptance baseline for the V3.1-A Home.
- **Delivery:** V3.1-A local changes are not yet committed. Production still serves V3.0-B, so the new statistic-card filters and Companion-offline Home must be checked after deployment. No database, login, Supabase permission, or visitor-demo code was changed.

## Next action

After the scoped changes are pushed, verify the deployed V3.1-A Home against the authenticated baseline: all four clickable statistics and filtered records, project detail navigation, and the Home while Companion is unavailable. Confirm visitor isolation remains intact. If any cloud count differs, report the discrepancy without changing data; otherwise finish the handoff with deployment evidence.
