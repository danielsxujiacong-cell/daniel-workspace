# Handoff

## Current state

- **Updated:** 2026-10-04
- **Stage:** V2.8 final acceptance is complete per the user's confirmation on 2026-10-04. The Supabase migration succeeded, and the listed manual acceptance flows passed. Do not start V2.9.
- **Version:** The sidebar reads `APP_VERSION` from `src/version.js`, currently `V2.8`.
- **Dashboard:** Local Companion findings are converted into structured suggestions. GLM may refine the title/reason/action text; only the application selects the issue and allowed actions. The card exposes project, task, and (for missing documentation) Codex actions.
- **Tasks:** AI Tasks include a deterministic source key and description, use the current authenticated user's existing sync path, and are deduplicated locally and by the new per-user partial unique index. Existing V2.6 tasks with empty new fields omit the new DB columns until the migration is applied.
- **Codex:** `action_runner.py` is separate from read-only `local_companion.py`, binds to `127.0.0.1:4175`, and only accepts exact Workspace origins and scanned projects under `D:\_Codex project`. Fixed missing-document actions include README, HANDOFF, TODO, and PROJECT_STATUS. Codex CLI runs with `--sandbox read-only`; the Runner returns a one-file diff and writes only after a second explicit confirmation. The file is created without overwriting. No arbitrary command, delete, commit, or push endpoint exists.
- **Runner use:** Ensure `codex.exe` is on `PATH`, start Companion as usual, then run `python action_runner.py` in a separate terminal. The Runner is intentionally not auto-started. If it or Codex CLI is unavailable, the UI offers a precise copyable Codex Task.
- **Delivery:** V2.8 implementation commit `0309c9b` is on `main`. During the 2026-10-04 closeout, the GitHub Pages entry, version, suggestions, app, and stylesheet all returned HTTP 200; Git fetch confirmed the pre-closeout `HEAD` matched `origin/main`. The closeout documentation is synchronized in the latest `main` commit.
- **Database migration and acceptance:** The user confirmed `supabase/v2.8-task-suggestions.sql` completed successfully in the existing Supabase project. The user also confirmed manual acceptance of Task creation, duplicate prevention, opening a project, handing off to Codex, the confirmation dialog, Action Runner execution, and rescan. Acceptance was reported by the user; a second account/device check is not confirmed here.
- **Verification:** JS and Python syntax, `git diff --check`, structured action allowlists, model action-field rejection, path-independent Task keys, Task serialization/user scope, V2.6 Task compatibility, Runner CORS, outside-root rejection, existing-document rejection, absent arbitrary-command endpoint, and a real Codex CLI read-only draft plus create-only apply against an ignored synthetic fixture passed during implementation. Manual UI and post-Runner rescan acceptance are user-confirmed.
- **Safety test fixture:** Runner test artifacts were kept in ignored `cache/` and removed after validation; no synthetic files are staged.
- **V2.6 data:** Preserve Supabase records and the legacy `daniel-workspace-v1` browser data. Do not rerun the old localStorage migration.

## Next action

No remaining V2.8 action is recorded. Do not start V2.9 without a new user request.

V2.8 is the requested scope. Do not start V2.9.
