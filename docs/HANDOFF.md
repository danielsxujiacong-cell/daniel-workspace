# Handoff

## Current state

- **Updated:** 2026-10-10
- **Stage:** V3.1-B cache-recovery and bounded cloud-read fix is prepared for `main`.
- **Step 2-A:** The user reports 29 existing Supabase projects and has already run the additive project-pinning SQL. Supabase MCP was not used.
- **Sync recovery:** A successful authenticated cloud read now replaces cached Projects, Tasks, Knowledge, and Decisions; it does not merge stale cached business rows or automatically run bulk upsert/delete. Device-only settings, activities, local paths/GitHub snapshots, and remote pin values are preserved. Normal later edits compare against the freshly read cloud baseline.
- **Pins:** The Projects page showed three selected pins: AI Investment Dashboard, Daniel Workspace, and PPT Studio. Pin updates use only `is_pinned`, scoped by authenticated `user_id` and project ID.
- **Read timeout:** Five authenticated, read-only requests (the four Workspace tables plus pin-column probe) share a 15-second AbortSignal deadline. A stalled request now aborts and reports its table; the existing cache remains display-only and no write/delete fallback runs. An anonymous REST probe returned 401 as expected and did not inspect user data.
- **Verification:** Focused cloud-recovery and pin tests passed 14/14, including a synthetic request that never settles until aborted. Live signed-in success, re-login, and second-device read remain pending; the current browser automation stalled before a fresh status could be captured.

## Next action

After deployment, refresh the signed-in workspace. Expect “Supabase 已同步” or a clear timeout/error that names the stalled resource; verify the 29 projects and selected pins. For re-login, the user enters their password themselves; use a second signed-in device for cross-device reading. Do not edit/delete records during acceptance.
