# Changelog

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
