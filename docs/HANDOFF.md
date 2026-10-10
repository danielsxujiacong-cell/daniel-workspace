# Handoff

## Current state

- **Updated:** 2026-10-10
- **Stage:** Emergency private-workspace reset protection is implemented; the private sidebar reset controls and handler are removed.
- **Safety:** The shared store refuses `resetData()`. Supabase full sync and project insertion reject built-in Mock IDs, and local migration excludes those IDs even if fixture contents were edited. Visitor reset remains in the isolated in-memory module.
- **Verification:** `npm test` passes 11/11, including the new targeted reset/cloud-write regressions; `git diff --check` passes.
- **Database access:** Anonymous PostgREST reads of `workspace_projects`, `workspace_tasks`, `workspace_knowledge`, and `workspace_decisions` each returned HTTP 401. No database rows were read, modified, or exported, and no backup directory was created. Continue only after an authenticated read-only session is available.
- **Known comparison point:** The 2026-10-10 production app's last cloud-cache view showed 16 projects and 2 incomplete tasks (0 completed); that view had a Supabase sync error and is not a live database count. The user reports that `workspace_projects` currently has 3 rows; this was not independently verified. Available history says a Knowledge test row was retained and a Decision test row was deleted during the 2026-10-04 acceptance, but it does not establish current totals for either table.
- **Delivery:** `5e82d56` was pushed to `main`. Cache-busted EdgeOne requests to `https://workspace.danielxu.cn/src/app.js` and `/src/cloud/sync.js` returned HTTP 200 and confirmed the private reset code is absent and the Mock-write guard is present. The GitHub Pages origin returned the same updated assets. No database restore or project rescan was performed.

## Next action

When authenticated read-only database access is available, export the four named tables to local JSON backups, then inspect current counts and Mock IDs without changing records.
