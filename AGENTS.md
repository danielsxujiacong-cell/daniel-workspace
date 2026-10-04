# Project instructions

## Orientation

- Read `README.md`, `docs/PROJECT_CONTEXT.md`, and `docs/HANDOFF.md` before modifying the project.
- Keep the app vanilla HTML/CSS/JavaScript with no required build step. Load only `src/auth/gate.js` from the public entry page; do not import `src/app.js`, read Workspace localStorage, query workspace tables, or contact Local Companion until Supabase has validated the session with `getUser()`. Pass the same authenticated Supabase client and user ID to the app. Keep sign-up out of the UI and use only a public anon/publishable key in `src/auth/config.js`; never include a service role key or password.
- AI chat and structured Dashboard suggestions must go through `src/ai/service.js` and the dedicated Cloudflare Worker in `cloudflare/`; only the Worker may call BigModel. Keep `AI_API_KEY` in a Wrangler Worker Secret, never in browser code, localStorage, or logs. Keep the local Mock only when no safe Worker endpoint is configured; a failed real request must show an error and retain a retry path. Model output may provide text only; the app derives action permissions from its own fixed allowlist.
- `local_companion.py` is loopback-only and read-only. Keep the single `GET /api/local-projects` endpoint; do not add filesystem writes, network Git commands, or Git mutation actions without an explicit request.
- Keep the `/api/chat` request/response contract and Worker environment-key boundary documented; never put API keys in browser code. Send only bounded Workspace summaries; exclude paths, credentials, session data, Git hashes, and repository URLs.
- V2.6 Tasks, Knowledge, Decisions, and Project base fields sync through `src/cloud/sync.js` to the existing Supabase project. Every row must use the validated user's ID and rely on RLS. Explicitly serialize only approved fields; never upload project paths, GitHub snapshots, Companion scans, Git status/HEADs, or local caches.
- V2.8 Task descriptions and AI suggestion source keys use `src/cloud/sync.js` and `supabase/v2.8-task-suggestions.sql`; preserve the existing per-user RLS boundary. Apply that additive SQL migration before relying on cross-device AI-task details or deduplication.
- Keep `action_runner.py` separate from the read-only Companion. It binds only to `127.0.0.1:4175`, accepts exact Daniel Workspace origins and fixed structured document actions for scanned projects under `D:\_Codex project`, and never accepts a command or free-form prompt. Codex runs in a read-only sandbox to return a draft; show the exact single-file diff and require a second user confirmation before creating the missing README, HANDOFF, TODO, or PROJECT_STATUS file. Never overwrite, delete, commit, or push.
- Keep `daniel-workspace-v1` as the untouched legacy source until the user confirms a one-time migration. Skip unchanged demo records, insert migration rows with conflict-ignore semantics, preserve the old localStorage data, and never auto-migrate when cloud records already exist.
- Persist an authenticated cloud cache and sync baseline in browser localStorage for offline fallback. Keep local-only theme, activity, GitHub snapshots, project paths, and Companion caches device-local; all Assistant calls remain behind `src/ai/service.js`.
- V2.4 stores only a compact scan-comparison baseline through `src/store.js`. V2.4.1 additionally stores the last successful inventory in a separate browser-local cache so Dashboard can retain it while Companion is offline; show that it may be stale. Do not write any scan data into scanned projects or add scanning fields beyond the existing read-only inventory.
- On logout, remove the private DOM immediately, cancel any Companion scan, clear private application memory, then clear the local Supabase session. Preserve the existing Workspace localStorage for the next successful login on this device.

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
- Start local AI Worker: `npm run ai:worker:dev` (`http://127.0.0.1:8787`)
- Deploy the Worker: `npm run ai:worker:deploy`; set its key with `node .\node_modules\wrangler\bin\wrangler.js secret put AI_API_KEY --config .\cloudflare\wrangler.jsonc`
- Local scanning requires Git in `PATH`; `origin/main` comparison uses the cached local ref and does not fetch.
- The static app has no build step; install Wrangler with `npm install --cache .\cache\npm` when needed.
