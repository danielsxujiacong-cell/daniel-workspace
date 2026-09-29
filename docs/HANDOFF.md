# Handoff

## Current state

- **Updated:** 2026-09-29
- **Status:** V2.2 implementation and browser regression complete
- **Last completed:** Added unauthenticated read-only GitHub Public API snapshots for public repositories, local caching with failure preservation, Projects refresh/status UI, Dashboard update-time ordering, and GitHub-aware Project Mock AI context. Regressed V1/V2.1 CRUD, search, page-context Mock AI, persistence/reset, themes, mobile layout, and V2.2 refresh/failure behavior.

## Next action

No V2.2 work remains. Do not start V2.3 until explicitly requested. Future candidates (not implemented) include private-repository authorization or GitHub write/automation workflows; keep public reads tokenless and read-only. Real AI remains separately disabled: to enable it later, deploy a same-origin/serverless `POST /api/chat`, store `OPENAI_API_KEY` only in the server environment, and provide the frontend-safe `DANIEL_AI_CONFIG` with `provider: "real"` and `chatEndpoint: "/api/chat"`. No database, login, RAG, local scanning, or GitHub automation is part of this release.

## How to resume

1. Inspect Git status and safely pull if clean.
2. Start `python -m http.server 4174 --bind 127.0.0.1` from this folder.
3. Open `http://localhost:4174`; review `README.md` and `docs/PROJECT_CONTEXT.md`.

## Open questions or risks

- `localStorage` is browser-specific and does not sync across devices. Reset Demo Data replaces this browser's custom workspace with the built-in sample data.
