# Handoff

## Current state

- **Updated:** 2026-10-10
- **Stage:** Emergency private-workspace reset protection is implemented; the private sidebar reset controls and handler are removed.
- **Safety:** The shared store refuses `resetData()`. Supabase full sync and project insertion reject built-in Mock IDs, and local migration excludes those IDs even if fixture contents were edited. Visitor reset remains in the isolated in-memory module.
- **Verification:** `npm test` passes 11/11, including the new targeted reset/cloud-write regressions; `git diff --check` passes.
- **Database audit:** The authenticated read-only export completed for all four tables: Projects 3, Tasks 6, Knowledge 5, Decisions 2. Every current row ID matches the built-in Mock fixtures; no real row is present in these current results. Four JSON backups were saved to a local D: drive directory outside this repository; the backup files are not tracked. No database row was changed.
- **Known comparison point:** The user reports 16 original real projects before the reset. Earlier app cache history also showed 16 projects and 2 incomplete tasks (0 completed), but that was not a live database count. The current local and cloud caches both contain only the 3/6/5/2 Mock fixture rows. Therefore all 16 reported original projects may be absent; previous real Task, Knowledge, and Decision names/counts cannot be established from available history. A Knowledge test row was retained and a Decision test row was deleted during the 2026-10-04 acceptance, which does not establish the incident's earlier totals.
- **Delivery:** Code fix `5e82d56` and its initial handoff `8c550b2` were pushed to `main`. Cache-busted EdgeOne and GitHub Pages asset checks confirmed the private reset code is absent and the Mock-write guard is present. No database restore or project rescan was performed.

## Next action

No database recovery is authorized in this incident. Keep the four local JSON backups outside Git; any restoration or record reconstruction requires a separate explicit request.
