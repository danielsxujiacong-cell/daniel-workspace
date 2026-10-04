# Changelog

## 2026-10-03 · V2.6 (等待数据库初始化)

- 增加 Tasks、Knowledge、Decisions 和 Projects 基础资料的 Supabase 云同步客户端，继续复用现有 Auth 客户端，并对每张表按当前用户查询。
- 新增 `supabase/v2.6-cloud-sync.sql`：四张表、`auth.uid() = user_id` RLS、仅 authenticated CRUD 权限和更新时间触发器。当前数据库尚无这些表，真实 RLS 和线上 CRUD 验收待 SQL 执行后完成。
- 首次迁移必须由用户确认；跳过未修改的演示记录，迁移使用冲突忽略、不覆盖云端，并保留原有 `daniel-workspace-v1` 数据。离线编辑写入独立云端缓存，联网后可手动或自动重试。
- Projects 增加云端手工备注，并在界面分开展示云端基础资料与当前设备 Companion 状态。项目绝对路径、Git 状态、HEAD、远端比较、commit 和扫描缓存未加入云端字段。
- 验证：ESM 语法检查、`git diff --check`，以及 stubbed Supabase CRUD/隔离/迁移字段模拟通过；真实账号登录、RLS、设备间同步和 GitHub Pages 发布仍待完成。

## 2026-10-04 · V2.6 线上验收

- 用户确认已执行 Supabase SQL 并完成线上迁移。登录后的 GitHub Pages 会话在主动重试和刷新后显示“已同步”；Task 与 Project 云端资料刷新后仍可读取。
- Knowledge 与 Decisions 当前显示空状态；Projects 分开展示云端基础资料和本机 Companion 状态，Companion 在线发现 16 个本地项目。
- SQL 中的四张表均使用 `auth.uid() = user_id` RLS，匿名/公开角色无表权限；另一台设备和第二个 Auth 用户的隔离测试仍待人工验证。

## 2026-09-30 · V2.5 (user accepted 2026-10-03)

- Fixed delegated login submission to use the submitted form instead of the `#app` event listener target; added visible in-progress and actionable error states so handler failures cannot leave the button inert.
- Added an authentication-first public entry: the private app module, Workspace localStorage, scan caches, and Local Companion are not loaded before Supabase validates an existing email/password session.
- Added a minimal responsive login page, persistent Supabase client session, logout that clears the private page and app memory, and no public registration UI.
- Replaced personal repository/path values in fresh-install demo data with empty generic fields; existing browser Workspace data remains local and compatible.
- Configured the project URL and public publishable key from the local Lanlan Cloud Pet project; no service-role key or password was used.
- Added the sole allowed user's UUID to the Auth allowlist; blank configuration still fails closed.
- Verified via the public Auth settings endpoint that new-user signup is disabled. On 2026-10-03 the user confirmed V2.5 acceptance; the current Local Companion endpoint also returned 16 projects.
- Published commit `81939d7` to GitHub Pages; the configured index, auth gate, and auth config return HTTP 200.

## 2026-09-30 · V2.4.1

- Added a Windows logon scheduled task that runs the Companion with `pythonw.exe` in the background without opening a console window.
- Dashboard now auto-detects the Companion on local and GitHub Pages origins, shows scan success/offline status and timestamps, and retains the last successful browser-local inventory with a stale-data label.
- Fixed manual re-scan to call the live read-only endpoint and immediately refresh the Dashboard; added allow-listed GitHub Pages CORS and Private Network Access preflight support.
- Versioned the changed browser assets so Pages does not keep loading the earlier V2.4 modules from cache.
- Documented how to stop the running task and remove logon auto-start.

## 2026-09-30 · V2.4

- Reworked Dashboard around today's recommended project, real scan health counts, actionable reminders, changes since the previous scan, and recency-ranked local projects.
- Expanded Dashboard Mock AI context to use local Git state, ahead/behind, modifications, GitHub snapshots, Tasks, and document presence.
- Added a compact browser-local comparison baseline without storing local project names or paths; scanning remains read-only and all full scan results stay in page memory.
- Updated the sidebar version label to Daniel Workspace · V2.4.

## 2026-09-29 · V2.3

- Added a loopback-only read-only companion that lists projects under `D:\_Codex project` and returns Git branch/status, HEAD, cached `origin/main` ahead/behind, last local commit, common document presence, and last filesystem modification time.
- Added the real local project list, safe GitHub identity matching, local status/document details, Dashboard reminders, and local/GitHub/TODO-aware project Mock AI answers.
- Kept scan snapshots in page memory; document checks do not read contents, and the companion does not write to projects, fetch Git refs, or run Git mutation commands.

## 2026-09-29 · V2.2

- Added an explicit refresh flow for public GitHub repositories using unauthenticated GitHub Public API reads. Repository metadata, latest commit, Pages URL, visibility, and refresh time are stored with local workspace data; failed requests preserve the previous snapshot.
- Added GitHub connection states to Projects, recent GitHub update timestamps to Dashboard, and GitHub snapshot context to Project-page Mock AI replies.
- Replaced placeholder demo GitHub home-page links with the known Daniel Workspace repository; other sample projects remain local-only.

## 2026-09-28 · V2.1

- Moved Assistant replies into one AI service with separate local Mock and same-origin `/api/chat` providers; absent safe server config, chat stays offline and automatically uses Mock.
- Added page-specific context for Dashboard, Projects, Project detail, Knowledge, Decisions, and Tasks, plus a visible Mock AI / Real AI state hint.
- Documented the future request/response contract and server-only `OPENAI_API_KEY` requirement; no real API, backend, database, or key was added.

## 2026-09-28 · V1.0.0

- 完成 V1 全量交互验收，补上项目删除；删除项目会保留并解除关联的任务、资料和决策。
- 新增跟随系统的 Light/Dark 主题切换，用户选择保存在当前浏览器的 localStorage。
- 删除和重置操作改用适配两套主题的站内确认弹窗；重置演示数据会保留主题偏好。
- 验证刷新和重新打开后的本地数据、四类全局搜索、跨页面 Mock AI 与 390px 手机布局。

## 2026-09-27

- Delivered the Daniel Workspace V1 MVP with Dashboard, project details, Knowledge inbox, decision history, tasks, global search, contextual Mock AI, activity timeline, and local demo-data reset.
- Added localStorage persistence and responsive dark UI; no external AI/API or backend is required.
