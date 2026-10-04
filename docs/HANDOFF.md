# Handoff

## Current state

- **Updated:** 2026-10-04
- **Stage:** V2.8 implementation is pushed. The user explicitly started V2.8; this replaces the earlier V2.7 stop note. Supabase migration and signed-in acceptance remain pending.
- **Version:** The sidebar reads `APP_VERSION` from `src/version.js`, currently `V2.8`.
- **Dashboard:** Local Companion findings are converted into structured suggestions. GLM may refine the title/reason/action text; only the application selects the issue and allowed actions. The card exposes project, task, and (for missing documentation) Codex actions.
- **Tasks:** AI Tasks include a deterministic source key and description, use the current authenticated user's existing sync path, and are deduplicated locally and by the new per-user partial unique index. Existing V2.6 tasks with empty new fields omit the new DB columns until the migration is applied.
- **Codex:** `action_runner.py` is separate from read-only `local_companion.py`, binds to `127.0.0.1:4175`, and only accepts exact Workspace origins and scanned projects under `D:\_Codex project`. Fixed missing-document actions include README, HANDOFF, TODO, and PROJECT_STATUS. Codex CLI runs with `--sandbox read-only`; the Runner returns a one-file diff and writes only after a second explicit confirmation. The file is created without overwriting. No arbitrary command, delete, commit, or push endpoint exists.
- **Runner use:** Ensure `codex.exe` is on `PATH`, start Companion as usual, then run `python action_runner.py` in a separate terminal. The Runner is intentionally not auto-started. If it or Codex CLI is unavailable, the UI offers a precise copyable Codex Task.
- **Delivery:** Commit `0309c9b` is on `main`. GitHub Pages entry, version, suggestions, app, and stylesheet all returned HTTP 200 with V2.8 markers. Final Git fetch confirmed `HEAD = origin/main`; the working tree was clean before this handoff update.
- **Database migration:** `supabase/v2.8-task-suggestions.sql` must be run once in the existing Supabase project's SQL Editor before claiming cloud persistence of AI Task descriptions/source keys or live duplicate protection. The current environment does not provide a signed-in Supabase Dashboard session, so migration and live sync acceptance remain pending.
- **Verification:** JS and Python syntax, `git diff --check`, structured action allowlists, model action-field rejection, path-independent Task keys, Task serialization/user scope, V2.6 Task compatibility, Runner CORS, outside-root rejection, existing-document rejection, absent arbitrary-command endpoint, and a real Codex CLI read-only draft plus create-only apply against an ignored synthetic fixture passed. The signed-in Workspace UI and post-Runner Companion rescan were not available in this run; do not mark those browser acceptance items complete.
- **Safety test fixture:** Runner test artifacts were kept in ignored `cache/` and removed after validation; no synthetic files are staged.
- **V2.6 data:** Preserve Supabase records and the legacy `daniel-workspace-v1` browser data. Do not rerun the old localStorage migration.

## Next action

1. After the code is pushed, open Supabase Dashboard → SQL Editor, run `supabase/v2.8-task-suggestions.sql`, and verify it completes.
2. Sign in to the deployed Workspace. Verify creating an AI Task, duplicate prevention after refresh, project navigation, canceling the Codex confirmation, and the Codex diff/second-confirmation flow; then rescan and confirm the missing document appears.
3. Confirm the AI Task description/source remain visible after refresh and on the other signed-in device.

V2.8 is the requested scope. Do not start V2.9.
