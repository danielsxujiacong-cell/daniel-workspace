# Daniel Workspace

本地优先的个人 AI 工作台 V1 MVP。用一个深色工作区管理项目、资料、决策与待办；内置 Mock AI 和演示数据，不需要账号、数据库或 API 密钥。

## Status

- **Stage:** V1 MVP complete
- **Last updated:** 2026-09-27
- **Primary deliverable:** 本仓库中的本地 Web 应用

## Quick start

需要 Python 3。进入项目目录后运行：

```powershell
python -m http.server 4174 --bind 127.0.0.1
```

在浏览器打开 [http://localhost:4174](http://localhost:4174)。按 `Ctrl+K` 或 `⌘K` 聚焦全局搜索。

数据保存在当前浏览器的 `localStorage`。在左下角选择重置图标可恢复演示数据。

## V1 功能

- Dashboard：项目、待办、资料、决策、活动和下一步建议。
- Projects：项目列表与详情，可创建和编辑项目、查看 TODO、关联资料及活动。
- Knowledge：添加、编辑、删除文本、笔记和网页链接，支持标签和项目关联。
- Decisions：记录问题、方案、目标、时间、成本、风险、Mock AI 建议和最终决定。
- Tasks：创建和完成任务，设置优先级与项目，并按状态筛选。
- Global Search：搜索项目、资料、决策和任务；演示资料可试搜 `Supabase` 或 `GitHub Pages`。
- AI Assistant：随页面切换上下文的本地 Mock 对话。
- Activity Timeline：记录新建项目、资料、任务、任务完成和决策保存。

## Repository map

| Path | Purpose |
| --- | --- |
| `index.html` | 应用入口 |
| `src/app.js` | 页面、交互、Mock AI 和记录表单 |
| `src/store.js` | localStorage 读写与演示数据恢复 |
| `src/mock-data.js` | 初始演示数据 |
| `assets/styles.css` | 深色响应式界面 |
| `AGENTS.md` | 项目操作指引 |
| `docs/PROJECT_CONTEXT.md` | 范围、约束与设计决策 |
| `docs/HANDOFF.md` | 当前状态与恢复方式 |
| `CHANGELOG.md` | 用户可见里程碑 |

## Sync workflow

开始编辑前检查 Git 状态；工作区干净时安全同步远端。交接前检查 `.gitignore` 和暂存内容，更新必要文档，提交并推送到私有 GitHub 仓库。
