# Daniel Workspace

私人 AI 工作台 V3.4 Step 1。登录用户继续使用现有 Supabase 云同步、本机 Companion 和私人 AI；私人 Home 只展示 3–5 个手动置顶项目，其他项目保留在 Projects：首页新增按需生成的「AI 今日简报」，使用真实 GLM，依据置顶项目的已验证公开 GitHub 最近提交、状态和已确认下一步，输出最近完成、1–3 条今日建议和关注问题；每条须关联项目并说明依据，资料不足时说明，不修改项目或任务。项目详情新增「AI 建议下一步」，使用项目简介和可验证的公开 GitHub 最近提交作为生成依据，关联任务（如有）仅作补充，经现有 GLM Worker 生成具体建议与依据；生成和编辑仅保留在当前页面，只有点击「采纳为下一步」才通过既有项目同步写入 `project.next`。缺少资料会明确提示，不回退到本地 Mock，不声称未记录的进度；访客演示仍与私人模式隔离。项目卡只显示真实填写的阶段、下一步和关联任务完成数；没有数据时省略对应行。卡片突出公开 GitHub 最近提交的摘要、时间和 Commit 链接，并以最近 7 天提交数作为辅助信息；GitHub 和线上网站入口仅接受 HTTP/HTTPS。GitHub 快照保存在当前设备并缓存 1 小时；手动刷新可立即读取，私有或仅本地项目显示简短的暂不可读状态。访客首页仍以「企业 AI 自动化工作台」定位展示异常处理价值，并通过 TK-1001 说明异常发现、固定规则、SOP、决策与完成的闭环。私人模式不提供演示数据重置；共享数据层拒绝重置，云端写入路径拒绝内置 Mock 记录。访客内容明确标注为规则驱动的模拟数据，不调用真实 AI 或代表真实企业案例；访客重置仍只影响当前页面内存，不读取 Supabase 配置或会话，也不连接 Companion、Codex 或 AI。

## Status

- **Stage:** V3.4 Step 1 AI daily brief. After the V3.2 cleanup, private Workspace contains 26 real projects and 5 pinned projects; the feature uses the existing GLM Worker and existing `project.next` sync field, with no schema or sync changes.
- **Last updated:** 2026-10-11
- **Primary deliverable:** 本仓库中的本地 Web 应用

## Quick start

先完成 [Supabase 登录配置](#v25-登录配置)。本地预览需要 Python 3 和 Git。Windows 登录后，任务计划程序会静默启动 Companion（`pythonw.exe`，任务名 `DanielWorkspaceLocalCompanion`）；它会同时提供静态页面和只读扫描 API。也可以手动运行：

```powershell
python local_companion.py
```

在浏览器打开 [http://127.0.0.1:4174](http://127.0.0.1:4174)，可登录私人工作区，也可选「访客演示」浏览模拟企业运营数据。访客首页先展示产品定位与五步工单流程，可直接选择「立即体验 TK-1001」查看固定规则判定、关联 SOP、处置方案、模拟 Decision 和完成状态；Home 统计和 Tasks 状态会随之更新。访客演示含手动启动的两分钟导航、重置和退出；模拟状态仅保存在当前页面内存中。登录前页面不会读取 Workspace/扫描缓存或请求 Companion；访客模式也不会读取 Supabase 配置或会话。登录后按 `Ctrl+K` 或 `⌘K` 聚焦全局搜索；部署站点会在登录后尝试从本机 `127.0.0.1:4174` 读取扫描，浏览器可能要求允许页面访问本地网络。

手动控制 Companion：前台运行 `python local_companion.py` 时按 `Ctrl+C` 停止；开机任务启动的后台实例可在 PowerShell 执行 `Stop-ScheduledTask -TaskName "DanielWorkspaceLocalCompanion"` 停止。取消后续登录自动启动，执行 `Unregister-ScheduledTask -TaskName "DanielWorkspaceLocalCompanion" -Confirm:$false`。重新登录 Windows 会再次启动仍注册的任务。

主题、本机 Companion 扫描缓存、GitHub 只读快照和云端离线副本保存在当前浏览器的 `localStorage`。云端业务资料以 Supabase 为准，可在已登录设备间共享；首次遇到旧版本机内容时会先询问是否迁移。旧 `daniel-workspace-v1` 数据不会因迁移或云端读取而被删除。

## V2.5 登录配置

应用不提供注册入口。`src/auth/config.js` 使用本机“云养猫 / 蓝蓝”项目的 URL 和 **publishable key**，并只允许指定的 Supabase 用户 UUID。Supabase Dashboard 已关闭 **Allow new users to sign up**；**Site URL** 和 **Redirect URLs** 已按下方 Pages 地址配置。

`src/auth/config.js` 的 `SUPABASE_ALLOWED_USER` 设为唯一允许账号的 User UUID；留空时默认拒绝所有账号。只允许已存在的 Email + Password 账号登录，不能从应用注册。项目 URL 和 publishable key 属于公开前端配置；绝不填 `service_role` key、数据库密码、用户密码或私密 Token。

登录门在 `getUser()` 成功验证会话前不会导入 `src/app.js`，读取 Workspace localStorage 或扫描缓存，也不会请求 Local Companion。`?mode=guest` 路由只加载独立的 `src/guest-demo.js`；它不加载 `src/auth/config.js`、Supabase SDK 或任何私人服务模块。访客退出到 `?mode=login` 时停留在登录表单，不自动恢复会话；手动登录仍按原有 allowlist 验证。若启动时会话检查暂时失败，登录按钮会重新初始化 Auth 客户端并重试；成功验证前仍不会进入 Workspace。私人工作区退出会立即清空页面和应用内存并停止扫描请求；原有 `daniel-workspace-v1` 浏览器数据会保留，供此设备下一次成功登录继续使用。

访客隔离和登录门禁回归测试使用 Node 内置测试运行：

```powershell
npm test
```

## V2.6 云同步配置

`src/cloud/sync.js` 只上传 Task、Knowledge、Decision 和 Project 基础资料，并在每条记录上附加当前 `auth.uid()`。Project 的本机绝对路径、GitHub 只读快照、Companion 状态和扫描缓存不会发送到 Supabase。所有四张表启用 RLS，策略检查 `auth.uid() = user_id`；客户端继续使用现有 public publishable key，不含 service role key。

用户于 2026-10-04 确认已在 Supabase 执行 [v2.6-cloud-sync.sql](supabase/v2.6-cloud-sync.sql) 并完成线上迁移。V2.6 最终验收中，Tasks 与 Knowledge 测试记录刷新后仍存在；用户要求保留 Knowledge 测试记录。Decisions 测试记录刷新后仍存在，用户随后确认永久删除；删除状态同步后再次刷新仍为 0 条。Projects 云端基础资料在 Companion 离线时仍可查看，本机 16 项缓存会标记为可能过期；最终页面检查时 Companion 在线。四张表的匿名 PostgREST 请求均返回 HTTP 401，RLS 隔离生效。登录重试与 Decisions 删除入口已部署，Pages 入口及版本化脚本可读取。另一台设备读取及第二个 Auth 用户的隔离测试尚未进行。不要自动再次迁移，也不要删除旧 `localStorage` 数据。

## V2.7 智谱 GLM Assistant

已部署独立 Worker `daniel-workspace-api`：[`https://daniel-workspace-api.ai-investment-dashboard.workers.dev`](https://daniel-workspace-api.ai-investment-dashboard.workers.dev)。它把 `/api/chat` 转发到 BigModel Chat Completions，模型为 `glm-4-flash-250414`；`AI_BASE_URL` 和 `AI_MODEL` 是 Worker 配置，`AI_API_KEY` 必须用 Wrangler Secret 保存。设置 Secret 的命令为：

```powershell
node .\node_modules\wrangler\bin\wrangler.js secret put AI_API_KEY --config .\cloudflare\wrangler.jsonc
```

终端提示输入时直接粘贴智谱 Key；不要把 Key 发到聊天或写入项目文件。当前线上 Worker 已配置 `AI_API_KEY` Secret，健康检查报告 `configured: true`。真实提示“你好”、今日任务建议和项目问题均成功返回；8 轮连续对话正确回忆开场标记。用户随后确认已完成登录态线上验收：真实 GLM 对话、Workspace Context 和 Companion 上下文均正常，V2.7 已完成。Pages 已配置只访问该 Worker。登录后，前端最多发送最近 20 条对话消息和裁剪后的当前页面上下文；上下文包含 Tasks、Projects、Knowledge、Decisions、选中内容及 Companion 健康摘要，不包含本机路径、凭据、会话、仓库 URL 或 Git hash。Worker 对 429 和 Timeout 各最多重试一次；真实服务失败会显示可重试错误，不会改用 Mock。助手显示 `GLM-4-Flash` 和实际模型 ID。

本地运行 Companion 后，另开终端执行 `npm run ai:worker:dev` 可在 `127.0.0.1:8787` 验证 Worker；本地无 Secret 时 `/api/chat` 会返回 `ai_not_configured`。静态应用不需要构建。

## V2.8 AI 建议动作

- Dashboard 根据本机扫描构造结构化问题；GLM 只负责整理标题、原因和建议。`projectId` 与 `allowedActions` 由应用根据本地状态确定，模型输出不能授权写操作。
- 「查看项目」进入匹配的 Workspace Project 页面；没有云端匹配时进入本机项目详情。「创建任务」同步任务说明及稳定来源键；同一项目问题通过稳定任务 ID 和 Supabase 唯一索引防止重复。
- 「交给 Codex」只对缺失 README、HANDOFF 或 TODO/PROJECT_STATUS 开放。第一次确认启动本机 CLI 的只读草稿任务；用户查看精确 diff 并再次确认后，Runner 才会创建那一个文档。不会删除、修改业务源码、操作其他项目、执行任意命令、commit 或 push。
- Local Companion 仍保持只读；本机写入逻辑独立位于 `action_runner.py`。Runner 离线或 CLI 不可用时，界面提供受限的复制 Task fallback。
- 页面显示版本来自 `src/version.js` 的 `APP_VERSION`。

用户于 2026-10-04 确认已在 Supabase Dashboard → SQL Editor 执行 [`supabase/v2.8-task-suggestions.sql`](supabase/v2.8-task-suggestions.sql)。该迁移为 Tasks 增加说明与幂等来源键，并保留既有 RLS 策略。用户同时确认 V2.8 人工验收通过：任务创建与防重复、打开项目、交给 Codex、确认弹窗、Action Runner 执行和重新扫描均已测试。

需要使用「交给 Codex」时，先确认官方 Codex CLI 的 `codex.exe` 可通过 `PATH` 找到，再于单独终端运行 `python action_runner.py`。Runner 仅监听 `127.0.0.1:4175`、只接受工作台来源和 `D:\_Codex project` 扫描清单内的项目，不会自动启动。

## V1 功能

- Dashboard：以当前 Supabase 账号的真实项目/任务为主，提供可点击的项目/任务统计、3–5 个手动置顶项目、优先待办和既有低权重建议；未置顶项目只在 Projects 显示。项目阶段、下一步和任务完成计数只用已保存数据，无数据时省略对应字段；置顶卡片突出 GitHub 最近提交。外部链接仅接受 HTTP/HTTPS。Companion 仅作可选增强并显示在次要位置。云同步失败时标明缓存状态、错误和重试入口，不将本机草稿当作云端资料。
- Projects：项目列表与详情，可创建、编辑、删除项目、查看 TODO、关联资料及活动。删除项目会保留关联记录并解除关联。
- GitHub 仓库只读摘要：可刷新公开仓库的名称、默认分支、仓库更新时间、最新 commit、Pages 地址、可见性和本地刷新时间；刷新失败时保留上次成功数据。
- 本地项目只读扫描：Projects 显示 `D:\_Codex project` 下发现的项目、路径、Git 仓库/分支/clean 状态、HEAD、`origin/main`、领先/落后、最近本地 commit、常见文档文件是否存在和最后修改时间。
- 本地项目详情与 GitHub 仓库按安全提取的 GitHub owner/repository 地址优先匹配；详情展示完整本地 Git 与文档状态。
- Dashboard 健康指标与提醒：按本地扫描统计 clean、未提交修改、ahead/behind、README/HANDOFF/TODO 缺失和超过 30 天未更新，并提供项目入口。
- Authentication gate：Supabase 校验已有账号后才导入私人 Workspace；未登录只显示邮箱和密码表单，界面不提供注册入口。
- Dashboard “自上次打开后”对比新 commit、Git 状态、文档、文件更新时间和同步变化；完整扫描只保留在页面内存，比较基线不保存本地路径或项目名。
- Knowledge：添加、编辑、删除文本、笔记和网页链接，支持标签和项目关联。
- Decisions：记录问题、方案、目标、时间、成本、风险、Mock AI 建议和最终决定。
- Tasks：创建和完成任务，设置优先级与项目，并按状态筛选。
- Dashboard 的最近活跃项目综合本地最后修改、最近本地 Git commit 和已缓存 GitHub 更新时间排序。
- Global Search：搜索项目、资料、决策和任务；演示资料可试搜 `Supabase` 或 `GitHub Pages`。
- AI Assistant：Dashboard、项目详情、Knowledge、Decisions、Tasks 和 Projects 通过统一的 AI service/provider 接口调用 GLM-4-Flash，并使用受控页面上下文。
- Dashboard 与项目页 AI 会结合本机 Git 状态、ahead/behind、最近修改、工作台 TODO、文档存在状态和 GitHub 时间摘要建议下一步；不会发送本机绝对路径。
- AI 状态清楚显示 `GLM-4-Flash` 与 `glm-4-flash-250414`。真实服务失败时显示分类错误并允许重试，不会永久切回 Mock。
- Activity Timeline：记录新建项目、资料、任务、任务完成和决策保存。
- Appearance：首次跟随系统浅色/深色偏好；可手动切换，选择保存在 `localStorage`。

## V1 范围边界

主题、活动时间线、GitHub 只读快照和 Companion 状态按设备保存在浏览器 `localStorage`；Tasks、Knowledge、Decisions 和 Projects 基础资料从 Supabase 同步。AI 请求仅在已登录 Workspace 内发往单独的 Cloudflare Worker，再由 Worker 调用智谱 BigModel；浏览器只持有公开 Worker 地址，Key 只存于 Worker Secret。若本地未配置真实 Worker 地址，可使用本地 Mock；真实服务出错时保持错误状态并支持重试。

### V2.2 GitHub 只读数据

在 Projects 页面点“刷新 GitHub 数据”后，应用使用 GitHub Public API 读取填入的公开 `github.com/{owner}/{repo}` 地址：仓库名称、默认分支、更新时间、最新 commit 消息和时间、Public 状态，以及已启用时的 GitHub Pages URL。当匿名 Pages API 没有返回站点地址时，会显示按 GitHub Pages 默认命名规则推导的地址并标注“默认地址”。请求无登录、Token 或写操作。成功快照保存在 `localStorage`；请求失败会显示状态并保留上次成功快照。V2.5 的初始示例项目不包含个人仓库地址或本机路径；已有浏览器中的用户数据保持不变。

### V2.3 本地项目只读 companion

`python local_companion.py` 仅绑定 `127.0.0.1:4174`，服务页面静态资源和 `GET /api/local-projects`。扫描范围固定为 `D:\_Codex project`；隐藏目录、Git 元数据和常见依赖/构建/缓存目录不会作为项目或修改时间来源。Git 状态命令仅读取本地数据，并设置 `GIT_OPTIONAL_LOCKS=0`；companion 不执行 fetch、pull、commit、push、checkout 或其他网络/写操作。`origin/main` 和 ahead/behind 使用本地已有引用，不保证它刚与 GitHub 同步。

文档扫描只检查根目录和 `docs/` 中 README、HANDOFF、PROJECT_STATUS、TODO、PROJECT_CONTEXT、CHANGELOG 文件名是否存在，不读取正文。扫描不会写入扫描到的项目。V2.4 为跨次比较保存一份轻量基线；V2.4.1 另在当前浏览器的独立 localStorage 项中保留上次成功扫描，以便 Companion 暂时离线时显示旧数据并标记“数据可能不是最新”。缓存只在当前浏览器来源内使用，不跨设备同步。Companion 仅绑定 `127.0.0.1:4174`；API 保持只读 GET，并只允许工作台的 GitHub Pages 来源跨源读取。

不支持私有仓库授权、GitHub 写操作/自动化、扫描 `D:\` 全盘、文档正文解析、PDF/网页自动解析或真实 AI 服务。V2.6 云同步不包含实时协作和 Companion 本地状态。

### `/api/chat` 预留契约

请求为 JSON：`{ message, currentPage, currentProject, relevantContext, history }`。响应为 JSON：`{ message: { role: "assistant", content: "..." }, provider: "real" | "mock" }`。前端只通过 `src/ai/service.js` 调用统一 `chat()`；响应无效或服务不可用时自动改由本地 Mock Provider 回复。

## Repository map

| Path | Purpose |
| --- | --- |
| `index.html` | 应用入口 |
| `src/auth/gate.js` | Login-first session validation and private app boot |
| `src/auth/config.js` | Public Supabase URL and anon/publishable-key configuration |
| `src/cloud/sync.js` | RLS-bound workspace queries, safe local migration, cloud diff and project pin updates |
| `src/app.js` | 页面、交互、Assistant 面板和记录表单 |
| `src/version.js` | 单一页面版本来源 |
| `src/suggestions.js` | Dashboard 建议结构、安全动作列表和 Codex Task 模板 |
| `action_runner.py` | 独立 loopback Runner；生成并确认创建单个缺失文档 |
| `src/ai/config.js` | 公开 Worker 地址和模型配置，不含 API Key |
| `src/ai/service.js` | 统一 chat 接口、provider 状态与错误处理 |
| `src/ai/context.js` | 从当前页面构造裁剪后的相关上下文 |
| `src/dashboard.js` | 首页健康统计、继续建议优先级和扫描状态比较 |
| `src/ai/providers/` | 本地 Mock Provider 与 Cloudflare Worker HTTP Provider |
| `cloudflare/` | 独立 `daniel-workspace-api` Worker、BigModel 转发和 Wrangler 配置 |
| `src/github/public-api.js` | 公开 GitHub 仓库只读 API 与响应归一化 |
| `local_companion.py` | loopback 静态服务和 `D:\_Codex project` 只读扫描 API |
| `src/store.js` | localStorage 读写与演示数据恢复 |
| `supabase/v2.6-cloud-sync.sql` | V2.6 tables, per-user RLS, grants, and updated_at triggers |
| `supabase/v3.1-b-project-pinning.sql` | Additive `workspace_projects.is_pinned` field for cross-device Home pinning |
| `supabase/v2.8-task-suggestions.sql` | Task description/source-key columns and idempotency index |
| `src/mock-data.js` | 初始演示数据 |
| `assets/styles.css` | 浅色/深色响应式界面 |
| `AGENTS.md` | 项目操作指引 |
| `docs/PROJECT_CONTEXT.md` | 范围、约束与设计决策 |
| `docs/HANDOFF.md` | 当前状态与恢复方式 |
| `CHANGELOG.md` | 用户可见里程碑 |

## Sync workflow

开始编辑前检查 Git 状态；工作区干净时安全同步远端。交接前检查 `.gitignore` 和暂存内容，更新必要文档，提交并推送到 GitHub `main`；GitHub Pages 从 `main` 根目录自动发布。
