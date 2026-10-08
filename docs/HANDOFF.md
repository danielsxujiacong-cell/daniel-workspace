# Handoff

## Current state

- **Updated:** 2026-10-08
- **Stage:** V2.9 mobile-home fallback is complete and deployed.
- **Version:** `src/version.js` reports `V2.9`.
- **Dashboard:** A ready Companion keeps the existing local-scan model. When unavailable, the home card chooses a cloud-linked todo first, then the highest-priority unlinked todo, then a cloud Project. The card says「基于云端资料」; health metrics and scan controls are unavailable in this state.
- **Assistant:** Home context continues to include the current account's Projects, Tasks (including bounded descriptions), Knowledge, and Decisions. With Companion unavailable, stale local scan records and Git fields are excluded. GLM remains behind the existing Cloudflare Worker; the Worker and database schema were not changed.
- **Boundaries:** No Supabase schema/RLS, Local Companion, or Action Runner changes. No new dependencies.
- **Tasks:** AI Tasks keep their deterministic source key and description, use the current authenticated user's existing sync path, and are deduplicated locally and by the V2.8 per-user partial unique index.
- **Codex Runner:** `action_runner.py` remains separate from read-only `local_companion.py`, binds to `127.0.0.1:4175`, and only accepts the fixed missing-document actions under `D:\_Codex project`. It creates a reviewed one-file draft only after a second confirmation; no arbitrary command, delete, commit, or push endpoint exists. Run `python action_runner.py` separately when needed.
- **V2.8 acceptance:** The user confirmed `supabase/v2.8-task-suggestions.sql` completed and manually accepted Task creation/deduplication, project navigation, Codex confirmation, Runner execution, and rescan. A second Auth user/device check was not confirmed.
- **Delivery:** Commit `c27efe3ea6b4fe5132ef002f628cd0524c7be926` is on `main`. GitHub Pages reports `built` for that commit; the entry page, version, app, dashboard, and stylesheet returned HTTP 200.
- **Verification:** Focused dashboard/context assertions and browser checks covered Companion online, cloud fallback, empty cloud data, AI flow with synthetic cloud records, and a 390px viewport without horizontal overflow. Browser AI responses used a local fixture; a real authenticated session and live GLM conversation were not re-tested. This static app has no build step.
- **Existing data:** Preserve Supabase records and legacy `daniel-workspace-v1` browser data. Do not rerun the migration.

## Next action

V2.9 is the requested scope. Stop here and wait for a new user request before further development.
