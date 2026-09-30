# Daniel Workspace

本地优先的私人 AI 工作台 V2.5。GitHub Pages 对未登录访客只显示登录页；现有 Supabase email/password 用户登录后，才加载当前浏览器的 Workspace 数据并连接本机只读 Companion。内容继续保存在本机 localStorage，不做云同步；AI Assistant 仍为本地 Mock。

## Status

- **Stage:** V2.5 login gate and public Supabase client configuration are in place; one allowed account and Supabase Dashboard settings remain to be confirmed
- **Last updated:** 2026-09-30
- **Primary deliverable:** 本仓库中的本地 Web 应用

## Quick start

先完成 [Supabase 登录配置](#v25-登录配置)。本地预览需要 Python 3 和 Git。Windows 登录后，任务计划程序会静默启动 Companion（`pythonw.exe`，任务名 `DanielWorkspaceLocalCompanion`）；它会同时提供静态页面和只读扫描 API。也可以手动运行：

```powershell
python local_companion.py
```

在浏览器打开 [http://127.0.0.1:4174](http://127.0.0.1:4174) 并登录。登录前页面不会读取 Workspace/扫描缓存，也不会请求 Companion。登录后按 `Ctrl+K` 或 `⌘K` 聚焦全局搜索；GitHub Pages 会在登录后尝试从本机 `127.0.0.1:4174` 读取扫描，浏览器可能要求允许页面访问本地网络。

手动控制 Companion：前台运行 `python local_companion.py` 时按 `Ctrl+C` 停止；开机任务启动的后台实例可在 PowerShell 执行 `Stop-ScheduledTask -TaskName "DanielWorkspaceLocalCompanion"` 停止。取消后续登录自动启动，执行 `Unregister-ScheduledTask -TaskName "DanielWorkspaceLocalCompanion" -Confirm:$false`。重新登录 Windows 会再次启动仍注册的任务。

项目、资料、决策、任务与主题偏好保存在当前浏览器的 `localStorage`（同一浏览器配置和站点来源内）。刷新或重开页面后会保留；“重置演示数据”会恢复样例内容并保留主题选择。

## V2.5 登录配置

应用不提供注册入口。当前 `src/auth/config.js` 已使用本机“云养猫 / 蓝蓝”项目的 URL 和 **publishable key**。Supabase Dashboard 中请进入 **Authentication → Settings**，关闭 **Allow new users to sign up**；再进入 **Authentication → URL Configuration**，将 **Site URL** 设为 `https://danielsxujiacong-cell.github.io/daniel-workspace/`，并将同一地址加入 **Redirect URLs**。Dashboard 当前未对本任务开放，因此这些设置尚待控制台确认。

`src/auth/config.js` 的 `SUPABASE_ALLOWED_USER` 必须填唯一账号的 Supabase User UUID 或登录邮箱；建议用 User UUID，避免把邮箱放进公开源码。留空时默认拒绝所有账号。只允许已存在的 Email + Password 账号登录，不能从应用注册。项目 URL 和 publishable key 属于公开前端配置；绝不填 `service_role` key、数据库密码、用户密码或私密 Token。

登录门在 `getUser()` 成功验证会话前不会导入 `src/app.js`，读取 Workspace localStorage 或扫描缓存，也不会请求 Local Companion。退出会立即清空页面和应用内存并停止扫描请求；原有 `daniel-workspace-v1` 浏览器数据会保留，供此设备下一次成功登录继续使用。Supabase 只管理认证会话，不存储 Workspace 内容。

## V1 功能

- Dashboard：今日继续项目、工作区健康指标、真实扫描提醒、扫描变化和最近活跃项目；弱化演示数量卡片。
- Projects：项目列表与详情，可创建、编辑、删除项目、查看 TODO、关联资料及活动。删除项目会保留关联记录并解除关联。
- GitHub 仓库只读摘要：可刷新公开仓库的名称、默认分支、仓库更新时间、最新 commit、Pages 地址、可见性和本地刷新时间；刷新失败时保留上次成功数据。
- 本地项目只读扫描：Projects 显示 `D:\_Codex project` 下发现的项目、路径、Git 仓库/分支/clean 状态、HEAD、`origin/main`、领先/落后、最近本地 commit、常见文档文件是否存在和最后修改时间。
- 本地项目详情与 GitHub 仓库按安全提取的 GitHub owner/repository 地址优先匹配；详情展示完整本地 Git 与文档状态。
- Dashboard 健康指标与提醒：按本地扫描统计 clean、未提交修改、ahead/behind、README/HANDOFF/TODO 缺失和超过 30 天未更新，并提供项目入口。
- Authentication gate：Supabase 校验已有账号后才导入私人 Workspace 并读取本机数据；未登录只显示邮箱和密码表单，界面不提供注册入口。
- Dashboard “自上次打开后”对比新 commit、Git 状态、文档、文件更新时间和同步变化；完整扫描只保留在页面内存，比较基线不保存本地路径或项目名。
- Knowledge：添加、编辑、删除文本、笔记和网页链接，支持标签和项目关联。
- Decisions：记录问题、方案、目标、时间、成本、风险、Mock AI 建议和最终决定。
- Tasks：创建和完成任务，设置优先级与项目，并按状态筛选。
- Dashboard 的最近活跃项目综合本地最后修改、最近本地 Git commit 和已缓存 GitHub 更新时间排序。
- Global Search：搜索项目、资料、决策和任务；演示资料可试搜 `Supabase` 或 `GitHub Pages`。
- AI Assistant：Dashboard、项目详情、Knowledge、Decisions、Tasks 和 Projects 使用各自的本地页面上下文生成 Mock 回复；调用统一的 AI service/provider 接口。
- Dashboard 与项目页 Mock AI 可结合本地 Git 状态、ahead/behind、最近修改、已缓存 GitHub 快照、工作台 TODO 和文档存在状态建议下一步。
- AI 状态：当前显示 Mock AI。只有安全配置服务端 `/api/chat` 后才会选择 Real AI；接口不可用时自动回退到 Mock。
- Activity Timeline：记录新建项目、资料、任务、任务完成和决策保存。
- Appearance：首次跟随系统浅色/深色偏好；可手动切换，选择保存在 `localStorage`。

## V1 范围边界

工作区数据和 GitHub 快照保存在当前浏览器 `localStorage`，不会在设备或浏览器之间同步。当前 AI 没有服务端路由或 API Key，所有对话都由 Mock Provider 在浏览器本地回答，不会发送到网络。以后启用 Real AI 时，需部署服务端/serverless `POST /api/chat`，将 `OPENAI_API_KEY` 配在服务端环境变量，并由服务端输出不含密钥的 `window.DANIEL_AI_CONFIG = { provider: "real", chatEndpoint: "/api/chat" }`。Key 绝不能放入前端代码或静态托管配置。

### V2.2 GitHub 只读数据

在 Projects 页面点“刷新 GitHub 数据”后，应用使用 GitHub Public API 读取填入的公开 `github.com/{owner}/{repo}` 地址：仓库名称、默认分支、更新时间、最新 commit 消息和时间、Public 状态，以及已启用时的 GitHub Pages URL。当匿名 Pages API 没有返回站点地址时，会显示按 GitHub Pages 默认命名规则推导的地址并标注“默认地址”。请求无登录、Token 或写操作。成功快照保存在 `localStorage`；请求失败会显示状态并保留上次成功快照。V2.5 的初始示例项目不包含个人仓库地址或本机路径；已有浏览器中的用户数据保持不变。

### V2.3 本地项目只读 companion

`python local_companion.py` 仅绑定 `127.0.0.1:4174`，服务页面静态资源和 `GET /api/local-projects`。扫描范围固定为 `D:\_Codex project`；隐藏目录、Git 元数据和常见依赖/构建/缓存目录不会作为项目或修改时间来源。Git 状态命令仅读取本地数据，并设置 `GIT_OPTIONAL_LOCKS=0`；companion 不执行 fetch、pull、commit、push、checkout 或其他网络/写操作。`origin/main` 和 ahead/behind 使用本地已有引用，不保证它刚与 GitHub 同步。

文档扫描只检查根目录和 `docs/` 中 README、HANDOFF、PROJECT_STATUS、TODO、PROJECT_CONTEXT、CHANGELOG 文件名是否存在，不读取正文。扫描不会写入扫描到的项目。V2.4 为跨次比较保存一份轻量基线；V2.4.1 另在当前浏览器的独立 localStorage 项中保留上次成功扫描，以便 Companion 暂时离线时显示旧数据并标记“数据可能不是最新”。缓存只在当前浏览器来源内使用，不跨设备同步。Companion 仅绑定 `127.0.0.1:4174`；API 保持只读 GET，并只允许工作台的 GitHub Pages 来源跨源读取。

不支持私有仓库授权、GitHub 写操作/自动化、云同步/数据库、扫描 `D:\` 全盘、文档正文解析、PDF/网页自动解析或真实 AI 服务；未实现部分不属于 V2.4.1。

### `/api/chat` 预留契约

请求为 JSON：`{ message, currentPage, currentProject, relevantContext, history }`。响应为 JSON：`{ message: { role: "assistant", content: "..." }, provider: "real" | "mock" }`。前端只通过 `src/ai/service.js` 调用统一 `chat()`；响应无效或服务不可用时自动改由本地 Mock Provider 回复。

## Repository map

| Path | Purpose |
| --- | --- |
| `index.html` | 应用入口 |
| `src/auth/gate.js` | Login-first session validation and private app boot |
| `src/auth/config.js` | Public Supabase URL and anon/publishable-key configuration |
| `src/app.js` | 页面、交互、Assistant 面板和记录表单 |
| `src/ai/service.js` | 统一 chat 接口、provider 选择与安全回退 |
| `src/ai/context.js` | 从当前页面构造最小相关上下文 |
| `src/dashboard.js` | 首页健康统计、继续建议优先级和扫描状态比较 |
| `src/ai/providers/` | 本地 Mock Provider 与 `/api/chat` HTTP Provider |
| `src/github/public-api.js` | 公开 GitHub 仓库只读 API 与响应归一化 |
| `local_companion.py` | loopback 静态服务和 `D:\_Codex project` 只读扫描 API |
| `src/store.js` | localStorage 读写与演示数据恢复 |
| `src/mock-data.js` | 初始演示数据 |
| `assets/styles.css` | 浅色/深色响应式界面 |
| `AGENTS.md` | 项目操作指引 |
| `docs/PROJECT_CONTEXT.md` | 范围、约束与设计决策 |
| `docs/HANDOFF.md` | 当前状态与恢复方式 |
| `CHANGELOG.md` | 用户可见里程碑 |

## Sync workflow

开始编辑前检查 Git 状态；工作区干净时安全同步远端。交接前检查 `.gitignore` 和暂存内容，更新必要文档，提交并推送到 GitHub `main`；GitHub Pages 从 `main` 根目录自动发布。
