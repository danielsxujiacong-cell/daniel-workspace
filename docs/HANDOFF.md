# Handoff

## Current state

- **Updated:** 2026-10-10
- **Stage:** V3.1-B cache-recovery fix is pushed to `main` and visible in the public app script.
- **Step 2-A:** The user reports 29 existing Supabase projects and has already run the additive project-pinning SQL. Supabase MCP was not used.
- **Sync recovery:** A successful authenticated cloud read now replaces cached Projects, Tasks, Knowledge, and Decisions; it does not merge stale cached business rows or automatically run bulk upsert/delete. Device-only settings, activities, local paths/GitHub snapshots, and remote pin values are preserved. Normal later edits compare against the freshly read cloud baseline.
- **Pins:** The Projects page showed three selected pins: AI Investment Dashboard, Daniel Workspace, and PPT Studio. Pin updates use only `is_pinned`, scoped by authenticated `user_id` and project ID.
- **Verification:** Targeted cloud-recovery and pin tests passed 13/13. A signed-in refresh showed 29 project cards and the three selected pins, but the cloud status remained at “正在读取”, so successful live cloud completion is unconfirmed. Re-login and second-device read are also pending.

## Next action

The user must enter their password themselves for the re-login check and use the second signed-in device for cross-device reading. First confirm the current cloud read completes; verify the 29 projects and the three pins, and do not edit/delete records during acceptance.
