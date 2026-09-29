# Handoff

## Current state

- **Updated:** 2026-09-29
- **Status:** V2.3 complete and pushed to `main`; GitHub Pages built the implementation commit `ec0a3b2`.
- **Last completed:** Added a loopback-only read-only companion for `D:\_Codex project`; Projects displays 14 local repositories and matches the Daniel Workspace repo to its existing project by GitHub identity. Details show local Git, last commit, modification time, and document presence; Dashboard shows local warnings; project Mock AI uses local status, cached GitHub data, TODOs, and document presence. Companion excludes hidden verification fixtures and does not fetch or mutate Git repositories. Browser regression covered V1 task and Knowledge flows, V2.1 Mock AI context, V2.2 GitHub refresh/cache, and V2.3 scan/details/AI.

## Next action

Do not start V2.4 unless Daniel explicitly requests it. To use the delivered V2.3 scanner, run `python local_companion.py` from this repository and open `http://localhost:4174`. V2.3 remains read-only: it scans only `D:\_Codex project`, checks document names without reading contents, compares only cached `origin/main` refs, and keeps scan results in page memory. Real AI remains separately disabled; the `/api/chat` contract and server-only key boundary are unchanged.

## How to resume

1. Inspect Git status and safely pull if clean.
2. Start `python local_companion.py` from this folder (Python 3 and Git in `PATH`).
3. Open `http://localhost:4174`; review `README.md` and `docs/PROJECT_CONTEXT.md`.

## Open questions or risks

- `localStorage` is browser-specific and does not sync across devices. Reset Demo Data replaces this browser's custom workspace with the built-in sample data.
