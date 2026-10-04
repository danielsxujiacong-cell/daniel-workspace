# Handoff

## Current state

- **Updated:** 2026-10-04
- **Status:** V2.6 is deployed and authenticated same-account refresh/read acceptance passed. A second-device read and cross-user RLS negative test remain for manual acceptance.
- **V2.5:** The user confirmed it was completed and accepted. The Companion remains loopback-only and read-only.
- **V2.6 database/migration:** The user confirmed `supabase/v2.6-cloud-sync.sql` was run and online migration completed. Do not run another migration automatically. The authenticated Pages session showed “已同步” after retry and refresh.
- **Live acceptance:** After refresh, one Task and one cloud Project remained visible. Knowledge and Decisions showed empty states with successful sync status. Projects separated cloud base data from the online local Companion inventory (16 local projects). The old `daniel-workspace-v1` notice remained in this Codex browser; the local source was preserved and not merged again.
- **RLS:** The SQL defines `auth.uid() = user_id` policies for all four tables, revokes `anon`/`public`, and grants CRUD to `authenticated`. The authenticated account read succeeded. No second Auth user was available to exercise cross-user isolation directly.
- **Implementation checks:** ESM syntax, `git diff --check`, and stubbed Supabase checks for demo filtering, user scoping, insert-only migration, Project field exclusion, upsert, and delete passed during V2.6 implementation.
- **Pages:** Current V2.6 entry and `src/cloud/sync.js` were published and returned HTTP 200.

## Next action

1. Sign in on a separate physical device with the same account and confirm the Task and Project are readable there.
2. If a second Auth user is ever added, verify that user's queries cannot read or change the allowlisted user's rows; keep the current single-account allowlist unchanged otherwise.
3. If Knowledge or Decisions are expected to contain migrated rows, verify those records on the second device; this account currently shows both collections empty.

## How to resume

1. Inspect Git status and current `main`/`origin/main` before editing.
2. Read this file, `README.md`, and `docs/PROJECT_CONTEXT.md`.
3. Complete only the remaining second-device and cross-user acceptance if available. Keep Companion read-only and stop after V2.6.

## Open limitations

- The second-device read and cross-user RLS isolation checks have not been run. The user's current Codex browser showed a preserved legacy-local-data notice; no second migration was triggered.
- This repository has no build step; ESM syntax and browser page startup are the applicable source checks.
- Never request or copy the user's password.
