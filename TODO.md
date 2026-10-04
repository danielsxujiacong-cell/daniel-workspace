# TODO

## 项目目标

维护一个个人 AI 工作台，用于集中管理项目、任务、知识和决策；跨设备共享经身份验证的工作区资料，同时把本机路径与 Git/文件状态留在本机。

## 当前功能

- Supabase Auth 登录门；登录后 Tasks、Knowledge、Decisions 和 Project 基础资料按用户身份同步。
- Dashboard 展示本机项目状态、健康提醒和结构化 AI 建议；支持查看项目、创建任务和交给 Codex。
- Local Companion 只读扫描固定的 `D:\_Codex project` 根目录；Action Runner 在两次用户确认后，才创建一个 allowlist 内的缺失文档。
- Assistant 经 Cloudflare Worker 调用 GLM；浏览器不持有模型 API Key。
- GitHub 公共仓库信息只读；主题、扫描缓存和本机路径保留在设备本地。

## 技术栈

- Vanilla HTML、CSS、JavaScript；静态应用没有构建步骤。
- Python 3 标准库：本机 Companion 与独立 Action Runner。
- Supabase Auth、Postgres/RLS；Cloudflare Worker、Wrangler 和 GLM-4-Flash。
- Node.js/npm 仅用于 Wrangler 开发与部署。

## 已完成

- V2.8 结构化建议、任务去重、项目导航和受限 Codex 文档动作。
- 用户于 2026-10-04 确认 V2.8 人工验收完成：Supabase 迁移、任务创建与防重复、打开项目、Codex 确认、Runner 执行及重新扫描均已测试。
- GitHub Pages、Supabase 登录与云同步、只读本机扫描及 GLM Assistant。

## 已知问题与运行边界

- 第二个 Supabase 用户及第二台设备的隔离/恢复验收仍未记录。
- Local Companion 与 Action Runner 仅服务当前电脑；使用 Codex 动作时需在项目目录手动运行 `python action_runner.py`，并确保 Codex CLI 可用。
- Runner 只处理固定 allowlist 文档动作；不会执行任意命令、删除、修改其他项目、commit 或 push。

## 下一步

- 当前 V2.8 验收事项已完成；等待用户指定后续范围。不要自行开始 V2.9。
