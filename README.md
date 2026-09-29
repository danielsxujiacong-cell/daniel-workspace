# Daniel Workspace

本地优先的个人 AI 工作台 V2.2。用深色或浅色工作区管理项目、资料、决策与待办；AI Assistant 使用页面上下文和本地 Mock 数据。Projects 可读取公开 GitHub 仓库摘要，不需要登录或 Token。

## Status

- **Stage:** V2.2 complete; GitHub read-only; Real AI server route is reserved but not enabled
- **Last updated:** 2026-09-29
- **Primary deliverable:** 本仓库中的本地 Web 应用

## Quick start

需要 Python 3。进入项目目录后运行：

```powershell
python -m http.server 4174 --bind 127.0.0.1
```

在浏览器打开 [http://localhost:4174](http://localhost:4174)。按 `Ctrl+K` 或 `⌘K` 聚焦全局搜索。

项目、资料、决策、任务与主题偏好保存在当前浏览器的 `localStorage`（同一浏览器配置和站点来源内）。刷新或重开页面后会保留；“重置演示数据”会恢复样例内容并保留主题选择。

## V1 功能

- Dashboard：项目、待办、资料、决策、活动和下一步建议。
- Projects：项目列表与详情，可创建、编辑、删除项目、查看 TODO、关联资料及活动。删除项目会保留关联记录并解除关联。
- GitHub 仓库只读摘要：可刷新公开仓库的名称、默认分支、仓库更新时间、最新 commit、Pages 地址、可见性和本地刷新时间；刷新失败时保留上次成功数据。
- Knowledge：添加、编辑、删除文本、笔记和网页链接，支持标签和项目关联。
- Decisions：记录问题、方案、目标、时间、成本、风险、Mock AI 建议和最终决定。
- Tasks：创建和完成任务，设置优先级与项目，并按状态筛选。
- Dashboard 的最近项目优先按 GitHub 仓库更新时间排序并显示该时间；未连接仓库时继续使用本地项目数据。
- Global Search：搜索项目、资料、决策和任务；演示资料可试搜 `Supabase` 或 `GitHub Pages`。
- AI Assistant：Dashboard、项目详情、Knowledge、Decisions、Tasks 和 Projects 使用各自的本地页面上下文生成 Mock 回复；调用统一的 AI service/provider 接口。
- AI 状态：当前显示 Mock AI。只有安全配置服务端 `/api/chat` 后才会选择 Real AI；接口不可用时自动回退到 Mock。
- Activity Timeline：记录新建项目、资料、任务、任务完成和决策保存。
- Appearance：首次跟随系统浅色/深色偏好；可手动切换，选择保存在 `localStorage`。

## V1 范围边界

工作区数据和 GitHub 快照保存在当前浏览器 `localStorage`，不会在设备或浏览器之间同步。当前 AI 没有服务端路由或 API Key，所有对话都由 Mock Provider 在浏览器本地回答，不会发送到网络。以后启用 Real AI 时，需部署服务端/serverless `POST /api/chat`，将 `OPENAI_API_KEY` 配在服务端环境变量，并由服务端输出不含密钥的 `window.DANIEL_AI_CONFIG = { provider: "real", chatEndpoint: "/api/chat" }`。Key 绝不能放入前端代码或静态托管配置。

### V2.2 GitHub 只读数据

在 Projects 页面点“刷新 GitHub 数据”后，应用使用 GitHub Public API 读取填入的公开 `github.com/{owner}/{repo}` 地址：仓库名称、默认分支、更新时间、最新 commit 消息和时间、Public 状态，以及已启用时的 GitHub Pages URL。当匿名 Pages API 没有返回站点地址时，会显示按 GitHub Pages 默认命名规则推导的地址并标注“默认地址”。请求无登录、Token 或写操作。成功快照保存在 `localStorage`；请求失败会显示状态并保留上次成功快照。未配置仓库的项目继续使用现有本地信息。当前演示中的“个人工作台”指向本仓库，其余示例项目没有虚构仓库地址。

不支持私有仓库授权、GitHub 写操作/自动化、云同步/数据库、扫描本地项目，以及 PDF/网页自动解析；这些留待后续版本评估。

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
| `src/store.js` | localStorage 读写与演示数据恢复 |
| `src/mock-data.js` | 初始演示数据 |
| `assets/styles.css` | 浅色/深色响应式界面 |
| `AGENTS.md` | 项目操作指引 |
| `docs/PROJECT_CONTEXT.md` | 范围、约束与设计决策 |
| `docs/HANDOFF.md` | 当前状态与恢复方式 |
| `CHANGELOG.md` | 用户可见里程碑 |

## Sync workflow

开始编辑前检查 Git 状态；工作区干净时安全同步远端。交接前检查 `.gitignore` 和暂存内容，更新必要文档，提交并推送到 GitHub `main`；GitHub Pages 从 `main` 根目录自动发布。
