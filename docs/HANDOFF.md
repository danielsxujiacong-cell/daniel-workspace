# Handoff

## Current state

- **Updated:** 2026-10-10
- **Stage:** V3.1-B cache-recovery fix is prepared for `main`.
- **Step 2-A:** The user reports 29 existing Supabase projects and has already run the additive project-pinning SQL. Supabase MCP was not used.
- **Sync recovery:** A successful authenticated cloud read now replaces cached Projects, Tasks, Knowledge, and Decisions; it does not merge stale cached business rows or automatically run bulk upsert/delete. Device-only settings, activities, local paths/GitHub snapshots, and remote pin values are preserved. Normal later edits compare against the freshly read cloud baseline.
- **Pins:** The Projects page showed three selected pins: AI Investment Dashboard, Daniel Workspace, and PPT Studio. Pin updates use only `is_pinned`, scoped by authenticated `user_id` and project ID.
- **Verification:** Targeted cloud-recovery and pin tests passed 13/13. Production refresh after the recovery change, re-login, and second-device read still need authenticated acceptance.

## Next action

After deployment, refresh the signed-in browser and confirm the cloud error clears, all 29 Supabase projects and the three pins remain. For re-login, the user must enter their password themselves. Cross-device reading requires the user to check the second signed-in device; no records should be edited/deleted during these checks.
