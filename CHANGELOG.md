# Changelog

## Public snapshot quick update — 2026-10-16

- Hide the public snapshot status banner, rename the portfolio delivery milestone, and add the two requested tasks to the static latest snapshot fallback.
- The active EdgeOne API snapshot remains unchanged until the owner publishes these task rows from the private workspace.

## V4.7 — 2026-10-16

- Match all 26 existing projects to repository evidence, enrich private project details, and add 28 sourced historical work logs without replacing valuable manual fields.
- Surface project features, progress and document links using existing components; fold technical notes and empty sections.
- Add a reviewed, optimistic, repeatable SQL preparation tool; preserve public publication and all existing source records.

## V4.6 — 2026-10-16

- Replace public Home AI summaries with an inline Workspace AI conversation and three real-service prompts.
- Share existing chat state and request handling with the floating assistant on other pages; preserve private AI summaries, published data, same-origin API and quota enforcement.

## V4.5.3 — 2026-10-16

- Run real private/public GLM in EdgeOne Node Functions. Private daily brief and weekly summary passed signed-in UI verification with source citations.
- Remove anonymous AI's KV dependency using a user-approved isolated Postgres counter/RPC with atomic global/day/minute limits and no private business access.
- Keep visitor AI tied to the visible published snapshot revision; preserve Dashboard presentation and static snapshot fallbacks.

## V4.5.2 — 2026-10-16

- Move visitor snapshot reads to same-origin persistence with latest/previous static release fallback; preserve V4.4 Dashboard presentation and source data.
- Add direct EdgeOne-to-GLM private/public endpoints, owner authentication, server-selected public context and fail-closed anonymous quota guards. Public activation awaits free KV provider approval.
- Use JSON output and larger budgets for brief/week/next-step; reject truncation or invalid schema after one retry and preserve source verification.

## 2026-10-14 · Project Universe 2.0 视觉旗舰版

- 以深空画布和自然星团重做 26 个项目的星图，移除分类圆盘与未核实关联线；项目星球按可核实活动定尺寸，旗舰项目加强识别。
- 支持悬停项目摘要、点击聚焦与详情入口、拖拽/双指/滚轮导航、搜索和类别重排；手机详情底部弹层，遵循减少动态效果设置。

## 2026-10-14 · V4.0 Visual Command Center

- 首页移除活动趋势和项目状态图，保留真实 KPI；加入项目星系、GitHub/Codex 双热力图、7×24 开发指纹、项目活跃排行、类型 Treemap 和 30 天成果时间轴。缺失用量保持未知，成果只来自已核验工作记录或已发布版本；桌面与手机适配减少动态效果设置。

## 2026-10-13 · V3.9 Dashboard 2.0

- Dashboard 采用紧凑网格与四张 KPI，删除项目阶段图；加入 GitHub/Codex 双热力图、可交互活动趋势、状态环图、项目活跃排行榜与北京时间 24 小时分布。使用真实来源，未知历史不补零；移动端纵向排列并支持减少动态效果。
- Local Companion 增加 loopback 只读 `/api/codex-usage`，只汇总会话日志 Token 计数元数据，按北京时间将累计快照去重并折算增量；私有 Dashboard 支持 7/30/90 天和自定义日期、可信离线缓存及明确不可用字段。
- Worker 与访客快照允许发布按日 GitHub 项目/小时汇总。Codex Token 默认不发布；只有所有者勾选专门选项并主动发布时才附带最多近 90 天汇总。未修改 Supabase 原始业务数据、登录授权、GitHub 权限或访客隔离。
- 本机日志核验范围为 2026-08-19 至 2026-10-13，输入、输出、缓存字段均可用；此统计只覆盖当前设备上的可验证本地记录。
- 发布记录：`f08aa99` 已推送至 `main`；Cloudflare Worker `75392284-d55e-4c55-915f-bea194c6cc44` 部署成功，两个生产站点的 V3.9 入口和资源均返回 HTTP 200。现有访客快照未更改。

## 2026-10-12 · V3.8-C.2 一键发布访客快照

- 私人工作台提供单一「一键发布访客快照」入口：自动汇总所有项目、任务、工作记录、知识、决策、已生成简报及已核验公开仓库的活动数据，并在本次手动操作中直接发布。
- 通过固定字段白名单自动剔除路径、证据链接、私人仓库地址和常见认证值；Worker 继续验证所有者身份与完整数据，读取缺失或超时时不写入 KV。
- 访客快照 GET 改为 `no-store`，发布后访客请求直接读取最新 KV 值；私人工作台仍实时同步，访客快照仍只在手动发布时更新。
- 脱敏回归修复：Windows 绝对路径包含空格时，旧规则会遗留路径后缀；新规则覆盖完整路径，并以针对性用例验证。
- 部署与实发：提交 `cbbce19` 和路径修正 `a46b6a6` 已推送，Pages runs `38259433372`、`38261996642` 及 Worker 部署成功。所有者于 22:23 手动发布；访客入口确认 26 个项目、14 个已核验公开仓库活动、306 条近 30 天 Commit 和 1 条工作记录，详情页路径后缀已清除。

## 2026-10-12 · V3.8-C.1 访客快照预览可靠性

- 修复预览一次性核验过多 GitHub 仓库导致 Worker 子请求超限：只复用未过期、明确公开且仓库名匹配的缓存，其余仓库分成每批最多 4 个读取，并显示核验进度。
- 预览读取已同步 Supabase 工作记录与 GitHub 活动时显示阶段、进度、超时和可重试的具体错误；优先复用账号范围内完整活动缓存，只补读缺失仓库。
- 同一预览页重试时保留已成功的公开状态核验，仅重试限流、服务端错误或未返回的仓库；HTTP 404 会注明 GitHub 无法区分私有仓库、已删除仓库或名称错误。
- 任何工作记录、仓库状态或活动历史未完整核验时，预览标注缺失范围并锁定发布。预览不写 Supabase 或访客 KV，所有者确认发布流程保持独立。

## 2026-10-12 · V3.8-B.1 GitHub 活动覆盖与热力图

- GitHub 活动改为读取授权仓库的所有分支，并跟随分支清单和每条分支 Commit 历史的 `Link` 分页；按仓库与完整 SHA 去重。错误明细区分 App 授权清单、仓库 404、分支列表、分支历史、分页上限和 API 限流；App 范围外 404 明确标为私有/已删除/名称不匹配的歧义项。
- 客户端按每批 4 个仓库调用 Worker，避免一次覆盖 26 个仓库时触发 Cloudflare 单次调用子请求上限；刷新时只重试同一页面会话中被限流的仓库并保留已读结果；未知读取错误显示脱敏诊断。
- 项目无仓库或 GitHub URL 无效时单独列出，不纳入仓库覆盖分母。热力图改为自适应日期网格，标出月份、星期并支持悬停/点击，热力图与趋势图共用每日数据；不完整日期保持未知状态。
- 定向测试覆盖全部分支、分支和 Commit 分页、SHA 去重、错误原因与未关联项目统计；真实覆盖率和设备验收结果在 HANDOFF 记录。

## 2026-10-12 · GitHub 活动历史完整性修复

- GitHub App 安装和授权仓库清单、仓库提交历史均跟随 REST `Link` 分页；提交明确从仓库默认分支读取，并在仓库内按完整 SHA 去重。
- 将每仓库活动读取上限提高至 100 页；限流时遵守短 `Retry-After`/重置窗口，无法安全重试时记录等待建议。分页上限、鉴权清单、网络及单仓库读取失败均保留具体仓库和原因。
- 仅缓存覆盖完整关联仓库集合且无失败的 GitHub 活动结果，缓存时间缩至 15 分钟；不修改 Supabase 数据、RLS 或 GitHub App 授权范围。

## 2026-10-12 · V3.8-C 完整工作台公开快照

- 访客与登录态复用完整工作台组件；访客通过独立 KV 的审核快照浏览 Dashboard、项目、任务、工作记录、知识资料与决策，所有访客动作只读。
- 移除旧的五项目静态访客首页及 `/api/public/dashboard` 活动接口。公开根路由立即挂载共享工作台，后台读取快照，不等待 Auth 或快照网络请求；空快照显示明确空状态。
- 增加私人账号专用的逐条预览/发布流程：字段白名单、脱敏提示、关联项目约束、默认全不选、最终范围复核；Worker 再次校验唯一所有者、快照 schema、敏感值与公开 GitHub 仓库。
- 新增隔离的 `PUBLIC_WORKSPACE_SNAPSHOTS` KV；不修改 Supabase 表、RLS、同步机制。此版本部署不发布项目内容，快照须由所有者登录并明确审核发布。

## 2026-10-12 · V3.8-A 公开只读 Dashboard

- 默认入口无需登录即可查看公开只读项目指挥中心；登录页改为右上角低调入口，访客模式复用 Dashboard 布局，旧 TK-1001 模拟页只通过 `?mode=demo` 显式进入。
- 新增 Worker `/api/public/dashboard` 固定仓库白名单接口，仅在确认仓库公开后读取 GitHub 活动并返回 30 天每日计数；不访问 Supabase 工作区表，不返回 Commit 原文、SHA、工作记录或私有仓库清单。
- 增加公开项目详情和入口白名单，FlowOps 明确标识为虚构数据模拟；未公开状态、阶段、任务及工作记录不展示。登录认证、同步、数据库行和 AI 行为未改变。

## 2026-10-12 · V3.8-A.1 启动与登录切换修复

- 根网址始终立即进入公开 Dashboard，不检查或恢复浏览器保存的 Supabase 会话；用户主动点击「登录」后才验证已有会话，有效会话直接进入私人工作台。
- 页面入口增加静态骨架屏和公开模块加载失败兜底；退出或意外失效的会话回到公开根网址，避免登录恢复与私人模块重复进入。
- 仅调整启动路由与认证切换，不改 Dashboard、Supabase 数据、数据库结构或 RLS。

## 2026-10-12 · V3.8 Project Control Dashboard

- Home 改为项目指挥中心，增加四项真实云端 KPI、日期可筛选的 GitHub/Workspace 活动热力图与趋势、项目状态环形图和基于已保存阶段字段的分布图。
- GitHub Worker 新增受 Workspace 会话保护的历史活动读取，按仓库分页并在服务端以仓库 + SHA 去重；工作记录统计仅读取最小字段，两种来源保持分开。
- 增加数据缺口标记、自定义日期、重点项目紧凑卡片和真实任务计数；AI 总结保持默认折叠。没有新增数据库迁移或修改现有项目、任务、工作记录。

## 2026-10-12 · V3.7-F Home 项目管理化

- Home 增加可跳转的真实云端项目/任务统计；统一置顶项目卡片改为展示已填写阶段、下一步与真实关联任务完成数。
- 恢复浅灰页面和白色卡片，项目介绍、提交记录和工作记录继续留在详情页；AI 总结保持默认折叠。
- 不修改数据库、同步、登录、其他页面、访客权限或 AI 服务。

## 2026-10-12 · V3.7-E Home 首页最终版

- Home 更新为「我的工作台」与克制的一句话介绍，优先将 Daniel Workspace 放入主卡，其他置顶项目按 2×2 桌面网格展示，手机端纵向排列。
- 移除 Home 最近进展区块但保留项目详情中的开发记录；项目卡仅展示名称、用途、状态和有效入口，AI 总结继续默认折叠。
- 仅调整首页前端、响应式样式与静态资源缓存版本；不改 26 个项目资料、Supabase、GitHub、Worker、登录或同步行为。

## 2026-10-12 · V3.7-D 项目作品化展示

- Home 与 Projects 卡片新增清晰的详情和线上体验入口；没有有效已登记网站地址的项目不显示体验按钮。
- 项目详情先展示用途、核心功能、可核对成果和最多三条近期 GitHub/工作记录；本机路径、仓库和提交技术信息保留在折叠区。
- 访客首页改为精选公开作品展示，并保留标注为虚构数据的 TK-1001 流程演示；访客仍跳过 Auth 初始化，不读取私人工作台或浏览器存储。

## 2026-10-12 · V3.7-C 项目介绍与近期进展人话化

- 首页与项目详情对五个重点项目展示经过 README、功能代码和交接记录核对的一句话简介；保留项目原始云端资料，允许逐项手工编辑。
- 最近进展从置顶项目的近期 GitHub 提交和用户工作记录中筛选最多五条；提交成果改写为简洁中文，并保留原始 GitHub 提交链接。未经核实的英文提交标题不会冒充成果。
- 展示文案不会在打开页面时调用 AI；工作记录只使用现有按用户隔离的只读读取路径，不改变同步、授权或数据库资料。

## 2026-10-11 · V3.7 全站 UI 减法

- 首页聚焦重点项目、最近进展和有内容时的待办；删除统计卡、重复引导、置顶规则和常驻本机状态说明。
- AI 建议、今日简报和每周总结合并到默认折叠的「AI 总结」；同一提交只呈现一条最近进展。
- Projects 默认显示云端项目，本机扫描改为单独视图；项目详情的技术信息默认折叠，工作记录改为按需展开且只要求填写完成事项。
- 空的 Tasks、Knowledge、Decisions 页面精简为提示和新增操作；Knowledge 与 Decisions 移至「更多」，GitHub 刷新收敛为一个入口。
- 本次仅调整前端呈现和页面状态；不修改数据库、Supabase/GitHub/AI 服务调用链。

## 2026-10-11 · V3.6 工作记录与 AI 周总结

- 项目详情新增可跨设备同步的工作记录，包含日期、完成事项、成果、下一步和证据链接；数据写入独立 `workspace_work_logs` 表，由当前账号的 RLS 隔离。
- 首页 AI 今日简报结合经核验的真实 GitHub 提交、项目状态和近 7 天工作记录，给出可验证的行动建议；AI 不接收证据链接地址，Worker 故障时不会改用 Mock。
- 新增按需每周总结，汇总本周成果、项目推进、问题和下周计划，可复制；只保留能匹配记录或提交证据的输出。
- 线上数据库迁移只新建表、索引和权限策略；只读复核确认原有 26 个项目及 5 个置顶项目未变，未写入或删除任何业务行。

## 2026-10-11 · V3.5-B.4 将公开 GitHub 读取统一到 Worker

- 公开仓库刷新改由登录后的 Workspace 调用 Cloudflare Worker，再由 Worker 使用 GitHub App installation token 读取；不再让手机或电脑浏览器直连 GitHub REST API。
- 当安装令牌无法读取某个公开仓库时，Worker 会回退到自身的公开 API 读取；先校验仓库为公开仓库，错误返回脱敏上游 HTTP 状态。
- 保留浏览器快照失败回退、私有 GitHub App 授权和本地 Companion；不修改 Supabase。

## 2026-10-11 · V3.5-B.3 改用 GitHub App 安装令牌读取私有仓库

- 移除 GitHub 用户 OAuth 跳转、回调和 KV 安装映射依赖；Workspace 只允许指定的 Supabase 用户请求私有仓库 API。
- Worker 使用 App 私钥在服务端签发短期 installation token，并在服务端校验仓库授权后读取元数据和最新提交；私钥与令牌不发往浏览器。
- 补齐 GitHub REST `User-Agent`，并在失败时展示脱敏的上游 HTTP 状态与错误说明。线上登录态已读取 3 个授权仓库及最新提交。

## 2026-10-11 · V3.5-B.2 修复 OAuth 成功回跳后的 KV 传播延迟

- OAuth 回跳后，客户端会自动重试私有仓库列表和快照读取，处理 Cloudflare KV 对先前“不存在”结果的短期负缓存；Projects 显示授权确认状态，避免用户重复启动 OAuth。
- 请求继续使用 Supabase Bearer 会话并省略 Cookie；OAuth 回调继续以签名 state 识别 Workspace 用户。定向测试覆盖暂时性 KV 未连接响应和登录/上游错误不重试。

## 2026-10-11 · V3.5-B.1 修复已安装 GitHub App 的连接回跳

- Workspace 现在先启动 GitHub OAuth 身份核验，Worker 从该用户可访问的安装中绑定现有 App，避免已安装时只落在 GitHub 安装管理页。
- 尚未安装的账号仍会进入原安装流程；Worker 对安装与仓库范围更新都继续验证签名 state、Supabase 用户和 GitHub 安装归属。
- OAuth 完成后返回 Workspace 原页面并刷新授权仓库；多安装情形显式提示，不自动绑定错误账号。私有仓库读取回归测试通过，线上实际读取待完成用户 OAuth。

## 2026-10-11 · V3.5-B GitHub App 私有仓库云端同步

- 为现有 Cloudflare Worker 增加 GitHub App 安装授权回调、一次性签名 state、Supabase 身份验证、用户隔离安装映射和仅 Contents/Metadata 读取的短期 installation token 流程。
- 增加授权仓库列表与快照 API；首页卡片显示最近提交、提交时间、默认分支和近 7 天数量，AI 今日简报可采用已授权私有仓库的提交依据。
- 私有快照只写入当前设备浏览器缓存，不进入现有 Supabase 云同步；公开 GitHub、Companion 和离线缓存路径保留。
- 已创建 Cloudflare KV namespace 并在 Worker 生成一次性 state 密钥；GitHub App 注册与其余 Worker Secrets 仍需账户所有者完成后才能启用私有仓库授权。

## 2026-10-11 · V3.5-A.1 修复线上 Companion 接入

- 线上 `workspace.danielxu.cn` 未配置 Companion 扫描端点，且 Companion CORS 未允许该来源；现将精确域名加入前端路由与只读 API 来源白名单。
- 首页存在已关联的本机 Git 数据时，隐藏无缓存的 GitHub“暂不可读”占位，突出 Companion 的 commit 与状态。
- 本机预检从 HTTP 403 修复为 204，定向扫描 GET 返回 200；未改 Supabase 或同步机制。

## 2026-10-11 · V3.5-A 接入本机项目开发进展

- 首页置顶项目卡片在名称、GitHub 远端或本机路径关联成功时显示 Companion 提供的最近 Commit 摘要、时间、分支和未提交修改状态，并标注来源与扫描时间。
- AI 今日简报仅接收 Companion 的分支、提交时间、工作区状态及扫描时间元数据；私有 Commit 摘要、代码、本机路径和仓库 URL 不进入 AI 请求。Companion 离线时继续使用现有云端与公开 GitHub 资料。
- 未修改 Supabase 数据、云同步字段、RLS 或写入机制；未增加 Companion 接口。

## 2026-10-11 · V3.3.2 修复无关联任务时 AI 建议被拦截

- 生成门槛改为项目简介和已验证的 GitHub 最近 Commit 摘要/时间；关联任务只作补充，无任务不再被判成资料不足。
- 收紧 GLM 提示词，要求建议说明操作场景、具体动作和可观察的验收结果，并直接承接真实 Commit；无任务时不得建议先补任务。
- Worker 失败时保留实际错误消息、错误码和 HTTP 状态，避免覆盖为通用提示。
- 13 项定向测试通过；通过现有 `/api/chat` 实际调用 `glm-4-flash-250414`，零任务上下文返回并成功解析有提交依据的建议。未访问或修改 Supabase。

## 2026-10-11 · V3.3.1 修复 AI 下一步遗漏 GitHub 最近提交

- 修正 GitHub 快照校验：快照的 Commit SHA 显示为 7 位，但 Commit URL 使用完整 SHA；现在校验完整 URL SHA 以快照短 SHA 开头，避免有效提交被过滤。
- 建议上下文明确传入项目简介、最近 Commit 摘要和提交时间、优先级排序后的关联任务；缺少任一来源时报告具体缺项并停止生成。
- 强化 GLM 指令：下一步须接续最近提交涉及的功能，给出可检查的具体动作和事实依据；拒绝“创建一个任务”等泛化话术及虚构完成/发布状态。
- 通过模拟上游的 HTTP 集成测试确认 Worker 发往 GLM 的模型请求包含完整资料；未触碰页面布局、数据库或同步机制。

## 2026-10-11 · V3.3 Step 2-D.1 项目 AI 建议下一步

- 项目详情可用现有智谱 GLM Worker，根据项目简介、可验证的公开 GitHub 最近提交和已有任务生成一条可执行建议及简短依据。
- 支持重新生成和手动编辑；草稿留在当前页面，只有点击采纳后才更新既有 `project.next` 并通过现有同步队列写入 Supabase。
- 来源缺失、GitHub 快照过期或模型不可用时明确提示；不使用本地 Mock、不推断未记录的进度，不新增字段或修改同步机制。
- 定向测试覆盖上下文边界、资料缺失、响应解析及仅采纳后持久化。

## 2026-10-10 · V3.2 Step 2-C.1 首页项目卡片精简

- 项目阶段、下一步和任务完成信息仅在有真实数据时显示；不再展示“未填写”占位内容。
- 强调最近一次公开 GitHub 提交的摘要、时间和 Commit 链接；近 7 天提交数作为辅助信息。
- 将私有/本地仓库与读取失败状态压缩为简短提示，并收紧桌面和手机卡片间距。
- 保留项目状态、GitHub/网站快捷入口和置顶操作；未修改 Supabase 数据、同步机制或项目状态。

## 2026-10-10 · V3.2 Step 2-C 首页 GitHub 开发动态

- 首页置顶项目自动读取公开仓库的最近 commit、提交时间和最近 7 天提交数；支持卡片查看 Commit 和手动刷新。
- GitHub 快照只存于设备本地，自动读取缓存 1 小时；失败时保留上次数据，不阻塞 Supabase 同步或首页。
- 私有、无法公开访问和仅本地项目标明暂不可读取；没有使用 GitHub Token，也不根据提交数计算完成百分比或修改项目状态。
- 增加公开 API、提交分页、七天统计、私有仓库和 1 小时缓存边界回归测试。

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
- 新增定向回归测试；
pm test` 通过 11/11，`git diff --check` 通过。数据库检查、备份和线上部署状态随后记录在 HANDOFF。

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

## 2026-10-11 · V3.4 Step 1

- 首页新增按需生成的 AI 今日简报，调用现有真实 GLM Worker，按三部分呈现置顶项目的提交进展、具体建议和关注项；每项要求关联项目并给出资料依据。资料不足或 GLM 失败时明确提示，不使用 Mock，也不写入项目或任务。
## 2026-10-11 · V3.4.1 简报质量优化

- 公开 GitHub 快照额外保留最多 20 条近 7 天提交供首页分析；将过去 24 小时与 1–7 天提交分开传给 GLM，超过 7 天的提交不进入简报上下文。
- 简报提示词要求具体开发行动、可观察验收结果和逐字提交依据；过滤空泛旧 next_step、没有近期提交依据或照搬创建任务的建议。
- 定向测试覆盖时间分层、旧提交排除、依据校验和空泛建议过滤；未修改 Supabase。
## 2026-10-11 · V3.4.2 AI 简报超时修复

- 简报请求取消重复传递项目 JSON，限制每项目近 24 小时最多 3 条、1–7 天最多 2 条提交；GLM 输出限制为 900 tokens。
- 简报 Worker 单次等待调整为 25 秒，并在上游响应体读取超时时最多安全重试一次；前端 60 秒计时覆盖完整响应体读取，错误显示具体原因。
- 定向调用链测试覆盖超时重试、响应体等待和非简报 token 设置未变。

## 2026-10-16 · Project Universe Final

- 将 Home 星系图重做为单一引力场：冷色星云、星尘、分层光核与错峰呼吸。
- 移除分类控件与分类区域，五个重点项目常显名称，玻璃浮层仅保留项目简介及已填状态。
- 149 项测试通过；隔离浏览器验证真实公开快照 26 节点、5 重点、0 分类分区，390px 无横向溢出。

## 2026-10-16 · V4.1 Final Layout

- GitHub 热力图与 Project Universe 改为 1:1 双卡片，手机端纵向排列；移除首页 Token 展示，保留采集。
- 小画布重新构图，真实项目占中央约 67% 宽度，默认只显示两个旗舰标签；精简提示，点击直达项目详情。
- 隔离浏览器桌面及 390px 各验证全部 26 个公开项目跳转；150 项自动测试通过。

## 2026-10-16 · V4.2 Final Dashboard

- 删除首页 Treemap 与旧开发时间指纹，保留业务字段及现有 Token 采集；形成最终五层模块顺序。
- 星系五个常驻名称避让，排行榜改为粗条 Top 5，加入仅由本地时间驱动的 24 小时节奏视觉。
- 成果时间线最多六项，默认仅日期、项目、短标题，点击展开详情与安全证据链接。
- 只对明确 error 状态显示同步失败。只读日志仍发现 Projects/Tasks 各一次 401，因此保留真实错误与重试，不更改认证或同步机制。
- 155 项测试通过；隔离桌面与 390px 标签均无碰撞越界、手机 26 个星球实体点击跳转通过。

## 2026-10-16 · V4.3 Final Delivery Edition

- 移除时钟、计时器及其样式，Top 5 改为紧凑整行布局。
- 产品交付时间轴采用八个经核验的跨项目节点，按日期排列、同日不推断先后；小程序正式上线日按所有者确认记为 2026-09-29。
- 增加独立固定公开成果快照与脱敏核验摘录；私人本机确认项不进入 Supabase 或访客发布载荷。
- 手机横向时间轴保留点击前滚动位置，详情、演示与证据按需展开。158 项测试通过；七个在线体验网址均返回 200。


## V4.4 · 2026-10-16

- Compact vertical Top 5 with aligned names, normalized split-source bars and counts.
- Ten verified cross-project deliveries on a proportional 30-day axis; same-day stacking, concise status/details, and owner-only review candidates.
- Remove the mini-program from Home milestones only; preserve its historical evidence and project records.
- Verified 160 tests and isolated desktop/390px preview; no auth, sync or business-data changes.

## 2026-10-16 · V4.4.1

- 产品交付改为等距连续横向轴，同日成果独立相邻，日期与成果内容不变；桌面约 5–6 项、手机约 1–2 项横向滚动。保留详情、链接及审核机制。

## 2026-10-16 · V4.5

- Replace all-repository publication prechecks with a v2 static projection of already loaded project presentation and activity counts. Authenticate the owner server-side; strip private originals and repository fields without external verification calls.
- Keep one complete KV snapshot for all visitor views, including reviewed deliveries and project showcase details. Partial activity no longer blocks safe projects; failed writes retain the last successful snapshot.
- Preserve v1 GET compatibility; old publishing clients must refresh.

- V4.5.1: 发布时图表模型尚未就绪，则即时复用现有账号本机活动缓存与已加载工作记录计数；不添加外部读取或阻塞等待。
# V4.8 · 2026-10-16

- Replace unavailable KV publication with approved isolated immutable snapshot versions and atomic activation in existing Supabase; serve through EdgeOne same-origin Node Functions.
- Confirm publication by public version readback; report stage, duration, HTTP status and actionable failure instead of a raw timeout.
- Publish only exact-reviewed Knowledge and user-authored Decisions alongside the existing project details, charts, Universe, Top 5 and milestones.
