# Handoff

## Current state

- **Updated:** 2026-09-30
- **Status:** Investigating a V2.5 login-submit bug reported from Pages. The error screenshot shows the delegated handler receives `#app` as `event.currentTarget`, then reads `form.elements.email` before its `try` block. This throws before setting the busy state or calling `signInWithPassword()`.
- **Last completed:** V2.5 is deployed at `b298a7d`; public Auth settings confirm signup is disabled. The user-provided Site URL/Redirect URL are reported configured. Existing source confirms the Pages entry loads only the auth gate, the allowlisted user UUID is configured, and the Companion is only reachable after Workspace import. No password or private key was copied.
- **Next:** Fix the handler to accept the submitted form target, resolve fields by ID, and show all initialization/request errors in the page. Bump the gate asset version, run syntax/whitespace checks, push, wait for Pages, then verify a synthetic invalid-credential submit reaches Supabase Auth and produces a visible response. Never use or request the user's real password.

## Next action

Finish browser acceptance after the submit bug fix is deployed:

1. Use synthetic invalid credentials to confirm the button calls Supabase Auth and displays its response; never use the user's password.
2. Have the user enter the existing password directly in the Pages form if real login acceptance is required; never collect the password. Then verify session persistence after reload, scan 16 local projects, and sign out.

Do not begin V2.6 until the user requests it.

## How to resume

1. Read this file, `README.md`, and `docs/PROJECT_CONTEXT.md`; inspect Git state and synchronize safely.
2. Complete the real login, refreshed-session, logout, and 16-project Companion checks; do not begin V2.6.
3. Run `python local_companion.py` if the installed logon task is not active, open `http://127.0.0.1:4174`, then test auth and the post-login scan.

## Open questions or risks

- The public Supabase URL/publishable key and user UUID allowlist are configured from approved sources. The signup setting is verified off; Site URL/Redirect URL were reported complete but cannot be read through the public settings endpoint. No password or private key is needed in source control.
- Existing `daniel-workspace-v1` data and scan caches remain in the same browser localStorage and are not read before authentication; no cloud sync was added.
- The client auth session persists locally through the Supabase SDK. Workspace content remains local to this device and browser profile.
