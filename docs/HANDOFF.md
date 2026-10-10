# Handoff

## Current state

- **Updated:** 2026-10-10
- **Stage:** V3.2 Step 2-C public GitHub development activity is pushed to `main` as `f8ca063`.
- **Step 2-B:** The user confirmed Supabase sync works with 29 projects and 5 pinned projects. No Supabase schema or records changed in Step 2-C.
- **GitHub activity:** Home automatically reads only pinned public repositories and shows the latest commit summary/time plus the last-seven-day commit count. Automatic reads use a one-hour device-local cache; the Home button forces a refresh. Private/inaccessible and local-only projects show unavailable status. Snapshots are written only to the existing local cloud cache, never sent through Supabase sync.
- **Step 2-C verification:** The focused GitHub/pinning tests pass 14/14; JS syntax and `git diff --check` pass. Cache-busted production HTML, gate, app, GitHub API module, and CSS on `workspace.danielxu.cn` returned HTTP 200 with the V3.2 markers. The available browser showed the login page, so authenticated Home/card and refresh-link interaction acceptance remains pending; no credentials were entered.
- **Sync recovery:** A successful authenticated cloud read now replaces cached Projects, Tasks, Knowledge, and Decisions; it does not merge stale cached business rows or automatically run bulk upsert/delete. Device-only settings, activities, local paths/GitHub snapshots, and remote pin values are preserved. Normal later edits compare against the freshly read cloud baseline.
- **Pins:** Current Home shows 5/5 selected pins: AI Investment Dashboard, Daniel Project Hub, Daniel website, Daniel Workspace, and n8n AI Automation Lab. Pin updates use only `is_pinned`, scoped by authenticated `user_id` and project ID.
- **Read timeout:** Five authenticated, read-only requests (the four Workspace tables plus pin-column probe) share a 15-second AbortSignal deadline. A stalled request now aborts and reports its table; the existing cache remains display-only and no write/delete fallback runs. An anonymous REST probe returned 401 as expected and did not inspect user data.
- **Root cause:** The production browser console showed `TypeError: Cannot read properties of undefined (reading 'name')` at `src/ai/context.js:194`, called by the final render in `initializeCloudSync`. Cloud Dashboard `recentProjects` is a plain project array, while the context builder assumed local Companion's `{ item, project }` entries; accessing `item.name` threw and left the previously rendered “正在读取…” indicator visible. This identifies a post-read rendering failure, not a Supabase request failure.
- **Fix and verification:** The context builder now branches on Dashboard source and accepts both cloud project records and local wrapper entries. Targeted context, cloud-recovery and pin tests passed 16/16. After a fresh signed-in page reload, the live indicator changed to “已同步 20:22”; Home showed 29 projects, 14 active, 5 open tasks, 1 completed task, and 5/5 pins. No new runtime errors appeared after the reload; previously captured errors are from before the fix. Ordinary Chrome Incognito and a second device remain unverified. No database read/write policy or records were changed.

## Next action

In a signed-in browser, confirm the 29-project/5-pin Home and verify an available public repository card, its Commit link, manual refresh, and the unavailable label for a private or local-only project. Do not edit/delete records or change Supabase settings during acceptance.
