# Handoff

## Current state

- **Updated:** 2026-09-30
- **Status:** V2.4.1 is complete and pushed to `main` at `e8825fd`; GitHub Pages is served with cache-busted V2.4.1 assets. The `DanielWorkspaceLocalCompanion` logon task is installed and running silently through `pythonw.exe` on `127.0.0.1:4174`.
- **Last completed:** Added startup detection, live rescanning, explicit offline/error status, and browser-local preservation of the last successful scan. Verified the local app and GitHub Pages load 16 real projects, a rescan advances the scan timestamp, and stopping the Companion leaves cached project data visible with a possibly-stale label. Companion remains a loopback-only read-only scanner; GitHub Pages CORS is limited to the exact Pages origin. Task Scheduler's logon trigger is registered and its action was started and stopped successfully in-session; Windows itself has not been restarted/logged out for a reboot-cycle test.

## Next action

The Companion is configured to start at user logon via Task Scheduler. To stop it now, run `Stop-ScheduledTask -TaskName "DanielWorkspaceLocalCompanion"`. To disable automatic startup, run `Unregister-ScheduledTask -TaskName "DanielWorkspaceLocalCompanion" -Confirm:$false`. To run it manually in the foreground, use `python local_companion.py` and press Ctrl+C to stop it. The scanner still scans only `D:\_Codex project`, checks document names without reading contents, compares only cached `origin/main` refs, and never mutates repositories. Real AI remains disabled; the `/api/chat` contract and server-only key boundary are unchanged. No V2.5 work is in scope.

## How to resume

1. Inspect Git status and safely pull if clean.
2. Confirm the scheduled task is running, or start it with `Start-ScheduledTask -TaskName "DanielWorkspaceLocalCompanion"`.
3. Open `http://localhost:4174` or the GitHub Pages URL. Review `README.md` and `docs/PROJECT_CONTEXT.md`.

## Open questions or risks

- `localStorage` is browser-specific and does not sync across devices. The last successful local scan is held in a separate browser-local cache. Reset Demo Data replaces this browser's custom workspace with the built-in sample data.
- The logon trigger and hidden `pythonw.exe` action are verified, but a full Windows restart/login remains untested because it would interrupt the active work session.
