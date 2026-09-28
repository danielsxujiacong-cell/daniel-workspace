# Handoff

## Current state

- **Updated:** 2026-09-28
- **Status:** V2.1 complete
- **Last completed:** Routed Assistant chat through `src/ai/service.js`, separated Mock and HTTP providers, and built page-specific local context for Dashboard, Projects, Project detail, Knowledge, Decisions, and Tasks. No API Key or server endpoint is configured, so the app stays local Mock AI.

## Next action

Do not start V2.2. To enable Real AI later, deploy a same-origin/serverless `POST /api/chat`, store `OPENAI_API_KEY` only in the server environment, and provide the frontend-safe `DANIEL_AI_CONFIG` with `provider: "real"` and `chatEndpoint: "/api/chat"`. The route must follow the JSON contract in `README.md` and return `provider: "mock"` or `"real"`; the browser service falls back to local Mock on an unavailable or invalid response. No database, login, RAG, GitHub scan, or local file scan is part of this step.

## How to resume

1. Inspect Git status and safely pull if clean.
2. Start `python -m http.server 4174 --bind 127.0.0.1` from this folder.
3. Open `http://localhost:4174`; review `README.md` and `docs/PROJECT_CONTEXT.md`.

## Open questions or risks

- `localStorage` is browser-specific and does not sync across devices. Reset Demo Data replaces this browser's custom workspace with the built-in sample data.
