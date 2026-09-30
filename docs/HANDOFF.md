# Handoff

## Current state

- **Updated:** 2026-09-30
- **Status:** V2.5 login-submit fix deployed at `42c4f58`; source and deployed assets show the delegated handler uses the submitted form, displays progress/errors, and calls `signInWithPassword()`.
- **Last completed:** GitHub Pages reports `built`; live index, auth gate, and config return HTTP 200 and the entry loads auth gate `v2.5.2`. The deployed gate contains the form-target fix and visible error handling. A synthetic invalid-credential POST to this project's Supabase Auth endpoint returned HTTP 400 as expected. Public Auth settings confirm signup is disabled. The user-provided Site URL/Redirect URL are reported configured. No real password or private key was copied.
- **Not verified yet:** An automated browser tab could not be bound, so there is no observed click-through from the live page. The user's real successful login, refreshed-session access, logout, and logged-in Companion scan of 16 projects still require direct acceptance in the browser; never collect the password.

## Next action

Finish browser acceptance:

1. Have the user enter the existing password directly in the Pages form and confirm the page responds; never collect the password. Then verify session persistence after reload, scan 16 local projects, and sign out.

Do not begin V2.6 until the user requests it.

## How to resume

1. Read this file, `README.md`, and `docs/PROJECT_CONTEXT.md`; inspect Git state and synchronize safely.
2. Complete the real login, refreshed-session, logout, and 16-project Companion checks; do not begin V2.6.
3. Run `python local_companion.py` if the installed logon task is not active, open `http://127.0.0.1:4174`, then test auth and the post-login scan.

## Open questions or risks

- The public Supabase URL/publishable key and user UUID allowlist are configured from approved sources. The signup setting is verified off; Site URL/Redirect URL were reported complete but cannot be read through the public settings endpoint. No password or private key is needed in source control.
- Existing `daniel-workspace-v1` data and scan caches remain in the same browser localStorage and are not read before authentication; no cloud sync was added.
- The client auth session persists locally through the Supabase SDK. Workspace content remains local to this device and browser profile.
