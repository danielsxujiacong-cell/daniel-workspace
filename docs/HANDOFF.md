# Handoff

## Current state

- **Updated:** 2026-09-30
- **Status:** V2.4 Dashboard implementation and regression are complete; final GitHub push and Pages deployment verification are part of this handoff.
- **Last completed:** Rebuilt Dashboard around the best next project, live scan health, actionable findings, changes since the prior scan, and recently active local projects. Mock AI uses the current scan, cached GitHub snapshot, tasks, and document presence. The Companion remains read-only; a minimal browser-local baseline stores hashed identity, Git/document state, and modification time without project names or paths.

## Next action

To use the Dashboard with live local status, run `python local_companion.py` from this repository and open `http://localhost:4174`. The scanner still scans only `D:\_Codex project`, checks document names without reading contents, compares only cached `origin/main` refs, and never mutates repositories. Real AI remains disabled; the `/api/chat` contract and server-only key boundary are unchanged. No V2.5 work is in scope.

## How to resume

1. Inspect Git status and safely pull if clean.
2. Start `python local_companion.py` from this folder (Python 3 and Git in `PATH`).
3. Open `http://localhost:4174`; review `README.md` and `docs/PROJECT_CONTEXT.md`.

## Open questions or risks

- `localStorage` is browser-specific and does not sync across devices. Reset Demo Data replaces this browser's custom workspace with the built-in sample data.
