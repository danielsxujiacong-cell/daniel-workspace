# Handoff

## Current state

- **Updated:** 2026-10-03
- **Status:** V2.6 client is implemented; awaiting Supabase database initialization and final authenticated acceptance.
- **V2.5:** The user confirmed it was completed and accepted. This turn independently confirmed the Companion GET endpoint returns 16 projects.
- **V2.6 code:** Existing Supabase Auth client is reused. Tasks, Knowledge, Decisions, and Project base fields are scoped to the validated user; project paths, GitHub snapshots, Companion scans, and local Git state are excluded from cloud row serializers. A user-approved, conflict-ignoring legacy migration and a separate offline cloud cache are implemented.
- **Database:** A read-only PostgREST check returned `PGRST205` for all four tables. SQL is ready at `supabase/v2.6-cloud-sync.sql`; it has not been run.
- **Verification:** ESM syntax checks, `git diff --check`, and a stubbed Supabase simulation for demo filtering, user scoping, insert-only migration, project field exclusion, upsert, and delete passed. The local browser shows the unauthenticated login-only screen. Real authenticated CRUD and RLS are pending SQL initialization; no password was entered or collected.
- **Pages:** Push to `main` triggers the existing GitHub Pages workflow. Record its result and the final commit after deployment verification.

## Next action

1. Commit and push the V2.6 source and publish it with the existing Pages workflow.
2. In Supabase Dashboard → SQL Editor → New query, copy all of `supabase/v2.6-cloud-sync.sql` and click **Run**.
3. Sign in directly on the existing account, click the top sync status if it still shows an error, and accept the one-time migration only if the page finds old local records.
4. Verify Task create/edit/delete across refresh, Knowledge and Decision writes, Project notes/GitHub URL, local Companion independence, RLS isolation, and a second device.

## How to resume

1. Inspect Git status and current `main`/`origin/main` before editing.
2. Read this file, `README.md`, and `docs/PROJECT_CONTEXT.md`.
3. Complete the SQL initialization and authenticated acceptance above. Keep Companion read-only and stop after V2.6.

## Open limitations

- Until SQL runs, cloud tables and their RLS policies do not exist, so cloud reads/writes cannot pass the final live acceptance. The app retains local data and reports sync failure.
- This repository has no build step; ESM syntax and browser page startup are the applicable source checks.
- The user must enter their own password in the Pages login form; never request or copy it.
