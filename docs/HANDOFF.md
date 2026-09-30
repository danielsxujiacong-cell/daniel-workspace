# Handoff

## Current state

- **Updated:** 2026-09-30
- **Status:** V2.5 authentication gate is implemented. The public entry fails closed because `src/auth/config.js` still has empty Supabase URL and anon/publishable key values.
- **Last completed:** The public entry loads only `src/auth/gate.js`. It verifies a persisted Supabase session with `getUser()` before importing the Workspace app. Logout clears the page and app memory and aborts the active Local Companion scan. Fresh-install demo data no longer includes a personal repository URL or local paths. A high-confidence secret scan of the working tree and reachable Git history found no matches.
- **Not verified yet:** Login with the real account, refreshed-session access, logged-in Companion scan of 16 projects, and end-to-end published Pages behavior all depend on Supabase project configuration and a provisioned existing user.

## Next action

Configure Supabase Auth, then finish browser acceptance:

1. In Supabase Auth settings, disable **Allow new users to sign up**; create or confirm the one existing email/password account in the Dashboard.
2. Add the project URL and public anon/publishable key to `src/auth/config.js`. Never use a `service_role` key or put a password/token in GitHub.
3. Add the GitHub Pages origin to the Supabase Auth site/redirect URL settings, then publish the config change.
4. Verify logged-out Pages shows only the login form and makes no Companion request or Workspace/cache localStorage read; sign in, reload, scan 16 local projects, test Light/Dark and a phone viewport, then sign out and confirm private DOM is cleared.

Do not begin V2.6 until the user requests it.

## How to resume

1. Read this file, `README.md`, and `docs/PROJECT_CONTEXT.md`; inspect Git state and synchronize safely.
2. Complete the Supabase setup above and keep the signup setting disabled.
3. Run `python local_companion.py` if the installed logon task is not active, open `http://127.0.0.1:4174`, then test auth and the post-login scan.

## Open questions or risks

- `src/auth/config.js` intentionally contains empty values, so login is unavailable until the existing Supabase project URL and public client key are configured. No Supabase project credentials or test password were present in the workspace.
- Existing `daniel-workspace-v1` data and scan caches remain in the same browser localStorage and are not read before authentication; no cloud sync was added.
- The client auth session persists locally through the Supabase SDK. Workspace content remains local to this device and browser profile.
