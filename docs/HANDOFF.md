# Handoff

## Current state

- **Updated:** 2026-10-10
- **Stage:** V3.1-B Home pinning source and additive migration are prepared for `main`.
- **Step 2-A:** The user confirmed the manual Supabase SQL import added 26 real projects. With the 3 existing Mock projects, the signed-in Workspace shows 29 projects; the user also confirmed cross-device cloud sync. This turn did not use Supabase MCP or re-read database rows.
- **Home behavior:** Only shows manually pinned projects after at least 3 are selected, with a maximum of 5. The complete project list remains in Projects. Cards use stored stage/next values and real linked-task counts; missing values say “未填写”. GitHub/site links are validated HTTP/HTTPS shortcuts.
- **Pin storage:** `workspace_projects.is_pinned` is the only new field. `supabase/v3.1-b-project-pinning.sql` adds it with `NOT NULL DEFAULT false`; existing rows are not otherwise changed. The client detects a missing field and disables pin controls. A user pin action updates only this field with both `user_id` and project `id` filters, preserving all other project fields and RLS.
- **Live check:** The public entry returned HTTP 200 with the Daniel Workspace title. Authenticated Home interaction was not inspected in this turn; the 29-project and cross-device acceptance above is user-confirmed.
- **Verification:** Targeted pin-limit, missing-schema, cloud-load, and single-field update tests are in `tests/project-pinning.test.js`; run them and the repository checks before delivery.

## Next action

After source delivery, the user must run `supabase/v3.1-b-project-pinning.sql` in Supabase SQL Editor, then verify pin/unpin, the 3–5 Home threshold, the five-project limit, and the same pinned set on the second device. No AI brief or GitHub synchronization work is in scope.
