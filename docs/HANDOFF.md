# Handoff

## Current state

- **Updated:** 2026-10-10
- **Stage:** V3.1-B cache-recovery, bounded read, and post-read rendering fix is prepared for `main`.
- **Step 2-A:** The user reports 29 existing Supabase projects and has already run the additive project-pinning SQL. Supabase MCP was not used.
- **Sync recovery:** A successful authenticated cloud read now replaces cached Projects, Tasks, Knowledge, and Decisions; it does not merge stale cached business rows or automatically run bulk upsert/delete. Device-only settings, activities, local paths/GitHub snapshots, and remote pin values are preserved. Normal later edits compare against the freshly read cloud baseline.
- **Pins:** The Projects page showed three selected pins: AI Investment Dashboard, Daniel Workspace, and PPT Studio. Pin updates use only `is_pinned`, scoped by authenticated `user_id` and project ID.
- **Read timeout:** Five authenticated, read-only requests (the four Workspace tables plus pin-column probe) share a 15-second AbortSignal deadline. A stalled request now aborts and reports its table; the existing cache remains display-only and no write/delete fallback runs. An anonymous REST probe returned 401 as expected and did not inspect user data.
- **Root cause:** The production browser console showed `TypeError: Cannot read properties of undefined (reading 'name')` at `src/ai/context.js:194`, called by the final render in `initializeCloudSync`. Cloud Dashboard `recentProjects` is a plain project array, while the context builder assumed local Companion's `{ item, project }` entries; accessing `item.name` threw and left the previously rendered “正在读取…” indicator visible. This identifies a post-read rendering failure, not a Supabase request failure.
- **Fix and verification:** The context builder now branches on Dashboard source and accepts both cloud project records and local wrapper entries. Targeted context, cloud-recovery and pin tests passed 16/16. Post-fix live confirmation is pending; no database read/write policy or records were changed.

## Next action

After deployment, refresh the signed-in workspace. Confirm the live status becomes “已同步” and the 29 cloud projects plus pins remain visible. For re-login, the user enters their password themselves; use a second signed-in device for cross-device reading. Do not edit/delete records during acceptance.
