# Handoff

## Current state

- **Updated:** 2026-09-30
- **Status:** V2.5 code and the sole allowed user's UUID are configured and deployed at commit `81939d7`. Public Auth settings confirm new-user signup is disabled. The user reports the GitHub Pages Site URL and Redirect URL are configured.
- **Last completed:** Reused only the public client config from `D:\_Codex project\04_Web\lanlan-cloud-pet\supabase-config.js`. Live Pages index, auth gate, and auth config return HTTP 200 with the expected project URL, UUID, and public key prefix. The entry loads only `src/auth/gate.js`; it verifies `getUser()` and the UUID allowlist before importing the Workspace app. The gate module itself has no Companion URL. Logout clears the private page and app memory and aborts the active Local Companion scan. Fresh-install demo data contains no personal repository URL or local project names. No service-role key, password, or private token was copied.
- **Not verified yet:** Real online login, refreshed-session access, logout, and logged-in Companion scan of 16 projects. The public Auth settings endpoint does not expose Site URL/Redirect URL values, so those remain user-reported. The user must enter the existing password directly in the open login page; do not request or store it.

## Next action

Finish browser acceptance:

1. Have the user enter the existing password directly in the open Pages login form. Never collect the password.
2. Verify session persistence after reload, scan 16 local projects, test Light/Dark and a phone viewport, then sign out and confirm private DOM is cleared.

Do not begin V2.6 until the user requests it.

## How to resume

1. Read this file, `README.md`, and `docs/PROJECT_CONTEXT.md`; inspect Git state and synchronize safely.
2. Complete the real login, refreshed-session, logout, and 16-project Companion checks; do not begin V2.6.
3. Run `python local_companion.py` if the installed logon task is not active, open `http://127.0.0.1:4174`, then test auth and the post-login scan.

## Open questions or risks

- The public Supabase URL/publishable key and user UUID allowlist are configured from approved sources. The signup setting is verified off; Site URL/Redirect URL were reported complete but cannot be read through the public settings endpoint. No password or private key is needed in source control.
- Existing `daniel-workspace-v1` data and scan caches remain in the same browser localStorage and are not read before authentication; no cloud sync was added.
- The client auth session persists locally through the Supabase SDK. Workspace content remains local to this device and browser profile.
