# Project instructions

## Orientation

- Read `README.md`, `docs/PROJECT_CONTEXT.md`, and `docs/HANDOFF.md` before modifying the project.
- Keep the app vanilla HTML/CSS/JavaScript with no required build step. V2.1 AI chat must go through `src/ai/service.js`; absent a safe runtime server config it must remain local Mock, with no API call. Do not add real API, auth, RAG, or scans outside the fixed `D:\_Codex project` root unless explicitly requested.
- `local_companion.py` is loopback-only and read-only. Keep the single `GET /api/local-projects` endpoint; do not add filesystem writes, network Git commands, or Git mutation actions without an explicit request.
- Keep the `/api/chat` request/response contract and environment-key boundary documented; never put API keys in browser code.
- Keep all user data in the `daniel-workspace-v1` localStorage key. Future persistence belongs behind `src/store.js`; all Assistant calls belong behind `src/ai/service.js`.

## Efficient execution

- Make focused changes and verify the affected interaction in a browser when it materially changes behavior.
- Escape user-provided strings before rendering HTML. Validate external links to HTTP or HTTPS.
- Update README when V1 user-facing behavior changes and HANDOFF when work remains. Record user-visible milestones in CHANGELOG.

## Git and delivery

- This repository is the source of truth across computers. Inspect Git status first; when clean, synchronize safely before editing.
- Review `.gitignore` and staged content before commit. Never commit secrets, browser state, local data, caches, or machine-specific configuration.
- Use a descriptive commit and push to the configured private GitHub remote for handoff.

## Project commands

- Start local preview and read-only companion: `python local_companion.py`
- Open: `http://localhost:4174`
- Local scanning requires Git in `PATH`; `origin/main` comparison uses the cached local ref and does not fetch.
- No package install or build step is required.
