const pages = [
  ["home", "Home", "⌂"],
  ["projects", "Projects", "▧"],
  ["tasks", "Tasks", "✓"],
  ["knowledge", "Knowledge", "▤"],
  ["decisions", "Decisions", "◇"],
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
  { page: "home", title: "Home · 运营总览", text: "先看核心项目进度、近期任务与需要关注的事项。这里汇总的是一组虚构企业数据。" },
  { page: "projects", title: "Projects · 项目组合", text: "浏览四个跨部门项目，查看负责人、阶段、目标日期与进展。项目卡片只用于演示信息组织方式。" },
  { page: "tasks", title: "Tasks · 团队行动", text: "按状态浏览任务，优先级与负责人帮助团队快速找到下一步。访客视图是只读沙盒。" },
  { page: "knowledge", title: "Knowledge · 运营知识", text: "规范、流程、指标口径与调研摘录集中在这里，便于项目成员复用共识。" },
  { page: "decisions", title: "Decisions · 决策记录", text: "查看决策的背景、结果和影响范围，让关键取舍能被团队追溯。" },
];

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const projectById = (id) => projects.find((project) => project.id === id);
const pageLabels = Object.fromEntries(pages.map(([id, label]) => [id, label]));

function renderHome(taskList) {
  const openTasks = taskList.filter((task) => task.status !== "已完成").length;
  const highPriorityTasks = taskList.filter((task) => task.priority === "高" && task.status !== "已完成").length;
  const completedThisWeek = 8 + (taskList.some((task) => task.id === "TK-1001" && task.status === "已完成") ? 1 : 0);
  const watchProjects = projects.filter((project) => project.health === "需关注").length;
  return `<div class="page-heading"><div><div class="eyebrow">访客沙盒 · 模拟企业运营</div><h1>运营总览</h1><p>远岚科技集团 · 2026 年第四季度</p></div><button class="button primary" data-guest-action="start-tour">开始 2 分钟导航</button></div>
    <div class="guest-demo-note" role="note">全部为虚构演示数据。TK-1001 的建议、Decision 和完成状态只在当前访客会话内模拟，不会写入私人账号、云端资料或本机服务。</div>
    <section class="guest-stat-grid"><article class="card guest-stat"><span>进行中项目</span><strong>${projects.filter((project) => project.status === "执行中").length}</strong><small>覆盖 4 个业务方向</small></article><article class="card guest-stat"><span>待完成任务</span><strong data-guest-stat="open-tasks">${openTasks}</strong><small>${highPriorityTasks} 项高优先级</small></article><article class="card guest-stat"><span>需关注项目</span><strong>${watchProjects}</strong><small>交期协同需要跟进</small></article><article class="card guest-stat"><span>本周已完成</span><strong data-guest-stat="completed-tasks">${completedThisWeek}</strong><small>团队模拟周报数据</small></article></section>
    <section class="guest-home-grid"><article class="card card-pad"><div class="card-header"><h2>项目进展</h2><span class="minor">按近期关注排序</span></div><div class="guest-project-list">${projects.slice(0, 3).map(renderProjectRow).join("")}</div><button class="text-button" data-guest-page="projects">浏览全部项目 →</button></article><article class="card card-pad"><div class="card-header"><h2>近期任务</h2><span class="minor">${openTasks} 项待完成</span></div><div class="guest-compact-list">${taskList.filter((task) => task.status !== "已完成").slice(0, 4).map((task) => `<div class="guest-compact-row"><span class="guest-priority priority-${priorityKey(task.priority)}">${escapeHtml(task.priority)}</span><div><strong>${escapeHtml(task.title)}</strong><small>${escapeHtml(task.owner)} · ${escapeHtml(task.due)}</small></div>${task.id === "TK-1001" ? '<button class="text-button" data-guest-action="view-ticket">打开工单 →</button>' : ""}</div>`).join("")}</div><button class="text-button" data-guest-page="tasks">查看任务清单 →</button></article></section>
    <article class="card guest-spotlight"><div class="guest-spotlight-mark">i</div><div><strong>本周运营提示</strong><p>供应链协同项目进入异常流程评审阶段；建议同步采购与计划团队，确保升级角色和反馈时限清晰。</p></div><span class="guest-pill watch">需关注</span></article>`;
}

function priorityKey(priority) { return ({ "高": "high", "中": "medium", "低": "low" })[priority] || "low"; }

function renderProjectRow(project) {
  return `<div class="guest-project-row"><div class="guest-project-row-head"><div><strong>${escapeHtml(project.name)}</strong><small>${escapeHtml(project.type)} · ${escapeHtml(project.owner)}</small></div><span class="guest-pill ${project.health === "需关注" ? "watch" : "good"}">${escapeHtml(project.health)}</span></div><div class="guest-progress"><span style="width:${project.progress}%"></span></div><div class="guest-project-meta"><span>${project.progress}% 完成</span><span>目标 ${escapeHtml(project.due)}</span></div></div>`;
}

function renderProjects() {
  return `<div class="page-heading"><div><div class="eyebrow">企业项目组合 · 模拟数据</div><h1>Projects</h1><p>查看项目负责人、当前阶段与交付进度。</p></div><span class="guest-count">${projects.length} 个项目</span></div><div class="guest-card-grid">${projects.map((project) => `<article class="card guest-project-card"><div class="guest-project-row-head"><span class="guest-project-type">${escapeHtml(project.type)}</span><span class="guest-pill ${project.health === "需关注" ? "watch" : "good"}">${escapeHtml(project.health)}</span></div><h2>${escapeHtml(project.name)}</h2><p>${escapeHtml(project.summary)}</p><div class="guest-project-owner"><span class="avatar">${escapeHtml(project.owner.slice(0, 1))}</span><span>${escapeHtml(project.owner)}<small>项目负责人</small></span><span class="guest-status">${escapeHtml(project.status)}</span></div><div class="guest-progress"><span style="width:${project.progress}%"></span></div><div class="guest-project-meta"><span>完成度 ${project.progress}%</span><span>目标 ${escapeHtml(project.due)}</span></div></article>`).join("")}</div>`;
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
  return `<div class="page-heading"><div><div class="eyebrow">团队行动清单 · 会话内模拟</div><h1>Tasks</h1><p>按优先级、负责人和截止时间浏览团队行动。</p></div><span class="guest-count">${visible.length} 项任务</span></div><div class="toolbar"><div class="filter-list">${filters.map(([key, label]) => `<button class="filter-button ${filter === key ? "active" : ""}" data-guest-action="filter-tasks" data-filter="${key}">${label}</button>`).join("")}</div><span class="muted">演示操作只在本次访客会话内生效 · 重置可恢复</span></div>${detail}<div class="guest-task-list">${visible.map((task) => `<article class="card guest-task"><div class="guest-task-priority priority-${priorityKey(task.priority)}">${escapeHtml(task.priority)}</div><div class="guest-task-body"><div class="guest-task-title"><strong>${escapeHtml(task.id ? `${task.id} · ` : "")}${escapeHtml(task.title)}</strong><span class="guest-pill ${task.status === "已完成" ? "good" : "neutral"}">${escapeHtml(task.status)}</span></div><p>${escapeHtml(task.description)}</p><div class="guest-task-meta"><span>${escapeHtml(projectById(task.project)?.name || "")}</span><span>${escapeHtml(task.owner)}</span><span>${escapeHtml(task.due)}</span>${task.id === "TK-1001" ? '<button class="text-button" data-guest-action="view-ticket">查看工单 →</button>' : ""}</div></div></article>`).join("")}</div>`;
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
  let tourIndex = 0;
  let taskList = initialTasks.map((task) => ({ ...task }));
  let decisionList = initialDecisions.map((decision) => ({ ...decision }));
  let selectedTaskId = null;
  let selectedSolution = "";
  let sopViewed = false;
  let highlightedKnowledgeId = null;
  let showSopReturn = false;

  function restoreDemoData() {
    taskList = initialTasks.map((task) => ({ ...task }));
    decisionList = initialDecisions.map((decision) => ({ ...decision }));
    selectedTaskId = null;
    selectedSolution = "";
    sopViewed = false;
    highlightedKnowledgeId = null;
    showSopReturn = false;
  }

  function render() {
    const ticketDecision = decisionList.find((decision) => decision.ticketId === "TK-1001");
    const pageContent = currentPage === "home" ? renderHome(taskList)
      : currentPage === "projects" ? renderProjects()
        : currentPage === "tasks" ? renderTasks(taskFilter, taskList, selectedTaskId, selectedSolution, ticketDecision, sopViewed)
          : currentPage === "knowledge" ? renderKnowledge(highlightedKnowledgeId, showSopReturn) : renderDecisions(decisionList);
    root.innerHTML = `<div class="app-shell guest-app-shell"><aside class="sidebar"><div class="brand"><div class="brand-mark">D</div><div><div class="brand-name">Daniel Workspace</div><div class="brand-caption">企业运营演示</div></div></div><div class="nav-label">演示工作区</div><nav class="nav-list" aria-label="访客演示导航">${pages.map(([id, label, glyph]) => `<button class="nav-item ${currentPage === id ? "active" : ""}" data-guest-page="${id}"${currentPage === id ? ' aria-current="page"' : ""}><span class="guest-nav-glyph" aria-hidden="true">${glyph}</span><span>${label}</span>${id === "tasks" ? `<span class="nav-count">${taskList.filter((task) => task.status !== "已完成").length}</span>` : ""}</button>`).join("")}</nav><div class="sidebar-spacer"></div><div class="workspace-mini"><div class="avatar">远</div><div><div class="workspace-title">远岚科技集团</div><div class="workspace-sub">模拟企业 · 访客沙盒</div></div></div><div class="guest-sidebar-actions"><button class="button small" data-guest-action="reset">重置演示</button><button class="button small quiet" data-guest-action="exit">退出</button></div><div class="sidebar-footer"><span class="local-label"><span class="guest-demo-dot"></span>独立访客演示</span></div></aside><div class="main-shell"><header class="topbar"><div class="breadcrumbs"><strong>${escapeHtml(pageLabels[currentPage])}</strong><span>·</span><span>模拟企业运营数据</span></div><div class="topbar-actions"><span class="guest-top-badge">访客演示</span><button class="button small" data-guest-action="start-tour">${tourIndex === null ? "重看导航" : "导航进度"}</button><button class="button small quiet" data-guest-action="reset">重置</button><button class="button small quiet" data-guest-action="exit">退出</button></div></header><main class="content guest-content">${pageContent}</main></div>${renderTour(tourIndex)}</div>`;
  }

  root.addEventListener("click", (event) => {
    const pageButton = event.target.closest("[data-guest-page]");
    if (pageButton) {
      const requestedPage = pageButton.dataset.guestPage;
      if (pages.some(([id]) => id === requestedPage)) {
        currentPage = requestedPage;
        if (tourIndex !== null) tourIndex = tour.findIndex((step) => step.page === currentPage);
        render();
      }
      return;
    }
    const action = event.target.closest("[data-guest-action]")?.dataset.guestAction;
    if (!action) return;
    if (action === "exit") {
      root.replaceChildren();
      onExit();
    } else if (action === "reset") {
      restoreDemoData();
      currentPage = "home";
      taskFilter = "all";
      tourIndex = 0;
      render();
    } else if (action === "view-ticket") {
      selectedTaskId = "TK-1001";
      currentPage = "tasks";
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
