# Project context

## Goal

Build a usable, local-first personal workspace that brings projects, notes, decisions, and tasks into one place. V1 is for one person using one browser profile.

## Scope

- In scope: Dashboard, project list/detail, Knowledge inbox, decision history, tasks and status filters, global search, contextual Mock AI, activity timeline, demo-data reset.
- Out of scope: OpenAI API, database, login, RAG, PDF or live-web parsing, computer-wide scanning, GitHub automation, agents, and permission management.

## Constraints

- Vanilla HTML, CSS, and JavaScript with no build step or required third-party dependency.
- Persist user content in browser `localStorage`; data does not synchronize between browsers or devices in V1.
- Treat local path and URLs as user-entered project metadata; never scan or operate those destinations.
- Escape rendered user strings and allow only HTTP(S) project links.

## Key decisions

| Date | Decision | Reason |
| --- | --- | --- |
| 2026-09-27 | Use a static vanilla front end and localStorage | Keep the first version easy to run and focused on the product loop |
| 2026-09-27 | Keep Mock AI contextual and deterministic | Demonstrate the interaction without sending data to an API |
| 2026-09-27 | Use one small storage module as the future persistence seam | Leave room for later sync without adding a backend now |

## Verification

- PowerShell ESM syntax checks: `Get-Content -Raw src/app.js | node --check --input-type=module` (repeat for `src/store.js` and `src/mock-data.js`).
- `python -m http.server 4174 --bind 127.0.0.1` then browser checks across the main pages and create/edit/search/task/chat flows; verify a 390 px viewport has no horizontal overflow.
