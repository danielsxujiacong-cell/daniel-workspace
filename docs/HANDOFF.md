# Handoff

## Current state

- **Updated:** 2026-10-10
- **Stage:** V3.1-A private Home implementation, single-focus-card layout, and CSS cache-busting are pushed to `main` (`bebe8dc`, `fffd220`, `b538fce`, `fcc2a6d`).
- **Private version:** `V3.1-A`; the isolated V3.0-C visitor experience remains separate.
- **Home:** Shows four clickable cloud-backed statistics, active project cards with real task progress/next task/update time, priority tasks, recent projects, and a lower-weight cloud-based AI suggestion. Companion status is secondary.
- **Filters:** Project statistics open Projects with either all records or `status=进行中`; task statistics open Tasks with incomplete or completed records. If cloud records are unavailable and no account cache exists, Home shows placeholders and the project/task lists do not expose local drafts as cloud records.
- **Verification:** `npm test` passes 7/7; `git diff --check` passes. In the authenticated production app, cloud-cache counts were 16 projects, 1 active project, 2 incomplete tasks, and 0 completed tasks. All four Home cards opened the matching filtered records; `个人工作台` opened `project-workspace` with its recorded next task and 0/1 progress. With Companion stopped, Home retained the same cloud-cache projects/tasks and showed `Companion 离线 · 缓存 19 个项目`; the original read-only Companion process was restarted and returned online. Visitor code was untouched and existing guest-isolation tests passed. No application records were edited during verification.
- **Open sync state:** Production displays Supabase sync errors while retaining the last successful account cloud cache and a retry button. The latest reload showed `Cannot read properties of undefined (reading 'name')` and cache time `2026/10/10 13:03`; an earlier attempt showed `JWT issued at future`. Counts and filters were therefore verified against cached cloud records, not a successful live pull. Do not change auth, RLS, or database records as part of this Home task.
- **Delivery:** Code is pushed to `main`. Repository instructions describe automatic GitHub Pages publishing from the `main` root; EdgeOne control-plane deployment was not independently verified. No database, login, Supabase permission, or visitor-demo code was changed.

## Next action

The V3.1-A Home acceptance is complete. If continuing this project, investigate the production Supabase runtime error separately without changing auth/RLS/data; confirm EdgeOne only if that hosting target is still required in addition to the documented GitHub Pages deployment.
