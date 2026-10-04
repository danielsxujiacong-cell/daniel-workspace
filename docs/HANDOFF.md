# Handoff

## Current state

- **Updated:** 2026-10-04
- **Status:** V2.6 final acceptance is incomplete. Tasks and Knowledge refresh checks passed; Decisions was saved but could not be checked after refresh. A second-device read and cross-user isolation test remain unverified.
- **V2.5:** The user confirmed it was completed and accepted. The Companion remains loopback-only and read-only.
- **V2.6 database/migration:** The user confirmed `supabase/v2.6-cloud-sync.sql` was run and online migration completed. Do not run another migration automatically. The authenticated Pages session showed “已同步” after retry and refresh.
- **Live acceptance:** The existing Task remained after refresh. `V2.6 Knowledge acceptance 20261004` remained after refresh; the user explicitly asked to keep it. `V2.6 Decisions acceptance 20261004 - sync verification` was saved, but a refresh in the Codex browser showed a Supabase Auth initialization error before its persistence could be verified. The user's screenshot separately shows their Chrome Home page logged in with sync status “已同步”; the Decisions page is not visible in that screenshot. The old `daniel-workspace-v1` notice was left untouched; no second migration ran.
- **Projects and Companion:** The cloud Project base record remained visible while the scheduled Companion was stopped; the cached 16-item local inventory was retained and labelled as possibly stale. The Companion was restarted, and its read-only API returned 16 items.
- **RLS:** The SQL defines `auth.uid() = user_id` policies for all four tables, revokes `anon`/`public`, and grants CRUD to `authenticated`. Direct anonymous PostgREST reads of `workspace_tasks`, `workspace_knowledge`, `workspace_decisions`, and `workspace_projects` each returned HTTP 401 `permission denied`. A second Auth user was not available for a cross-user test.
- **Login retry fix:** The Auth client is now initialized on demand when the login button is used after a boot/session initialization failure. The private app still waits for successful `getUser()` validation. Syntax and whitespace checks passed; the final Pages run for this change must be checked after push.
- **Implementation checks:** ESM syntax, `git diff --check`, and stubbed Supabase checks for demo filtering, user scoping, insert-only migration, Project field exclusion, upsert, and delete passed during V2.6 implementation.
- **Pages:** Current V2.6 entry and `src/cloud/sync.js` were published and returned HTTP 200.

## Next action

1. After the login retry fix is deployed, hard-refresh `#decisions` in the user's already logged-in Chrome and confirm the Decisions test record remains.
2. At the deletion step, ask for action-time confirmation before permanently deleting that Decisions test record. Keep the Knowledge test record; the user chose to retain it.
3. If available, sign in on a separate physical device with the same account and confirm the Task and Project are readable there.
4. If a second Auth user is ever available, verify it cannot read or change the allowlisted user's rows; the anonymous boundary has already been verified for all four tables.

## How to resume

1. Inspect Git status and current `main`/`origin/main` before editing.
2. Read this file, `README.md`, and `docs/PROJECT_CONTEXT.md`.
3. Complete the Decisions refresh check and only then continue other remaining V2.6 acceptance. Keep Companion read-only and stop after V2.6.

## Open limitations

- The Decisions post-refresh check is pending. The user's Codex in-app browser was not interchangeable with the logged-in Chrome session, and Windows UI control could not establish the Chrome page URL. The user-provided screenshot shows Chrome logged in, but not the Decisions record.
- The second-device read and cross-user RLS isolation checks have not been run. No second migration was triggered and no legacy localStorage data was deleted.
- This repository has no build step; ESM syntax and browser page startup are the applicable source checks.
- Never request or copy the user's password.
