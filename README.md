# Daniel Workspace

本地优先的个人 AI 工作台 V2.3。用深色或浅色工作区管理项目、资料、决策与待办；AI Assistant 使用页面上下文、本机只读项目状态和本地 Mock 数据。Projects 可读取公开 GitHub 仓库摘要，不需要登录或 Token。

## Status

- **Stage:** V2.3 complete; local project scanner and GitHub reads are read-only; Real AI server route is reserved but not enabled
- **Last updated:** 2026-09-29
- **Primary deliverable:** 本仓库中的本地 Web 应用

## Quick start

需要 Python 3 和 Git，并在本机项目目录运行 companion。它会同时提供静态页面和只读扫描 API：

```powershell
python local_companion.py
```

在浏览器打开 [http://localhost:4174](http://localhost:4174)。按 `Ctrl+K` 或 `⌘K` 聚焦全局搜索。停止服务按 `Ctrl+C`。GitHub Pages 版本仍可浏览工作台，但浏览器不能扫描本机磁盘。

项目、资料、决策、任务与主题偏好保存在当前浏览器的 `localStorage`（同一浏览器配置和站点来源内）。刷新或重开页面后会保留；“重置演示数据”会恢复样例内容并保留主题选择。

## V1 功能

- Dashboard：项目、待办、资料、决策、活动和下一步建议。
- Projects：项目列表与详情，可创建、编辑、删除项目、查看 TODO、关联资料及活动。删除项目会保留关联记录并解除关联。
- GitHub 仓库只读摘要：可刷新公开仓库的名称、默认分支、仓库更新时间、最新 commit、Pages 地址、可见性和本地刷新时间；刷新失败时保留上次成功数据。
- 本地项目只读扫描：Projects 显示 `D:\_Codex project` 下发现的项目、路径、Git 仓库/分支/clean 状态、HEAD、`origin/main`、领先/落后、最近本地 commit、常见文档文件是否存在和最后修改时间。
- 本地项目详情与 GitHub 仓库按安全提取的 GitHub owner/repository 地址优先匹配；详情展示完整本地 Git 与文档状态。
- Dashboard 本地提醒：列出未提交修改、领先/落后远端、没有 Git、缺少关键项目文档的项目。
- Knowledge：添加、编辑、删除文本、笔记和网页链接，支持标签和项目关联。
- Decisions：记录问题、方案、目标、时间、成本、风险、Mock AI 建议和最终决定。
- Tasks：创建和完成任务，设置优先级与项目，并按状态筛选。
- Dashboard 的最近项目优先按 GitHub 仓库更新时间排序并显示该时间；未连接仓库时继续使用本地项目数据。
- Global Search：搜索项目、资料、决策和任务；演示资料可试搜 `Supabase` 或 `GitHub Pages`。
- AI Assistant：Dashboard、项目详情、Knowledge、Decisions、Tasks 和 Projects 使用各自的本地页面上下文生成 Mock 回复；调用统一的 AI service/provider 接口。
- 项目页 Mock AI 可结合本地 Git 状态、已缓存的 GitHub 快照、工作台 TODO 和文档存在状态回答“这个项目现在有什么问题？”。
- AI 状态：当前显示 Mock AI。只有安全配置服务端 `/api/chat` 后才会选择 Real AI；接口不可用时自动回退到 Mock。
- Activity Timeline：记录新建项目、资料、任务、任务完成和决策保存。
- Appearance：首次跟随系统浅色/深色偏好；可手动切换，选择保存在 `localStorage`。

## V1 范围边界

工作区数据和 GitHub 快照保存在当前浏览器 `localStorage`，不会在设备或浏览器之间同步。当前 AI 没有服务端路由或 API Key，所有对话都由 Mock Provider 在浏览器本地回答，不会发送到网络。以后启用 Real AI 时，需部署服务端/serverless `POST /api/chat`，将 `OPENAI_API_KEY` 配在服务端环境变量，并由服务端输出不含密钥的 `window.DANIEL_AI_CONFIG = { provider: "real", chatEndpoint: "/api/chat" }`。Key 绝不能放入前端代码或静态托管配置。

### V2.2 GitHub 只读数据

在 Projects 页面点“刷新 GitHub 数据”后，应用使用 GitHub Public API 读取填入的公开 `github.com/{owner}/{repo}` 地址：仓库名称、默认分支、更新时间、最新 commit 消息和时间、Public 状态，以及已启用时的 GitHub Pages URL。当匿名 Pages API 没有返回站点地址时，会显示按 GitHub Pages 默认命名规则推导的地址并标注“默认地址”。请求无登录、Token 或写操作。成功快照保存在 `localStorage`；请求失败会显示状态并保留上次成功快照。未配置仓库的项目继续使用现有本地信息。当前演示中的“个人工作台”指向本仓库，其余示例项目没有虚构仓库地址。

### V2.3 本地项目只读 companion

`python local_companion.py` 仅绑定 `127.0.0.1:4174`，服务页面静态资源和 `GET /api/local-projects`。扫描范围固定为 `D:\_Codex project`；隐藏目录、Git 元数据和常见依赖/构建/缓存目录不会作为项目或修改时间来源。Git 状态命令仅读取本地数据，并设置 `GIT_OPTIONAL_LOCKS=0`；companion 不执行 fetch、pull、commit、push、checkout 或其他网络/写操作。`origin/main` 和 ahead/behind 使用本地已有引用，不保证它刚与 GitHub 同步。

文档扫描只检查根目录和 `docs/` 中 README、HANDOFF、PROJECT_STATUS、TODO、PROJECT_CONTEXT、CHANGELOG 文件名是否存在，不读取正文。扫描快照只保存在当前页面内存，不写入项目文件或 `localStorage`。companion 只允许本机 loopback Host、页面静态文件白名单与 GET；GitHub Pages 不会调用它。

不支持私有仓库授权、GitHub 写操作/自动化、云同步/数据库、扫描 `D:\` 全盘、文档正文解析、PDF/网页自动解析或真实 AI 服务；未实现部分不属于 V2.3。

### `/api/chat` 预留契约

请求为 JSON：`{ message, currentPage, currentProject, relevantContext, history }`。响应为 JSON：`{ message: { role: "assistant", content: "..." }, provider: "real" | "mock" }`。前端只通过 `src/ai/service.js` 调用统一 `chat()`；响应无效或服务不可用时自动改由本地 Mock Provider 回复。

## Repository map

| Path | Purpose |
| --- | --- |
| `index.html` | 应用入口 |
| `src/app.js` | 页面、交互、Assistant 面板和记录表单 |
| `src/ai/service.js` | 统一 chat 接口、provider 选择与安全回退 |
| `src/ai/context.js` | 从当前页面构造最小相关上下文 |
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
