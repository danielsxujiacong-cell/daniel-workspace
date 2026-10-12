const pages = [
  ["home", "Home", "⌂"],
  ["projects", "Projects", "▧"],
  ["tasks", "Tasks", "✓"],
  ["knowledge", "Knowledge", "▤"],
  ["decisions", "Decisions", "◇"],
];

const showcaseProjects = [
  {
    id: "project-hub",
    name: "Daniel Project Hub",
    type: "产品与作品导航",
    summary: "把 AI 产品、网站和实验作品放在一个免登录的作品入口中。",
    purpose: "让访客能快速了解不同项目，并直接打开可体验的网站。",
    features: ["按类别浏览 AI 产品、网站和实验作品。", "从作品目录进入 FlowOps 交互流程演示。"],
    outcomes: ["作品导航站已发布。", "FlowOps 的交互回放覆盖正常批准、拒绝和重复事件。"],
    websiteUrl: "https://hub.danielxu.cn/",
  },
  {
    id: "flowops",
    name: "FlowOps AI",
    type: "采购流程交互演示",
    summary: "把采购申请、审批、工单和后续分析串成一段可以操作的流程回放。",
    purpose: "用可视化流程展示自动化步骤如何传递数据与处理异常。",
    features: ["逐步回放正常批准、审批拒绝和重复事件。", "按需展开处理细节，并在手机上保持主流程清晰。"],
    outcomes: ["重复事件会匹配既有工单，不重复创建或通知。", "演示使用明确标注的虚构数据，不连接真实业务系统。"],
    websiteUrl: "https://hub.danielxu.cn/flowops",
    simulated: true,
  },
  {
    id: "personal-portfolio",
    name: "Daniel Xu 个人作品集",
    type: "个人网站",
    summary: "用滚动交互和 3D 场景介绍个人作品与持续探索的方向。",
    purpose: "让访客通过一页式叙事了解作品和设计开发实践。",
    features: ["通过滚动交互切换页面章节。", "以 3D 场景呈现作品集视觉主题。"],
    outcomes: ["个人作品集网站已发布。", "页脚已补充版权信息。"],
    websiteUrl: "https://danielxu.cn/",
  },
];

const projects = [
  { id: "northstar", name: "北辰智能制造运营平台", type: "数字化转型", status: "执行中", owner: "林嘉", due: "11 月 18 日", progress: 72, summary: "打通华东三座工厂的排产、设备与质量数据，先完成苏州试点。", health: "进度正常" },
  { id: "supply", name: "云桥供应链协同", type: "供应链", status: "执行中", owner: "周启明", due: "12 月 06 日", progress: 48, summary: "为核心供应商建立交期协同与异常预警机制。", health: "需关注" },
  { id: "crm", name: "Aurora 客户运营升级", type: "客户运营", status: "计划中", owner: "陈可", due: "12 月 20 日", progress: 24, summary: "统一客户分层、续约信号和一线跟进记录。", health: "按计划" },
  { id: "data", name: "统一数据治理一期", type: "数据平台", status: "执行中", owner: "许安", due: "01 月 12 日", progress: 61, summary: "建立经营指标口径、数据责任人和质量巡检流程。", health: "进度正常" },
];

const initialTasks = [
  { id: "TK-1001", title: "供应商交期异常升级处理", project: "supply", owner: "周启明", due: "今天", priority: "高", status: "待开始", description: "核心物料预计延误 6 个工作日，可能影响苏州试点第 3 周排产。", delayDays: 6, keyMaterial: true, projectImpact: true },
  { title: "确认苏州工厂试点排产口径", project: "northstar", owner: "林嘉", due: "今天", priority: "高", status: "进行中", description: "和生产、计划团队敲定冻结窗口及插单规则。" },
  { title: "完成供应商交期异常流程评审", project: "supply", owner: "周启明", due: "10 月 12 日", priority: "高", status: "待开始", description: "明确预警阈值、升级角色与反馈时限。" },
  { title: "整理客户续约风险字段", project: "crm", owner: "陈可", due: "10 月 14 日", priority: "中", status: "待开始", description: "与销售运营确认字段定义和更新频率。" },
  { title: "发布经营指标词典 v1", project: "data", owner: "许安", due: "10 月 16 日", priority: "中", status: "进行中", description: "补齐收入、毛利与交付准时率的计算口径。" },
  { title: "收集设备告警样例", project: "northstar", owner: "王晨", due: "10 月 09 日", priority: "低", status: "已完成", description: "已汇总 30 天内的停机与维护告警。" },
  { title: "梳理供应商主数据责任人", project: "supply", owner: "赵宁", due: "10 月 08 日", priority: "低", status: "已完成", description: "核心物料对应责任人已确认。" },
];

const knowledge = [
  { id: "sop-supplier-exception", title: "SOP：供应商交期异常升级处置", category: "标准作业程序", owner: "供应链运营组", updated: "10 月 09 日", summary: "适用于关键物料延误 3 个工作日以上的情况。先核实承诺日期与在途数量，再按影响等级在 2 小时内通知采购、计划和值班经理；优先评估拆分加急、备选供应或排程调整，并记录最终方案。" },
  { title: "苏州试点：排产冻结窗口共识", category: "运营规范", owner: "林嘉", updated: "10 月 08 日", summary: "每日 16:00 冻结次日计划；紧急插单由值班经理与计划负责人共同确认。" },
  { title: "供应商交期风险分级说明", category: "流程说明", owner: "周启明", updated: "10 月 07 日", summary: "按影响产线与延误时长分级，并为关键物料设置双周滚动检查。" },
  { title: "经营指标口径：准时交付率", category: "指标口径", owner: "许安", updated: "10 月 06 日", summary: "以承诺交期为基准，按订单行统计；延期变更需保留原承诺日期。" },
  { title: "客户续约信号访谈摘录", category: "调研记录", owner: "陈可", updated: "10 月 03 日", summary: "实施活跃度下降和关键联系人变更，是客户经理优先跟进的信号。" },
];

const initialDecisions = [
  { title: "苏州工厂作为首批试点", date: "10 月 08 日", owner: "运营委员会", status: "已确认", reason: "先验证跨班次数据完整度与排产流程，再复制到其他工厂。", impact: "试点范围限定在总装与机加两条产线。" },
  { title: "交期预警提前 5 个工作日", date: "10 月 06 日", owner: "供应链例会", status: "已确认", reason: "给采购与计划团队留出替代料和排程调整时间。", impact: "关键物料首期启用，阈值按供应商等级微调。" },
  { title: "客户分层首期采用三档模型", date: "10 月 02 日", owner: "客户运营组", status: "待复核", reason: "先用合同规模、续约时间和产品使用度做轻量分层。", impact: "复核后再决定是否引入服务成本维度。" },
];

const tour = [
  { page: "home", title: "Home · 作品与演示", text: "首页展示已发布作品和可直接体验的入口；TK-1001 是独立的虚构流程案例。" },
  { page: "projects", title: "Projects · 精选项目", text: "浏览项目用途、核心功能和可核对的成果，再打开对应的线上作品。" },
  { page: "tasks", title: "Tasks · 流程体验", text: "TK-1001 展示一条虚构供应链异常如何经过规则、SOP、方案和完成状态。" },
  { page: "knowledge", title: "Knowledge · 模拟资料", text: "这里的 SOP、指标口径和访谈条目均为演示样例，不代表真实客户或企业记录。" },
  { page: "decisions", title: "Decisions · 模拟决策", text: "查看 TK-1001 流程里临时生成的模拟决策；这些内容只存在于当前访客页面内存。" },
];

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const projectById = (id) => projects.find((project) => project.id === id);
const pageLabels = Object.fromEntries(pages.map(([id, label]) => [id, label]));

function renderHome() {
  return `<section class="card guest-home-hero" aria-labelledby="guest-home-title">
      <div class="guest-home-message">
        <div class="guest-home-kicker"><span class="guest-demo-dot"></span><span>Daniel Xu · 精选作品</span><span class="guest-home-kicker-label">公开展示</span></div>
        <h1 id="guest-home-title">把想法做成可体验的产品</h1>
        <p>这里展示从产品梳理、交互设计到网站发布的实践。可以先看精选项目，再打开已发布的演示网站。</p>
        <div class="guest-home-values"><span>AI 产品</span><span>自动化流程</span><span>交互网站</span></div>
        <div class="guest-home-disclaimer"><strong>隐私说明</strong> 访客页只使用本模块内的公开作品摘要和独立模拟数据，不读取私人工作台、账号资料或本机项目。</div>
      </div>
      <aside class="guest-home-ticket" aria-label="TK-1001 虚构流程演示">
        <div class="guest-home-ticket-top"><span class="eyebrow">虚构流程演示</span><span>TK-1001</span></div>
        <h2>供应商交期异常</h2>
        <p>通过一条模拟工单体验规则判断、SOP、处置方案和状态闭环。</p>
        <div class="guest-home-rule"><span>固定规则判定</span><strong>P1 · 高优先级</strong></div>
        <button class="button primary" data-guest-action="view-ticket"><span>体验流程演示</span><span aria-hidden="true">→</span></button>
        <small>仅使用虚构数据，不连接真实业务系统</small>
      </aside>
    </section>
    <section class="guest-featured-section" aria-labelledby="guest-featured-title"><div class="guest-section-heading"><div><h2 id="guest-featured-title">精选项目</h2><p>项目用途、已验证成果与直接体验入口</p></div><button class="text-button" data-guest-page="projects">查看全部项目 →</button></div><div class="guest-card-grid">${showcaseProjects.map((project) => renderShowcaseCard(project, true)).join("")}</div></section>
    <section class="card guest-process-card" aria-labelledby="guest-process-title">
      <div class="guest-process-heading"><div><h2 id="guest-process-title">流程演示：一张工单，走完五步</h2><p>用虚构 TK-1001 展示异常处理闭环</p></div><span>固定规则 · 模拟数据</span></div>
      <ol class="guest-process-flow" aria-label="异常发现、规则判断、SOP、决策、完成">
        <li><span class="guest-process-index">01</span><strong>异常发现</strong><small>关键物料延误</small></li>
        <li><span class="guest-process-index">02</span><strong>规则判断</strong><small>固定条件判为 P1</small></li>
        <li><span class="guest-process-index">03</span><strong>SOP</strong><small>按流程核实与升级</small></li>
        <li><span class="guest-process-index">04</span><strong>决策</strong><small>选择处置方案</small></li>
        <li><span class="guest-process-index">05</span><strong>完成</strong><small>更新工单状态</small></li>
      </ol>
    </section>
    <div class="guest-demo-note" role="note">TK-1001 的建议、决策和完成状态只保存在本次访客页面内存；它们不会写入私人账号、云端资料或本机服务。</div>`;
}

function priorityKey(priority) { return ({ "高": "high", "中": "medium", "低": "low" })[priority] || "low"; }

function renderShowcaseCard(project, compact = false) {
  return `<article class="card guest-project-card ${compact ? "guest-project-card-compact" : ""}"><div class="guest-project-row-head"><span class="guest-project-type">${escapeHtml(project.type)}</span><span class="guest-pill good">已发布</span></div><h2>${escapeHtml(project.name)}</h2><p>${escapeHtml(project.summary)}</p><div class="guest-showcase-outcome"><small>已验证成果</small><span>${escapeHtml(project.outcomes[0])}</span></div><div class="guest-showcase-actions"><button class="button quiet small" data-guest-action="view-project" data-project-id="${escapeHtml(project.id)}">查看详情</button>${project.websiteUrl ? `<a class="button quiet small" href="${escapeHtml(project.websiteUrl)}" target="_blank" rel="noopener noreferrer">体验网站 ↗</a>` : ""}</div></article>`;
}

function renderShowcaseDetail(project) {
  if (!project) return "";
  const renderList = (items) => `<ul class="guest-showcase-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
  return `<section class="card guest-showcase-detail"><button class="text-button" data-guest-action="back-projects">← 返回精选项目</button><div class="guest-project-type">${escapeHtml(project.type)}</div><h2>${escapeHtml(project.name)}</h2><p>${escapeHtml(project.purpose)}</p><div class="guest-showcase-detail-grid"><div><h3>核心功能</h3>${renderList(project.features)}</div><div><h3>已验证成果</h3>${renderList(project.outcomes)}</div></div>${project.simulated ? '<div class="guest-demo-note" role="note">演示中的工单、企业名称和处理数据均为虚构样例，不代表真实客户或生产环境。</div>' : ""}<div class="guest-showcase-actions"><a class="button primary small" href="${escapeHtml(project.websiteUrl)}" target="_blank" rel="noopener noreferrer">体验网站 ↗</a></div></section>`;
}

function renderProjects(selectedProjectId = "") {
  const selected = showcaseProjects.find((project) => project.id === selectedProjectId);
  return `<div class="page-heading"><div><div class="eyebrow">个人作品 · 公开资料</div><h1>精选项目</h1><p>查看项目用途、已验证成果和线上体验入口。</p></div><span class="guest-count">${showcaseProjects.length} 个作品</span></div><div class="guest-demo-note" role="note">此列表只包含公开作品摘要；没有私人工作台记录、代码仓库内容或本机路径。</div>${renderShowcaseDetail(selected)}<div class="guest-card-grid">${showcaseProjects.map((project) => renderShowcaseCard(project)).join("")}</div>`;
}

const ticketSolutions = [
  { id: "expedite-split", title: "拆分批次并加急首批到货", impact: "关键物料先行到厂，保留试点排产；产生加急物流成本。" },
  { id: "alternate-supplier", title: "启用已认证备选供应商", impact: "降低单一供应商风险；采购需核对批次一致性与价格。" },
  { id: "adjust-schedule", title: "调整试点排程并保护关键工序", impact: "避免停线；试点验证节点可能顺延 2 个工作日。" },
];

function getTicketPriorityRule(ticket) {
  if (ticket.delayDays >= 5 && ticket.keyMaterial && ticket.projectImpact) {
    return { level: "P1 · 高优先级", response: "2 小时内启动跨部门协调", reason: `关键物料预计延误 ${ticket.delayDays} 个工作日，且影响苏州试点排产。` };
  }
  if (ticket.delayDays >= 3 || ticket.projectImpact) {
    return { level: "P2 · 需优先处理", response: "当日完成影响评估", reason: "延误或项目影响达到升级条件。" };
  }
  return { level: "P3 · 常规跟进", response: "按日常节奏更新", reason: "当前未命中高优先级升级条件。" };
}

function renderTicketDetail(ticket, selectedSolution, ticketDecision, sopViewed) {
  const rule = getTicketPriorityRule(ticket);
  const completed = ticket.status === "已完成";
  const selected = ticketSolutions.find((solution) => solution.id === selectedSolution);
  return `<section class="card guest-ticket-panel" aria-labelledby="ticket-detail-title"><div class="guest-ticket-heading"><div><div class="eyebrow">工单详情 · 当前访客会话</div><h2 id="ticket-detail-title">TK-1001 · ${escapeHtml(ticket.title)}</h2></div><span class="guest-pill ${completed ? "good" : "watch"}">${escapeHtml(ticket.status)}</span></div>
    <div class="guest-ticket-meta"><span>${escapeHtml(projectById(ticket.project)?.name || "")}</span><span>负责人 ${escapeHtml(ticket.owner)}</span><span>预计延误 ${ticket.delayDays} 个工作日</span></div>
    <div class="guest-rule-card"><div class="guest-rule-top"><strong>规则优先级建议</strong><span class="guest-priority priority-high">${escapeHtml(rule.level)}</span></div><p>${escapeHtml(rule.reason)}</p><small>${escapeHtml(rule.response)} · 依据：延误天数、关键物料与项目影响三项模拟字段</small></div>
    <div class="guest-ticket-workflow"><div class="guest-ticket-section-head"><div><span class="eyebrow">关联 Knowledge SOP</span><h3>SOP：供应商交期异常升级处置</h3></div><button class="button small" data-guest-action="open-sop">查看 SOP</button></div><p>核实承诺日期、按影响等级升级，并比较加急拆分、备选供应和排程调整方案。</p></div>
    <fieldset class="guest-ticket-options"${ticketDecision || !sopViewed ? " disabled" : ""}><legend>选择处置方案</legend>${!sopViewed ? '<p class="guest-selection-note">先打开并查看关联 SOP，再选择处置方案。</p>' : ""}${ticketSolutions.map((solution) => `<label class="guest-solution-option"><input type="radio" name="guest-ticket-solution" value="${solution.id}"${selectedSolution === solution.id ? " checked" : ""}><span><strong>${escapeHtml(solution.title)}</strong><small>${escapeHtml(solution.impact)}</small></span></label>`).join("")}</fieldset>
    ${ticketDecision ? `<div class="guest-ticket-result" role="status"><strong>已生成模拟 Decision</strong><p>${escapeHtml(ticketDecision.final)}</p><small>关联 TK-1001 · 仅此访客会话可见</small></div>` : ""}
    ${completed ? '<div class="guest-ticket-result complete" role="status"><strong>工单已完成</strong><p>Home 待完成任务与本周完成数已同步更新。</p></div>' : ticketDecision ? '<button class="button primary" data-guest-action="complete-ticket">完成工单</button>' : `<button class="button primary" data-guest-action="generate-decision"${selected && sopViewed ? "" : " disabled"}>生成模拟 Decision</button>`}
    ${selected && !ticketDecision ? `<p class="guest-selection-note">将记录所选方案：「${escapeHtml(selected.title)}」。</p>` : ""}</section>`;
}

function renderTasks(filter, taskList, selectedTaskId, selectedSolution, ticketDecision, sopViewed) {
  const filters = [["all", "全部"], ["open", "未完成"], ["done", "已完成"]];
  const visible = taskList.filter((task) => filter === "all" || (filter === "done" ? task.status === "已完成" : task.status !== "已完成"));
  const selectedTask = taskList.find((task) => task.id === selectedTaskId);
  const detail = selectedTask?.id === "TK-1001" ? renderTicketDetail(selectedTask, selectedSolution, ticketDecision, sopViewed) : "";
  return `<div class="page-heading"><div><div class="eyebrow">TK-1001 · 虚构流程案例</div><h1>Tasks</h1><p>按优先级和处理状态浏览模拟团队行动。</p></div><span class="guest-count">${visible.length} 项模拟任务</span></div><div class="guest-demo-note" role="note">工单、任务、负责人和日期均为虚构样例；完成状态只保存在本次访客页面内存。</div><div class="toolbar"><div class="filter-list">${filters.map(([key, label]) => `<button class="filter-button ${filter === key ? "active" : ""}" data-guest-action="filter-tasks" data-filter="${key}">${label}</button>`).join("")}</div><span class="muted">演示操作只在本次访客会话内生效 · 重置可恢复</span></div>${detail}<div class="guest-task-list">${visible.map((task) => `<article class="card guest-task"><div class="guest-task-priority priority-${priorityKey(task.priority)}">${escapeHtml(task.priority)}</div><div class="guest-task-body"><div class="guest-task-title"><strong>${escapeHtml(task.id ? `${task.id} · ` : "")}${escapeHtml(task.title)}</strong><span class="guest-pill ${task.status === "已完成" ? "good" : "neutral"}">${escapeHtml(task.status)}</span></div><p>${escapeHtml(task.description)}</p><div class="guest-task-meta"><span>${escapeHtml(projectById(task.project)?.name || "")}</span><span>${escapeHtml(task.owner)}</span><span>${escapeHtml(task.due)}</span>${task.id === "TK-1001" ? '<button class="text-button" data-guest-action="view-ticket">查看工单 →</button>' : ""}</div></div></article>`).join("")}</div>`;
}

function renderKnowledge(highlightedKnowledgeId, showReturn) {
  return `<div class="page-heading"><div><div class="eyebrow">团队资料库 · 模拟条目</div><h1>Knowledge</h1><p>运营规范、流程说明、指标口径与调研记录。</p></div><span class="guest-count">${knowledge.length} 条资料</span></div>${showReturn ? '<div class="guest-demo-note">此 SOP 已关联工单 TK-1001。<button class="text-button" data-guest-action="return-ticket">返回工单 →</button></div>' : ""}<div class="guest-knowledge-list">${knowledge.map((item) => `<article class="card guest-knowledge-card ${item.id === highlightedKnowledgeId ? "is-linked" : ""}"><span class="guest-knowledge-icon">文</span><div><div class="guest-knowledge-meta"><span>${escapeHtml(item.category)}</span><span>${escapeHtml(item.updated)}</span>${item.id === "sop-supplier-exception" ? '<span class="guest-pill watch">TK-1001 关联 SOP</span>' : ""}</div><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.summary)}</p>${item.id === "sop-supplier-exception" ? '<ol class="guest-sop-steps"><li>核实承诺交期、在途数量和关键物料范围。</li><li>延误达到 5 个工作日且影响项目时，按 P1 在 2 小时内升级。</li><li>比较加急拆分、认证备选供应商和排程调整，记录方案与影响。</li></ol>' : ""}<small>维护人 · ${escapeHtml(item.owner)}</small></div></article>`).join("")}</div>`;
}

function renderDecisions(decisionList) {
  return `<div class="page-heading"><div><div class="eyebrow">团队共识 · 可追溯记录</div><h1>Decisions</h1><p>记录关键取舍、决策依据和影响范围。</p></div><span class="guest-count">${decisionList.length} 条决策</span></div><div class="guest-decision-list">${decisionList.map((item) => `<article class="card guest-decision-card"><div class="guest-decision-mark">◇</div><div class="guest-decision-body"><div class="guest-knowledge-meta"><span>${escapeHtml(item.owner)}</span><span>${escapeHtml(item.date)}</span><span class="guest-pill ${item.status === "已确认" ? "good" : "neutral"}">${escapeHtml(item.status)}</span>${item.ticketId ? '<span class="guest-pill watch">访客模拟 · TK-1001</span>' : ""}</div><h2>${escapeHtml(item.title)}</h2><div class="guest-decision-detail"><div><small>决策依据</small><p>${escapeHtml(item.reason)}</p></div><div><small>影响范围</small><p>${escapeHtml(item.impact)}</p></div></div></div></article>`).join("")}</div>`;
}

function renderTour(tourIndex) {
  if (tourIndex === null) return "";
  const step = tour[tourIndex];
  return `<aside class="guest-tour" role="dialog" aria-labelledby="guest-tour-title" aria-live="polite"><div class="guest-tour-top"><div><span class="eyebrow">两分钟导航 · ${tourIndex + 1} / ${tour.length}</span><h2 id="guest-tour-title">${escapeHtml(step.title)}</h2></div><button class="icon-button" data-guest-action="skip-tour" aria-label="跳过引导">×</button></div><p>${escapeHtml(step.text)}</p><div class="guest-tour-progress"><span style="width:${((tourIndex + 1) / tour.length) * 100}%"></span></div><div class="guest-tour-actions"><button class="button quiet small" data-guest-action="skip-tour">跳过引导</button><span>预计 2 分钟</span><button class="button primary small" data-guest-action="next-tour">${tourIndex === tour.length - 1 ? "完成" : "下一步"}</button></div></aside>`;
}

function mountGuestDemo({ root, onExit }) {
  let currentPage = "home";
  let taskFilter = "all";
  let tourIndex = null;
  let taskList = initialTasks.map((task) => ({ ...task }));
  let decisionList = initialDecisions.map((decision) => ({ ...decision }));
  let selectedTaskId = null;
  let selectedSolution = "";
  let sopViewed = false;
  let highlightedKnowledgeId = null;
  let showSopReturn = false;
  let selectedShowcaseId = "";

  function restoreDemoData() {
    taskList = initialTasks.map((task) => ({ ...task }));
    decisionList = initialDecisions.map((decision) => ({ ...decision }));
    selectedTaskId = null;
    selectedSolution = "";
    sopViewed = false;
    highlightedKnowledgeId = null;
    showSopReturn = false;
    selectedShowcaseId = "";
  }

  function render() {
    const ticketDecision = decisionList.find((decision) => decision.ticketId === "TK-1001");
    const pageContent = currentPage === "home" ? renderHome()
      : currentPage === "projects" ? renderProjects(selectedShowcaseId)
        : currentPage === "tasks" ? renderTasks(taskFilter, taskList, selectedTaskId, selectedSolution, ticketDecision, sopViewed)
          : currentPage === "knowledge" ? renderKnowledge(highlightedKnowledgeId, showSopReturn) : renderDecisions(decisionList);
    root.innerHTML = `<div class="app-shell guest-app-shell"><aside class="sidebar"><div class="brand"><div class="brand-mark">D</div><div><div class="brand-name">Daniel Workspace</div><div class="brand-caption">公开作品集</div></div></div><div class="nav-label">精选项目展示</div><nav class="nav-list" aria-label="访客演示导航">${pages.map(([id, label, glyph]) => `<button class="nav-item ${currentPage === id ? "active" : ""}" data-guest-page="${id}"${currentPage === id ? ' aria-current="page"' : ""}><span class="guest-nav-glyph" aria-hidden="true">${glyph}</span><span>${label}</span>${id === "tasks" ? `<span class="nav-count">${taskList.filter((task) => task.status !== "已完成").length}</span>` : ""}</button>`).join("")}</nav><div class="sidebar-spacer"></div><div class="workspace-mini"><div class="avatar">访</div><div><div class="workspace-title">访客安全预览</div><div class="workspace-sub">不连接私人工作台</div></div></div><div class="guest-sidebar-actions"><button class="button small" data-guest-action="reset">重置演示</button><button class="button small quiet" data-guest-action="exit">退出</button></div><div class="sidebar-footer"><span class="local-label"><span class="guest-demo-dot"></span>独立访客演示</span></div></aside><div class="main-shell"><header class="topbar"><div class="breadcrumbs"><strong>${escapeHtml(pageLabels[currentPage])}</strong><span>·</span><span>公开作品摘要 · TK-1001 为虚构演示</span></div><div class="topbar-actions"><span class="guest-top-badge">访客演示</span><button class="button small" data-guest-action="start-tour">${tourIndex === null ? "开始导航" : "导航进度"}</button><button class="button small quiet" data-guest-action="reset">重置</button><button class="button small quiet" data-guest-action="exit">退出</button></div></header><main class="content guest-content">${pageContent}</main></div>${renderTour(tourIndex)}</div>`;
  }

  root.addEventListener("click", (event) => {
    const pageButton = event.target.closest("[data-guest-page]");
    if (pageButton) {
      const requestedPage = pageButton.dataset.guestPage;
      if (pages.some(([id]) => id === requestedPage)) {
        currentPage = requestedPage;
        if (currentPage === "projects") selectedShowcaseId = "";
        if (tourIndex !== null) tourIndex = tour.findIndex((step) => step.page === currentPage);
        render();
      }
      return;
    }
    const actionElement = event.target.closest("[data-guest-action]");
    const action = actionElement?.dataset.guestAction;
    if (!action) return;
    if (action === "exit") {
      root.replaceChildren();
      onExit();
    } else if (action === "reset") {
      restoreDemoData();
      currentPage = "home";
      taskFilter = "all";
      tourIndex = null;
      render();
    } else if (action === "view-ticket") {
      selectedShowcaseId = "";
      selectedTaskId = "TK-1001";
      currentPage = "tasks";
      if (tourIndex !== null) tourIndex = tour.findIndex((step) => step.page === currentPage);
      render();
    } else if (action === "view-project") {
      const projectId = actionElement.dataset.projectId;
      if (showcaseProjects.some((project) => project.id === projectId)) {
        selectedShowcaseId = projectId;
        currentPage = "projects";
        if (tourIndex !== null) tourIndex = tour.findIndex((step) => step.page === currentPage);
        render();
      }
    } else if (action === "back-projects") {
      selectedShowcaseId = "";
      currentPage = "projects";
      if (tourIndex !== null) tourIndex = tour.findIndex((step) => step.page === currentPage);
      render();
    } else if (action === "open-sop") {
      sopViewed = true;
      highlightedKnowledgeId = "sop-supplier-exception";
      showSopReturn = true;
      currentPage = "knowledge";
      if (tourIndex !== null) tourIndex = tour.findIndex((step) => step.page === currentPage);
      render();
    } else if (action === "return-ticket") {
      showSopReturn = false;
      selectedTaskId = "TK-1001";
      currentPage = "tasks";
      render();
    } else if (action === "generate-decision") {
      const ticket = taskList.find((task) => task.id === "TK-1001");
      const solution = ticketSolutions.find((item) => item.id === selectedSolution);
      if (ticket && solution && sopViewed && !decisionList.some((decision) => decision.ticketId === ticket.id)) {
        const rule = getTicketPriorityRule(ticket);
        decisionList.unshift({
          title: "TK-1001：供应商交期异常处置",
          date: "10 月 09 日",
          owner: "供应链例会",
          status: "已确认",
          reason: `${rule.reason} 按关联 SOP 评估后选择：${solution.title}。`,
          impact: solution.impact,
          final: solution.title,
          ticketId: ticket.id,
        });
      }
      render();
    } else if (action === "complete-ticket") {
      const ticket = taskList.find((task) => task.id === "TK-1001");
      if (ticket && decisionList.some((decision) => decision.ticketId === ticket.id)) ticket.status = "已完成";
      currentPage = "tasks";
      render();
    } else if (action === "filter-tasks") {
      taskFilter = ["all", "open", "done"].includes(event.target.closest("[data-filter]")?.dataset.filter) ? event.target.closest("[data-filter]").dataset.filter : "all";
      currentPage = "tasks";
      if (tourIndex !== null) tourIndex = tour.findIndex((step) => step.page === currentPage);
      render();
    } else if (action === "skip-tour") {
      tourIndex = null;
      render();
    } else if (action === "start-tour") {
      tourIndex = tour.findIndex((step) => step.page === currentPage);
      if (tourIndex < 0) tourIndex = 0;
      currentPage = tour[tourIndex].page;
      render();
    } else if (action === "next-tour") {
      if (tourIndex >= tour.length - 1) tourIndex = null;
      else {
        tourIndex += 1;
        currentPage = tour[tourIndex].page;
      }
      render();
    }
  });

  root.addEventListener("change", (event) => {
    if (event.target.name !== "guest-ticket-solution" || !sopViewed) return;
    if (ticketSolutions.some((solution) => solution.id === event.target.value)) selectedSolution = event.target.value;
    render();
  });

  render();
}

export { mountGuestDemo };
