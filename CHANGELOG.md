# Changelog

## 2026-10-08 · Dashboard 建议准确性修复

- Companion 在线时按本次文件扫描核对文档类待办；文件已存在时不再优先推荐，并提示用户到 Tasks 手动确认完成。
- Companion 离线时按云端任务优先级全局排序；首页采用应用计算的优先级、原因和下一步，避免 AI 文案猜测本机状态或夸大低优先级任务。

## 2026-10-08 · V2.9 手机端云端首页降级

- Companion 不可用时，首页按云端 Tasks 和 Projects 推荐下一步，并标注「基于云端资料」；不展示或推断本机 Git 状态。
- 工作区健康区明确提示本机扫描不可用；云端 AI 建议与 Assistant 继续使用当前账号的 Projects、Tasks、Knowledge、Decisions。

## 2026-10-04 · V2.8 AI 建议动作

- Dashboard 建议卡改为结构化的问题、原因、建议和受限操作；GLM 只能整理文本，动作权限由应用按扫描状态生成。
- 「查看项目」进入云端项目或本机详情；AI 建议可创建含说明与来源键的 Workspace Task，稳定 ID 和部分唯一索引防止重复。
- 新增独立 `action_runner.py`。只允许固定 D 盘项目根内、缺少 README/HANDOFF/TODO/PROJECT_STATUS 的单文件文档动作；Codex 只读沙箱生成草稿，检查 diff 后再次确认才创建文件。无 Runner/CLI 时提供完整复制 Task。
- 页面版本改由 `src/version.js` 的 `APP_VERSION` 单点提供。
- 增加 `supabase/v2.8-task-suggestions.sql`，为 Task 说明和幂等来源键新增兼容字段；执行后保留现有 RLS。线上需用户在 Supabase SQL Editor 运行此迁移后，才能验收任务详情的跨设备同步。
- 2026-10-04 用户确认 Supabase 迁移已成功执行，并完成人工验收：任务创建、防重复、打开项目、Codex 确认、Action Runner 执行及重新扫描均通过；V2.8 验收完成。

## 2026-10-04 · V2.7 GLM AI 真实 API 验收

- 新增独立 Cloudflare Worker `daniel-workspace-api`，通过 BigModel Chat Completions 调用 `glm-4-flash-250414`；API Key 只从 Wrangler Secret 读取。
- Assistant 改为请求 GLM，显示 Provider 与模型；保留最近 20 条有效对话，支持 Enter 发送、思考状态、一次失败重试和明确错误，不会在真实服务失败时回退到 Mock。
- 只发送精简页面上下文、Tasks、Projects、Knowledge、Decisions、选中内容及 Companion 健康摘要；过滤本机路径、链接、登录数据和 Git hash。
- 线上 `/health` 报告 `configured: true`，Wrangler Secret 列表确认 `AI_API_KEY` 存在。问候、今日任务建议和项目问题的真实对话成功；8 轮对话回忆了开场标记。无效请求返回 400，未授权来源返回 403。
- 此前的直接 Worker 探针使用合成上下文；用户随后于 2026-10-04 确认完成登录态线上验收，真实 GLM 对话、Workspace Context 和 Companion 上下文均正常，V2.7 验收完成。此前本地与线上健康检查、上下文过滤、429/Timeout 单次重试和 CORS 测试通过。
- Commit `3fde19d` 已推送到 `main`；GitHub Pages 的入口、Auth gate、应用、AI 模块和样式均返回 HTTP 200 并包含 V2.7 版本内容。

## 2026-10-04 · V2.6 最终验收

- Tasks 与 Knowledge 测试记录刷新后仍存在；按用户要求保留 Knowledge 测试记录。
- Decisions 测试记录刷新后仍存在；用户确认永久删除后，删除已同步并在再次刷新后保持不存在。
- 复核 Projects 云端基础资料与 Companion 本地状态分离；Companion 离线时仍可查看云端资料，本机扫描缓存保留并标为可能过期。
- 四张 workspace 表的匿名 PostgREST 请求均返回 HTTP 401；未再次执行 localStorage 迁移，也未删除旧 localStorage。
- Decisions 删除入口随 `402f44e` 发布，GitHub Pages workflow 成功。

## 2026-10-03 · V2.6 (等待数据库初始化)

- 增加 Tasks、Knowledge、Decisions 和 Projects 基础资料的 Supabase 云同步客户端，继续复用现有 Auth 客户端，并对每张表按当前用户查询。
- 新增 `supabase/v2.6-cloud-sync.sql`：四张表、`auth.uid() = user_id` RLS、仅 authenticated CRUD 权限和更新时间触发器。当前数据库尚无这些表，真实 RLS 和线上 CRUD 验收待 SQL 执行后完成。
- 首次迁移必须由用户确认；跳过未修改的演示记录，迁移使用冲突忽略、不覆盖云端，并保留原有 `daniel-workspace-v1` 数据。离线编辑写入独立云端缓存，联网后可手动或自动重试。
- Projects 增加云端手工备注，并在界面分开展示云端基础资料与当前设备 Companion 状态。项目绝对路径、Git 状态、HEAD、远端比较、commit 和扫描缓存未加入云端字段。
- 验证：ESM 语法检查、`git diff --check`，以及 stubbed Supabase CRUD/隔离/迁移字段模拟通过；真实账号登录、RLS、设备间同步和 GitHub Pages 发布仍待完成。

## 2026-10-04 · V2.6 线上验收

- 用户确认已执行 Supabase SQL 并完成线上迁移。Task 与新建的 Knowledge 验收记录刷新后仍可读取；用户要求保留 Knowledge 记录。Decisions 验收记录已保存，但刷新后遇到 Auth 初始化错误，持久性待复核。
- Projects 云端资料在 Companion 离线时仍可查看，本机 16 项缓存保留并标记为可能过期；重启 Companion 后只读 API 返回 16 项。
- 对四张表的匿名 PostgREST 请求均返回 HTTP 401。第二台设备与第二个 Auth 用户的验证仍待完成。

## 2026-10-04 · V2.6 登录重试修复

- 登录启动遇到会话检查错误后，登录按钮会按需重新初始化 Supabase Auth 客户端并重试；在 `getUser()` 验证成功前仍不加载私人 Workspace。
- commit `c87eea8` 的 GitHub Pages workflow 已成功；公开入口和版本化 Auth 脚本均返回 HTTP 200。
- Decisions 刷新后的持久性仍待在已登录 Chrome 中复核。

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
