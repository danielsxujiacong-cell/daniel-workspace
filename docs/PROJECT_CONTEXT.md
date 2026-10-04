# Project context

## Goal

Build a usable personal workspace that brings projects, notes, decisions, and tasks into one place. After Supabase authenticates the allowlisted account, durable workspace records sync through Supabase; local Git and filesystem state stays on each device.

## Scope

- In scope: Email/password login for an existing Supabase Auth user, a login-only public page, local session persistence and logout, plus a daily-action Dashboard for project continuation, scan-based health/reminders/change comparison/recent activity, cloud-backed project list/detail and CRUD, RLS-protected Supabase sync for Tasks/Knowledge/Decisions/Project base fields, a user-approved one-time local migration, public GitHub repository read-only snapshots, a local read-only companion for `D:\_Codex project`, global search, contextual Mock AI, device-local activity timeline, system-aware Light/Dark theme, and the V2.1 AI provider/API contract seam.
- Out of scope: Public registration, Google login, password recovery flow, calling a real AI API, deploying a serverless route, RAG, private GitHub access, GitHub write operations/automation, scanning outside the fixed project root, reading scanned document bodies, PDF or live-web parsing, real-time collaboration, agents, and permission management.

## Constraints

- Vanilla HTML, CSS, and JavaScript with no build step; `supabase-js` is loaded from a pinned-major CDN import for Auth only.
- The public `index.html` entry loads only `src/auth/gate.js`. The gate validates any persisted session with Supabase Auth before dynamically importing `src/app.js`; the unauthenticated branch must not load `src/store.js`, read workspace or scan-cache localStorage, query workspace tables, or request Local Companion.
- `src/auth/config.js` may contain the Supabase project URL, public anon/publishable key, and one allowed user UUID or email. A blank allowed-user value denies everyone. Disable new-user signups in the Supabase project settings; never include a service role key, database/user password, or private token in browser code or GitHub.
- The existing `daniel-workspace-v1` key is a legacy local source. On login, offer a one-time migration only when real local records exist and the corresponding cloud tables are empty. Skip unchanged demo records, use insert-only conflict-ignore migration, and preserve the old key. If cloud data already exists, load it without overwriting it.
- V2.6 syncs only explicit Task, Knowledge, Decision, and Project base fields through the authenticated Supabase client. Each query is scoped to the validated `user.id`; RLS enforces `auth.uid() = user_id`. Project local paths and GitHub snapshots, Companion scan inventory/cache, filesystem metadata, Git clean/dirty, ahead/behind, branches, HEADs, commits, and local changes must never enter cloud row serializers.
- Keep a separate authenticated cloud cache and sync baseline in browser localStorage for offline fallback. Theme, activity timeline, Local Companion inventory, scan baselines, project paths, and GitHub read-only snapshots remain device-local. The Supabase session is stored separately by the Supabase client. On logout, clear the private DOM and in-memory app/scan/cloud data and abort any active Companion request, while preserving localStorage for the next login on this browser.
- Fresh-install demo records must contain generic sample content only: no real project names, private paths, or personal repository links.
- Persist user content in browser `localStorage`; data does not synchronize between browsers or devices in V1.
- Store the theme preference in the same versioned workspace object under `settings.theme`; use `system` by default and preserve the selected theme during demo reset.
- Deleting a project keeps its tasks, knowledge, decisions, and activity, while clearing their project association.
- The companion binds only to `127.0.0.1`, serves allow-listed app files and a read-only `GET /api/local-projects`, and scans only `D:\_Codex project`. Skip hidden folders and common dependency/build/cache directories. Never write into scanned projects or issue network Git commands.
- Project discovery uses Git roots and non-Git folders with common project documents/markers. Read Git branch, porcelain status, HEAD, local `origin/main`, ahead/behind, latest local commit and filesystem modification time. Set `GIT_OPTIONAL_LOCKS=0`; do not fetch, pull, commit, push, checkout, or mutate repositories from the scanner.
- Document discovery checks root and `docs/` filenames for README, HANDOFF, PROJECT_STATUS, TODO, PROJECT_CONTEXT, and CHANGELOG; do not read their contents. V2.4 stores a compact comparison baseline through `src/store.js`. Per the V2.4.1 offline-retention requirement, the last successful inventory is also stored in a separate browser-local cache (including its existing project names and paths) so the Dashboard can remain useful offline; label cached data as possibly stale. Neither cache is written into scanned projects or synchronized across devices.
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
| 2026-09-30 | Place a Supabase email/password gate before the app module | Keep public Pages limited to a login screen and avoid reading local Workspace/Companion data before a verified session |
| 2026-09-30 | Reuse the existing public Supabase client config and require one allowlisted Auth user | Keep the account gate fail-closed while reusing the same Supabase project |
| 2026-10-03 | Sync only durable workspace records in four RLS-protected tables | Share personal Tasks, Knowledge, Decisions, and Project basics while keeping Companion Git/filesystem state device-local |
| 2026-10-03 | Keep legacy browser data and require a one-time explicit migration | Avoid uploading demo data, overwriting cloud records, or deleting old local content |

## Verification

- ESM syntax checks for app and AI modules; local Mock context verified through the UI; `git diff --check`.
- Browser regression across project/knowledge/decision/task CRUD, search, page-context Mock AI, confirmation/reset flows, reload/reopen persistence, both themes, and mobile layout.
- V2.2 browser regression: public GitHub refresh, cached snapshot display, failure fallback, dashboard recency, and GitHub-aware project Mock AI response.
- V2.3 browser regression: local scan results and project/GitHub matching, details and document presence, Dashboard reminders, project issue Mock AI; V1 task create/complete/filter, Knowledge create/search, V2.2 public refresh and persisted snapshot. Companion API and static-file deny rules checked locally.
- V2.4.1 verification: logon scheduled task uses `pythonw.exe` with a limited interactive token; API remains loopback-only and read-only; GitHub Pages CORS is restricted to the app origin; Dashboard loads, retains, and labels the last successful scan on failure; manual refresh updates the scan time and result.
- V2.4 browser regression: real scan-driven continuation, metrics, actionable reminders, baseline comparisons, recent activity ordering, contextual Mock AI, both themes, mobile layout, and V1–V2.3 flows. Verify the compact baseline excludes project names and paths.
- The user confirmed V2.5 acceptance on 2026-10-03. This turn independently confirmed the current Companion API returns 16 projects and the local public entry shows the login-only page before authentication.
- V2.6 client verification covers syntax, `git diff --check`, and a stubbed Supabase flow for demo filtering, user-scoped reads, conflict-ignoring migration, field allowlisting, upsert, and delete. On 2026-10-04 the user confirmed the SQL was run and online migration completed. In the authenticated Pages session, sync status succeeded after an explicit retry and page refresh; one Task and one cloud Project remained visible, while Knowledge and Decisions were empty. Projects also showed the local Companion inventory separately (16 projects online). The checked-in SQL applies `auth.uid() = user_id` to all four tables and grants table access only to `authenticated`; the live account could read its own rows. Cross-user isolation and a second-device read remain unverified because no second Auth user/device was available. The current Codex browser still showed a legacy-local-data notice; its `daniel-workspace-v1` data was left untouched and was not merged again.
