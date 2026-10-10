# Changelog

## 2026-10-10 · V3.1-B 修复登录后的云端读取状态卡死

- 根据线上运行时错误堆栈定位根因：云端 Dashboard 返回项目对象数组，首页 Assistant 上下文却按本机扫描的 `{ item, project }` 结构解构，`item.name` 抛错并中断同步后的最终渲染。
- 按 Dashboard 来源分别序列化云端项目对象与本机扫描记录，避免渲染异常遮住真实的同步成功/失败状态。
- 新增两种数据形状的回归测试；未改 Supabase 数据或读写策略。

## 2026-10-10 · V3.1-B 云端读取超时保护

- Supabase 五个只读读取请求（四张 Workspace 表和置顶字段探测）增加 15 秒 AbortSignal 截止时间，避免网络请求一直 pending 时同步状态永久停在“正在读取”。
- 超时显示明确的失败状态和对应表名；读取失败不会启用缓存回写或触发任何云端写入/删除。
- 增加 stalled-read 超时回归测试，并覆盖已有 29 项恢复防护测试。

## 2026-10-10 · V3.1-B 云同步恢复只认 Supabase

- 修复登录、重试和联网恢复时将旧云缓存与 Supabase 记录合并并立即回传的问题；成功读取后以远端 Projects、Tasks、Knowledge、Decisions 重建云缓存。
- 恢复流程不再自动 upsert 或 delete。旧缓存里的 Mock 和过期记录不会写回、覆盖或删除云端记录；未来用户编辑仍按新远端基线提交差异。
- 保留设备本地设置、活动、项目路径/GitHub 快照和云端 `is_pinned`；增加模拟 29 项远端快照加 Mock 缓存的零写入/零删除回归测试。

## 2026-10-10 · V3.1-B 首页手动置顶项目

- Home 仅在至少置顶 3 个项目后展示项目卡片，最多显示 5 个；Projects 保留完整项目列表并提供置顶/取消置顶操作。
- 卡片显示实际阶段、下一步与关联任务完成数；没有已保存的信息时显示“未填写”。GitHub 和线上网站仅在地址通过 HTTP/HTTPS 校验后提供快捷入口。
- 置顶只更新当前用户指定项目的 `is_pinned` 字段；缺少数据库字段时自动禁用控件。跨设备启用前需手动执行 `supabase/v3.1-b-project-pinning.sql`。
- 用户确认 Step 2-A 已导入 26 个真实项目，另有 3 个 Mock 项目；本次未访问 Supabase MCP。

## 2026-10-10 · 私人工作区演示重置保护修复

- 移除私人模式侧栏的「重置演示数据」入口和事件处理；共享 `resetData()` 变为拒绝操作。
- Supabase 全量同步和项目插入拒绝内置 Mock ID，迁移候选也会排除被改写过的 Mock 项目 ID；访客仍使用独立的内存重置。
- 新增定向回归测试；`npm test` 通过 11/11，`git diff --check` 通过。数据库检查、备份和线上部署状态随后记录在 HANDOFF。

## 2026-10-10 · V3.1-A 私人 Home 项目与任务看板

- Home 改为当前账号的 Supabase 项目与任务看板，按「今天继续什么、重点项目、优先待办/最近项目」组织真实记录。
- 四张统计卡片可打开全部/进行中项目及未完成/已完成任务的对应筛选结果；项目进度、下一步和更新时间仅按已有记录展示。
- Companion 状态移到次要位置；同步失败显示错误、缓存时间/缺失状态和重试入口，不把设备草稿显示成云端资料。访客演示与登录门保持独立。

## 2026-10-10 · V3.0-C 访客首页求职展示优化

- 首页突出「企业 AI 自动化工作台」定位，以业务问题、价值要点和 TK-1001 演示卡让访客快速理解产品。
- 增加「异常发现 → 规则判断 → SOP → 决策 → 完成」流程可视化和「立即体验 TK-1001」入口；首次进入直接展示首页，导航改为手动开启。
- 明确标注模拟数据、固定规则驱动、不调用真实 AI、非真实企业案例；不改私人模式、登录、数据库或 API。
- 访客首页回归、TK-1001 闭环与隔离检查通过后推送 `main`；EdgeOne 按既有配置自动部署。

## 2026-10-09 · V3.0-B TK-1001 访客工单闭环

- 在访客 Tasks 中新增 TK-1001 详情，按延误天数、关键物料和项目影响计算确定性 P1 规则建议，并关联供应商异常处置 SOP。
- 允许选择模拟处置方案并生成仅访客会话可见的 Decision；完成工单后即时更新 Home 待完成/本周完成统计和 Tasks 状态。
- 操作状态限于当前页面内存，重置可还原；不接入真实 AI、Supabase、Companion 或 Codex，不改私人模式。
- 浏览器核对 TK-1001 全流程、统计联动、重置和访客/登录门隔离；回归测试 7/7 通过。推送 `main` 后由既有 EdgeOne 集成自动部署。

## 2026-10-09 · V3.0-A 访客企业运营演示

- 登录页新增访客演示入口，使用独立的模拟企业数据浏览 Home、Projects、Tasks、Knowledge 和 Decisions。
- 增加可跳过的两分钟导航、任务状态筛选、重置和退出；演示数据仅存在当前页面内存。
- 访客路由跳过 Supabase 配置和会话恢复，不加载私人 Workspace、Companion、Codex Runner 或 AI 模块；私人登录与云同步流程保留。
- EdgeOne 从 GitHub `main` 自动部署；隔离与登录回归测试通过后推送。
- 修复首页「优先待办」行的浏览器默认边框与底色，恢复原列表间距和主题 hover；AI 助手先显示发送状态，并将上下文构造错误纳入重试反馈。

## 2026-10-09 · V2.9 云端优先首页

- Companion 不可用时首页以 Supabase 当前账号资料展示真实项目数、任务统计、最近项目、优先待办和现有 AI 建议；本机专属健康/扫描模块收起，Companion 状态移到次要位置。
- 云端同步失败或断线时保留缓存资料，显示明确状态和首页重试入口。
- 不改登录验证、数据权限、数据库、其他页面或 Companion 服务。

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
