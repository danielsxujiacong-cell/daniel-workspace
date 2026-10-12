# Daniel Workspace

Daniel Workspace V3.8-C 使用统一的完整工作台界面和两种数据模式。访客无需登录即可查看所有者逐条审核后发布的真实只读快照；登录后继续使用实时 Supabase、GitHub 和本机 Companion 私人工作台。访客模式只读取独立 Cloudflare KV 快照，不读取私人表、浏览器工作区缓存、本机文件或私有仓库。

## Status

- **Stage:** V3.8-B.1 improves authenticated GitHub activity coverage and the responsive Dashboard heatmap on the V3.8-C shared workspace. The public snapshot remains unpublished until the owner reviews and explicitly publishes it. Verification and handoff are recorded in [HANDOFF](docs/HANDOFF.md).
- **Last updated:** 2026-10-12
- **Primary deliverable:** 本仓库中的本地 Web 应用

## Quick start

先完成 [Supabase 登录配置](#v25-登录配置)。本地预览需要 Python 3 和 Git。Windows 登录后，任务计划程序会静默启动 Companion（`pythonw.exe`，任务名 `DanielWorkspaceLocalCompanion`）；它会同时提供静态页面和只读扫描 API。也可以手动运行：

```powershell
python local_companion.py
```

在浏览器打开 [http://127.0.0.1:4174](http://127.0.0.1:4174) 即可浏览公开只读工作台；根网址先显示完整界面，不因已保存的 Supabase 会话自动进入私人模式。快照未发布时页面会明确说明尚无公开项目数据，不显示 Mock 统计。登录后在私人工作台点击「预览访客快照」，逐条审核脱敏候选，再勾选最终确认并二次确认发布；预览不会上传数据。已发布快照通过 Worker 的公开 GET 从独立 KV 读取，访客搜索、导航、项目详情和图表筛选均为只读。`?mode=guest` 是公开模式别名，`?mode=login` 是唯一私人入口；退出后回到公开根网址。FlowOps 网站明确标为虚构业务的模拟演示；TK-1001 流程模拟仅通过显式 `?mode=demo` 打开。登录后按 `Ctrl+K` 或 `⌘K` 聚焦全局搜索；Companion 仅在私人登录模式尝试从本机 `127.0.0.1:4174` 读取扫描。

手动控制 Companion：前台运行 `python local_companion.py` 时按 `Ctrl+C` 停止；开机任务启动的后台实例可在 PowerShell 执行 `Stop-ScheduledTask -TaskName "DanielWorkspaceLocalCompanion"` 停止。取消后续登录自动启动，执行 `Unregister-ScheduledTask -TaskName "DanielWorkspaceLocalCompanion" -Confirm:$false`。重新登录 Windows 会再次启动仍注册的任务。

主题、本机 Companion 扫描缓存、GitHub 只读快照和云端离线副本保存在当前浏览器的 `localStorage`。云端业务资料以 Supabase 为准，可在已登录设备间共享；首次遇到旧版本机内容时会先询问是否迁移。旧 `daniel-workspace-v1` 数据不会因迁移或云端读取而被删除。

## V3.6 工作记录与 AI 总结

- 项目详情提供工作记录表单：日期、完成事项、成果、下一步和最多 10 个 HTTP/HTTPS 证据链接。记录存入独立的 `workspace_work_logs` 表；用户 ID 与 `auth.uid()` RLS 一致，客户端只有读取、新增和更新权限，不提供删除入口。V3.6 迁移不改动 Projects、Tasks、Knowledge、Decisions 的现有行。
- 首页 AI 今日简报在点击后刷新置顶项目的 GitHub 真实提交，结合项目状态、近 7 天工作记录和可选的 Companion 元数据生成行动建议。简报只走已配置的真实 GLM Worker，输出必须匹配来源日期和原文依据；证据链接地址不会发送给模型。
- AI 每周总结按需汇总本周（Asia/Shanghai 周一至今天）的工作记录、当前项目状态与 GitHub 提交，分为本周成果、项目推进、问题与阻塞、下周计划，并支持复制。无法通过来源核验的内容会被丢弃。
- Supabase 只读核对：现有 26 个 Workspace 项目、5 个置顶项目保持不变，新工作记录表初始为 0 行。当前用户可在登录态手动验证保存、刷新后读取及另一设备同步；未进行模拟写入。

## V3.7-C 项目介绍与近期进展

- 首页和项目详情会把已核实的五个重点项目介绍成一句普通中文；扫描器留下的 README 版本标记只影响展示，不会批量改写云端项目资料。项目介绍仍可在项目编辑表单中逐项修改。
- 首页最近进展默认最多显示五条有依据的更新，按时间合并置顶项目最近 GitHub 提交和近七天工作记录。提交继续链接到原始 GitHub 记录；无法核实的英文提交标题不会直接当作成果展示。
- 项目介绍和成果摘要在页面渲染时不调用 AI。每日简报、每周总结和下一步建议仍须由用户主动生成。

## V3.7-D 项目作品化展示

- Home 与 Projects 项目卡明确提供「查看详情」；只有填写有效远端 HTTP(S) 在线网址的项目才显示「体验网站」，GitHub 仓库地址不会被当成体验站点。
- 项目详情依次展示用途、已核对的核心功能与成果，以及最多三条来自现有 GitHub 快照或工作记录的近期进展；路径、提交和仓库技术信息仍收在「技术详情」中。
- 访客页将项目导航、FlowOps 演示和个人作品集作为精选作品。访客内容只来自静态公开摘要，TK-1001 及相关公司/团队资料继续作为明确标注的虚构样例，仅保存在页面内存；不读取私人工作台资料、仓库文件或密钥。

## V3.7-E Home 首页最终版

- Home 标题改为「我的工作台」，用一行介绍承接首页内容，并优先展示手动置顶的 Daniel Workspace 主卡及最多四张次级项目卡。
- 卡片只展示项目名称、已核实的一句话用途、当前状态、「查看详情」和通过现有 URL 校验的「体验网站」入口；Home 不再展示最近进展，项目详情中的开发记录保留。
- AI 下一步建议、今日简报和每周总结继续由「AI 总结」默认折叠区承载。浅色主题采用米白、浅灰与克制紫色；手机端卡片纵向排列，AI 快捷入口放在内容之后，避免遮挡项目卡。
- 本次只改 Home 展示与资源缓存版本，不改 Supabase、GitHub、Worker、登录门或数据同步逻辑。

## V3.7-F Home 项目管理化

- Home 展示全部项目、进行中项目和未完成任务三个云端统计，并可分别进入对应项目/任务列表。
- 置顶项目使用统一紧凑卡片，只展示已填写的状态、阶段和下一步；完成情况只按真实关联任务计算，没有任务时隐藏进度。
- Home 恢复全站浅灰背景与白色卡片，项目介绍、GitHub 提交和开发记录留在详情页，AI 总结保持默认折叠。
- 仅调整 Home 展示、首页样式和静态资源缓存版本；不改数据库、数据同步、其他页面、访客权限或 AI 服务。

## V3.8 Project Control Dashboard

- Home 按顺序展示 Supabase 项目/任务 KPI、近 30 天默认的 GitHub 风格活动热力图与每日趋势、当前项目状态占比、已保存阶段分布、最多五个置顶项目，以及默认折叠的 AI 总结。
- GitHub 活动通过已认证的 Cloudflare Worker 分页读取 App 安装仓库清单、各仓库所有分支和分支 Commit 历史；按仓库和完整 SHA 去重，只返回每日计数。每个分支最多读取 100 页、每仓库最多读取 200 个分支；达到上限、限流、授权清单失败、分支读取失败或仓库 404 时显示仓库、操作和原因。App 范围外的 404 可能是未授权私有仓库、已删除仓库或名称不匹配，GitHub 不会披露更细原因。缺失数据不按零计算。工作记录图表读取全部云端项目对应日期范围内的记录 ID、项目 ID 和日期，不读取正文或证据链接；热力图和每日趋势复用同一份每日统计，来源分别标注。
- 日期范围支持近 7/30/90 天和不超过 366 天的自定义范围。横向日历热力图按日期顺序填满可用宽度，标出月份和星期，支持悬停/点击查看数量；手机端自动换行。仓库读取失败或达到分页上限时标记历史不完整，缺口日期不解释为零；没有保存阶段时显示「未分类」，重点项目只显示已保存状态、阶段、下一步和真实任务数，不显示百分比。
- 不增加 Supabase 迁移或修改业务行；GitHub 活动只缓存已完整读取所有关联仓库的结果，缓存按账号和筛选范围保存在本机最多 15 分钟，其他设备从相同云端项目和 Worker 独立读取。

## V3.8-A 公开只读 Dashboard

> 历史版本说明。完整访客体验、数据来源与发布方式以 [V3.8-C](#v38-c-完整工作台公开快照) 为准。

- 默认首页和 `?mode=guest` 直接展示只读项目指挥中心；登录入口位于右上角。根路由不读取已保存会话、不初始化 Auth，也不会自动进入私人工作台。仅从右上角进入 `?mode=login` 后才验证已保存会话；有效会话经 `getUser()` 验证后直接进入，未登录时显示密码表单。
- 公开页与登录 Home 共用 `dashboard-layout.js`、Dashboard 样式和卡片结构。公开白名单当前列出 5 个项目，其中 3 个已发布网站、1 个明确标注为模拟的 FlowOps 演示和 1 个只链接公开源码的项目。
- `/api/public/dashboard` 不访问 Supabase。Worker 只请求固定的 3 个已确认公开 GitHub 仓库，先验证仓库为公开，再返回近 30 个上海日期的每日 Commit 数；不返回 Commit 原文、SHA、私人表行、工作记录、安装仓库清单或令牌。接口响应公开缓存 5 分钟并受精确来源 CORS 与请求限流保护。
- 公开状态图只按静态白名单分类为「线上作品」「模拟演示」「公开源码」，不会复制私人 Workspace 保存的项目状态或阶段。没有安全公开依据的项目、任务、阶段和工作记录不展示。

## V3.8-C 完整工作台公开快照

- 访客与私人模式复用同一 `src/app.js`、Dashboard、项目、任务、知识资料、决策与工作记录只读视图。访客数据来自 `PUBLIC_WORKSPACE_SNAPSHOTS` KV 的固定 `latest` JSON；没有已审核快照时只显示空状态，不回退到 Mock/随机数据。
- 只有私人账号所有者可以打开「预览访客快照」。预览读取 Supabase 已同步记录和只核验为公开的 GitHub 每日聚合，默认不选任何记录；敏感提示需逐项确认，最终发布另有数量范围确认。普通文本中的外链、邮箱、电话、路径、Token 和私钥会清理；证据链接、仓库提交原文/SHA、Companion 与私人仓库内容不进入快照。
- Worker 只为经 `getUser()` 校验且 UUID 与 `WORKSPACE_USER_ID` 完全匹配的所有者接受发布 POST；拒绝额外字段、未通过清洗的内容和私有 GitHub 仓库。访客只能匿名 GET 快照；公开 Worker 路由不查询 Supabase 表，不提供私人记录 API。未修改数据库、RLS 或同步序列化。
- 本地目标验收为桌面与 390px 手机视口可浏览，以及已有会话根网址、无痕未登录、退出回根页和刷新不循环；访客不触发 AI、Auth、Workspace localStorage、Companion 或写操作。用户须在预览页确认数据后主动发布；不得由部署流程自动发布快照。

## V2.5 登录配置

应用不提供注册入口。`src/auth/config.js` 使用本机“云养猫 / 蓝蓝”项目的 URL 和 **publishable key**，并只允许指定的 Supabase 用户 UUID。Supabase Dashboard 已关闭 **Allow new users to sign up**；**Site URL** 和 **Redirect URLs** 已按下方 Pages 地址配置。

`src/auth/config.js` 的 `SUPABASE_ALLOWED_USER` 设为唯一允许账号的 User UUID；留空时默认拒绝所有账号。只允许已存在的 Email + Password 账号登录，不能从应用注册。项目 URL 和 publishable key 属于公开前端配置；绝不填 `service_role` key、数据库密码、用户密码或私密 Token。

公开根路由只检查 URL 模式，不读取 Auth localStorage、不初始化 Supabase SDK、不读取 Workspace/扫描缓存，也不请求 Local Companion；随后在公开模式加载共享 `src/app.js`，其中 `store.js`、云同步、Auth、AI、Companion 和私人 GitHub 模块均被跳过。访客只从 Worker 的匿名 GET 读取独立 KV 快照。只有用户主动打开 `?mode=login` 时，入口才检查本机已保存会话；若有，会先调用 `getUser()` 验证唯一允许账号，再进入完整私人工作台；网络失败时保留登录界面并提示重试。退出会立即清空私人页面和应用内存、停止扫描并清理 Supabase 会话，然后导航到公开根网址。入口静态骨架屏在模块加载前显示，公开模块加载失败时提供重新加载入口。

访客隔离和登录门禁回归测试使用 Node 内置测试运行：

```powershell
npm test
```

## V2.6 云同步配置

`src/cloud/sync.js` 只上传 Task、Knowledge、Decision 和 Project 基础资料，并在每条记录上附加当前 `auth.uid()`。Project 的本机绝对路径、GitHub 只读快照、Companion 状态和扫描缓存不会发送到 Supabase。所有四张表启用 RLS，策略检查 `auth.uid() = user_id`；客户端继续使用现有 public publishable key，不含 service role key。

用户于 2026-10-04 确认已在 Supabase 执行 [v2.6-cloud-sync.sql](supabase/v2.6-cloud-sync.sql) 并完成线上迁移。V2.6 最终验收中，Tasks 与 Knowledge 测试记录刷新后仍存在；用户要求保留 Knowledge 测试记录。Decisions 测试记录刷新后仍存在，用户随后确认永久删除；删除状态同步后再次刷新仍为 0 条。Projects 云端基础资料在 Companion 离线时仍可查看，本机 16 项缓存会标记为可能过期；最终页面检查时 Companion 在线。四张表的匿名 PostgREST 请求均返回 HTTP 401，RLS 隔离生效。登录重试与 Decisions 删除入口已部署，Pages 入口及版本化脚本可读取。另一台设备读取及第二个 Auth 用户的隔离测试尚未进行。不要自动再次迁移，也不要删除旧 `localStorage` 数据。

## V3.5-B GitHub App 私有仓库只读

- Workspace 的 `/api/github/*` 请求必须携带 Supabase Bearer 会话。Worker 通过 Supabase Auth `get user` API 验证会话，并要求 UUID 与唯一 `WORKSPACE_USER_ID` 完全相同；缺少或不匹配时拒绝访问。
- Worker 使用 `GITHUB_APP_ID` 和 `GITHUB_APP_PRIVATE_KEY` 在服务端签署短期 App JWT，签发安装令牌后只读取该安装授权的仓库。令牌只留在 Worker 内存中，不返回浏览器；前端仅传入仓库名，Worker 会再次校验仓库确实在 App 安装范围内。
- 此读取路径不发起 GitHub 用户 OAuth 跳转，也不依赖安装映射 KV。GitHub App 只需现有 `Contents: Read-only` 与 `Metadata: Read-only` 权限。Cloudflare 另需现有 `SUPABASE_URL`、publishable key 和精确 `WORKSPACE_USER_ID` 配置；不要将 Secret 写入代码、`.dev.vars`、聊天或日志。
- Projects 的“刷新私有仓库”直接请求 Worker 并显示授权仓库数及读取状态。仓库快照留在当前浏览器，不写 Supabase；AI 简报只在用户点击后使用已关联的提交摘要。本机 Companion 提交说明、代码、路径不会发送给 AI。
- Worker 为 GitHub API 请求设置固定 `User-Agent`。上游读取失败时，返回真实 HTTP 状态和经过脱敏、截断的错误说明；安装令牌、App JWT 和私钥不进入响应。
- 公开仓库仍使用匿名 Public API；Companion 仍只读。本地离线或 GitHub 读取失败时保留上次成功快照并提示状态。

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

文档扫描只检查根目录和 `docs/` 中 README、HANDOFF、PROJECT_STATUS、TODO、PROJECT_CONTEXT、CHANGELOG 文件名是否存在，不读取正文。扫描不会写入扫描到的项目。V2.4 为跨次比较保存一份轻量基线；V2.4.1 另在当前浏览器的独立 localStorage 项中保留上次成功扫描，以便 Companion 暂时离线时显示旧数据并标记“数据可能不是最新”。缓存只在当前浏览器来源内使用，不跨设备同步。Companion 仅绑定 `127.0.0.1:4174`；API 保持只读 GET，并只允许工作台的 GitHub Pages 和 `workspace.danielxu.cn` 来源跨源读取。

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
| `src/cloud/work-logs.js` | Validated per-user work-log reads/upserts to the separate RLS-protected table |
| `src/ai/weekly-summary.js` | Weekly range, bounded evidence context, output validation, and copy formatting |
| `src/app.js` | 页面、交互、Assistant 面板和记录表单 |
| `src/version.js` | 单一页面版本来源 |
| `src/suggestions.js` | Dashboard 建议结构、安全动作列表和 Codex Task 模板 |
| `action_runner.py` | 独立 loopback Runner；生成并确认创建单个缺失文档 |
| `src/ai/config.js` | 公开 Worker 地址和模型配置，不含 API Key |
| `src/ai/service.js` | 统一 chat 接口、provider 状态与错误处理 |
| `src/ai/context.js` | 从当前页面构造裁剪后的相关上下文 |
| `src/dashboard.js` | 首页健康统计、继续建议优先级和扫描状态比较 |
| `src/project-story.js` | 五个重点项目的事实核对简介及近期提交的人话化展示文案 |
| `src/ai/providers/` | 本地 Mock Provider 与 Cloudflare Worker HTTP Provider |
| `cloudflare/` | 独立 `daniel-workspace-api` Worker、BigModel 转发和 Wrangler 配置 |
| `src/github/public-api.js` | 公开 GitHub 仓库只读 API 与响应归一化 |
| `local_companion.py` | loopback 静态服务和 `D:\_Codex project` 只读扫描 API |
| `src/store.js` | localStorage 读写与演示数据恢复 |
| `supabase/v2.6-cloud-sync.sql` | V2.6 tables, per-user RLS, grants, and updated_at triggers |
| `supabase/v3.1-b-project-pinning.sql` | Additive `workspace_projects.is_pinned` field for cross-device Home pinning |
| `supabase/migrations/20261011083802_v3_6_work_logs.sql` | Additive work-log table, index, per-user RLS, and read/insert/update grants |
| `supabase/v2.8-task-suggestions.sql` | Task description/source-key columns and idempotency index |
| `src/mock-data.js` | 初始演示数据 |
| `assets/styles.css` | 浅色/深色响应式界面 |
| `AGENTS.md` | 项目操作指引 |
| `docs/PROJECT_CONTEXT.md` | 范围、约束与设计决策 |
| `docs/HANDOFF.md` | 当前状态与恢复方式 |
| `CHANGELOG.md` | 用户可见里程碑 |

## Sync workflow

开始编辑前检查 Git 状态；工作区干净时安全同步远端。交接前检查 `.gitignore` 和暂存内容，更新必要文档，提交并推送到 GitHub `main`；GitHub Pages 从 `main` 根目录自动发布。
