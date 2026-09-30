# Project context

## Goal

Build a usable, local-first personal workspace that brings projects, notes, decisions, and tasks into one place. V1 is for one person using one browser profile.

## Scope

- In scope: A daily-action Dashboard for project continuation, scan-based health/reminders/change comparison/recent activity, project list/detail and CRUD, public GitHub repository read-only snapshots, a local read-only companion for `D:\_Codex project`, Knowledge inbox, decision history, tasks and status filters, global search, contextual Mock AI, activity timeline, demo-data reset, system-aware Light/Dark theme, and the V2.1 AI provider/API contract seam.
- Out of scope: Calling a real AI API, deploying a serverless route, database, login, RAG, private GitHub access, GitHub write operations/automation, scanning outside the fixed project root, reading scanned document bodies, PDF or live-web parsing, agents, and permission management.

## Constraints

- Vanilla HTML, CSS, and JavaScript with no build step or required third-party dependency.
- Persist user content in browser `localStorage`; data does not synchronize between browsers or devices in V1.
- Store the theme preference in the same versioned workspace object under `settings.theme`; use `system` by default and preserve the selected theme during demo reset.
- Deleting a project keeps its tasks, knowledge, decisions, and activity, while clearing their project association.
- The companion binds only to `127.0.0.1`, serves allow-listed app files and a read-only `GET /api/local-projects`, and scans only `D:\_Codex project`. Skip hidden folders and common dependency/build/cache directories. Never write into scanned projects or issue network Git commands.
- Project discovery uses Git roots and non-Git folders with common project documents/markers. Read Git branch, porcelain status, HEAD, local `origin/main`, ahead/behind, latest local commit and filesystem modification time. Set `GIT_OPTIONAL_LOCKS=0`; do not fetch, pull, commit, push, checkout, or mutate repositories from the scanner.
- Document discovery checks root and `docs/` filenames for README, HANDOFF, PROJECT_STATUS, TODO, PROJECT_CONTEXT, and CHANGELOG; do not read their contents. Keep the full scan in memory and never persist local paths or names. V2.4 stores a compact comparison baseline through `src/store.js` with hashed identity, HEAD, branch, clean/ahead/behind, README/HANDOFF/TODO presence, and modification time so the next scan can identify changes; this browser-local baseline is separate from user workspace data.
- Match scanner records to workspace projects by sanitized GitHub owner/repository identity first, then exact local path/name. Only use valid HTTP(S) links in the UI.
- Treat local path and URLs as user-entered project metadata outside the fixed scanner root; never scan or operate those destinations.
- Read GitHub metadata only for valid public `https://github.com/{owner}/{repo}` URLs through unauthenticated public REST GET requests. Persist successful normalized snapshots inside the existing workspace object; on failure, retain the previous snapshot.
- If the anonymous Pages endpoint does not disclose its URL while the public repo reports Pages enabled, derive the conventional default GitHub Pages URL and mark it as estimated in the UI.
- Escape rendered user strings and allow only HTTP(S) project links.
- All Assistant chat requests go through `src/ai/service.js`; absent an explicit server-injected `DANIEL_AI_CONFIG`, use the local Mock Provider and make no network request.
- The reserved `POST /api/chat` contract uses `{ message, currentPage, currentProject, relevantContext, history }` and responds with `{ message: { role: "assistant", content }, provider: "real" | "mock" }`.
- Any future API key belongs only in a serverless environment variable such as `OPENAI_API_KEY`; never expose it to browser code.

## Key decisions

| Date | Decision | Reason |
| --- | --- | --- |
| 2026-09-27 | Use a static vanilla front end and localStorage | Keep the first version easy to run and focused on the product loop |
| 2026-09-27 | Keep Mock AI contextual and deterministic | Demonstrate the interaction without sending data to an API |
| 2026-09-27 | Use one small storage module as the future persistence seam | Leave room for later sync without adding a backend now |
| 2026-09-28 | Keep appearance in local workspace settings and follow the OS until a manual choice | Persist theme without a second storage system |
| 2026-09-28 | Preserve related records when deleting a project | Avoid cascading user data loss |
| 2026-09-28 | Put Assistant requests behind a small service and provider seam; default to local Mock | Keep current behavior safe without a key and make a future server endpoint swappable |
| 2026-09-29 | Read public GitHub metadata only on explicit refresh and cache it locally | Keep the V1 local-first model and avoid background requests, credentials, or repository writes |
| 2026-09-29 | Read local project metadata through a loopback-only companion, without scanning document bodies or refreshing Git refs | Give the workspace useful local status while preserving the read-only boundary |
| 2026-09-30 | Make Dashboard a daily action surface and compare scans with a compact browser-local baseline | Put current priorities, health issues, and recent changes ahead of demo counts while retaining read-only scanning |

## Verification

- ESM syntax checks for app and AI modules; local Mock context verified through the UI; `git diff --check`.
- Browser regression across project/knowledge/decision/task CRUD, search, page-context Mock AI, confirmation/reset flows, reload/reopen persistence, both themes, and mobile layout.
- V2.2 browser regression: public GitHub refresh, cached snapshot display, failure fallback, dashboard recency, and GitHub-aware project Mock AI response.
- V2.3 browser regression: local scan results and project/GitHub matching, details and document presence, Dashboard reminders, project issue Mock AI; V1 task create/complete/filter, Knowledge create/search, V2.2 public refresh and persisted snapshot. Companion API and static-file deny rules checked locally.
- V2.4 browser regression: real scan-driven continuation, metrics, actionable reminders, baseline comparisons, recent activity ordering, contextual Mock AI, both themes, mobile layout, and V1–V2.3 flows. Verify the compact baseline excludes project names and paths.
