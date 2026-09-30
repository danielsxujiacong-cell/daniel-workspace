# Handoff

## Current state

- **Updated:** 2026-09-30
- **Status:** V2.5 code and public Supabase URL/publishable key are configured. The allowed-user value is intentionally blank, so the app denies every account until the user's UUID or email is supplied.
- **Last completed:** Reused only the public client config from `D:\_Codex project\04_Web\lanlan-cloud-pet\supabase-config.js`. The public entry loads only `src/auth/gate.js`; a persisted session must pass `getUser()` and the single-user allowlist before importing the Workspace app. Logout clears the page and app memory and aborts the active Local Companion scan. Fresh-install demo data contains no personal repository URL or local project names. No service-role key, password, or private token was copied.
- **Not verified yet:** The Supabase Dashboard was not open in the available browser session. New-user signup must be disabled and the GitHub Pages URL added as Site URL and Redirect URL. Then supply one allowed Auth user's UUID or email and test login, refreshed-session access, logout, and the logged-in Companion scan of 16 projects.

## Next action

Complete the remaining Supabase Auth setup, then finish browser acceptance:

1. In Supabase Dashboard, open **Authentication → Settings** and turn off **Allow new users to sign up**.
2. Open **Authentication → URL Configuration**. Set **Site URL** to `https://danielsxujiacong-cell.github.io/daniel-workspace/` and add that same exact URL under **Redirect URLs**.
3. Put the sole allowed user's Supabase UUID or email in `SUPABASE_ALLOWED_USER` in `src/auth/config.js`; blank denies everyone. User UUID is preferred to avoid publishing an email.
4. Verify logged-out Pages shows only the login form and makes no Companion request or Workspace/cache localStorage read; sign in, reload, scan 16 local projects, test Light/Dark and a phone viewport, then sign out and confirm private DOM is cleared.

Do not begin V2.6 until the user requests it.

## How to resume

1. Read this file, `README.md`, and `docs/PROJECT_CONTEXT.md`; inspect Git state and synchronize safely.
2. Complete the Supabase Dashboard settings above, provide one allowed account identifier, and keep signup disabled.
3. Run `python local_companion.py` if the installed logon task is not active, open `http://127.0.0.1:4174`, then test auth and the post-login scan.

## Open questions or risks

- The public Supabase URL/publishable key are configured from Lanlan Cloud Pet. The account allowlist remains blank by design; the Dashboard signup/URL settings and real Auth account are not yet verified. No password or private key is needed in source control.
- Existing `daniel-workspace-v1` data and scan caches remain in the same browser localStorage and are not read before authentication; no cloud sync was added.
- The client auth session persists locally through the Supabase SDK. Workspace content remains local to this device and browser profile.
