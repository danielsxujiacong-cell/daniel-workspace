# Project context

## Goal

Build a usable, local-first personal workspace that brings projects, notes, decisions, and tasks into one place. V1 is for one person using one browser profile.

## Scope

- In scope: Dashboard, project list/detail and CRUD, Knowledge inbox, decision history, tasks and status filters, global search, contextual Mock AI, activity timeline, demo-data reset, system-aware Light/Dark theme.
- Out of scope: OpenAI API, database, login, RAG, PDF or live-web parsing, computer-wide scanning, GitHub automation, agents, and permission management.

## Constraints

- Vanilla HTML, CSS, and JavaScript with no build step or required third-party dependency.
- Persist user content in browser `localStorage`; data does not synchronize between browsers or devices in V1.
- Store the theme preference in the same versioned workspace object under `settings.theme`; use `system` by default and preserve the selected theme during demo reset.
- Deleting a project keeps its tasks, knowledge, decisions, and activity, while clearing their project association.
- Treat local path and URLs as user-entered project metadata; never scan or operate those destinations.
- Escape rendered user strings and allow only HTTP(S) project links.

## Key decisions

| Date | Decision | Reason |
| --- | --- | --- |
| 2026-09-27 | Use a static vanilla front end and localStorage | Keep the first version easy to run and focused on the product loop |
| 2026-09-27 | Keep Mock AI contextual and deterministic | Demonstrate the interaction without sending data to an API |
| 2026-09-27 | Use one small storage module as the future persistence seam | Leave room for later sync without adding a backend now |
| 2026-09-28 | Keep appearance in local workspace settings and follow the OS until a manual choice | Persist theme without a second storage system |
| 2026-09-28 | Preserve related records when deleting a project | Avoid cascading user data loss |

## Verification

- PowerShell ESM syntax checks for `src/app.js`, `src/store.js`, and `src/mock-data.js`; `git diff --check`.
- Browser acceptance across project/knowledge/decision/task CRUD, search, contextual AI, confirmation/reset flows, reload/reopen persistence, both themes, and 390 px layout with no horizontal overflow.
