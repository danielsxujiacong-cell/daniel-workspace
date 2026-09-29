# Handoff

## Current state

- **Updated:** 2026-09-29
- **Status:** V2.3 implementation and browser regression complete; release push and Pages verification are the remaining handoff steps.
- **Last completed:** Added a loopback-only read-only companion for `D:\_Codex project`; Projects displays 14 discovered local projects and matches the Daniel Workspace repo to its existing project by GitHub identity. Details show local Git, last commit, modification time, and document presence; Dashboard shows local warnings; project Mock AI uses local status, cached GitHub data, TODOs, and document presence. Companion excludes hidden verification fixtures and does not fetch or mutate Git repositories.

## Next action

Do not start V2.4. V2.3 remains read-only: the companion is bound to loopback, scans only `D:\_Codex project`, checks document names without reading contents, compares only the locally cached `origin/main`, and keeps scan results in memory. No source files in scanned projects are changed. Real AI remains separately disabled; the `/api/chat` contract and server-only key boundary are unchanged.

## How to resume

1. Inspect Git status and safely pull if clean.
2. Start `python local_companion.py` from this folder (Python 3 and Git in `PATH`).
3. Open `http://localhost:4174`; review `README.md` and `docs/PROJECT_CONTEXT.md`.

## Open questions or risks

- `localStorage` is browser-specific and does not sync across devices. Reset Demo Data replaces this browser's custom workspace with the built-in sample data.
