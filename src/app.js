import { loadData, resetData, saveData } from "./store.js";

const app = document.querySelector("#app");
let db = loadData();
const ui = {
  page: "home",
  projectId: null,
  taskFilter: "all",
  query: "",
  searchOpen: false,
  modal: null,
  assistantOpen: false,
  chat: [{ role: "assistant", text: "你好，我是这个工作台里的 Mock AI。可以问我当前页面的项目进度、下一步或决策摘要。" }],
};

const iconShapes = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  folder: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/><path d="M3 10h18"/>',
  inbox: '<path d="M4 4h16l2 11h-6l-2 3h-4l-2-3H2z"/><path d="M2 15h6l2 3h4l2-3h6"/>',
  bulb: '<path d="M9 18h6M10 22h4"/><path d="M8.5 14.5a7 7 0 1 1 7 0c-.8.6-1.3 1.3-1.5 2.5h-4c-.2-1.2-.7-1.9-1.5-2.5Z"/>',
  checkSquare: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="m7.5 12 3 3 6-6"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back: '<path d="m15 18-6-6 6-6"/><path d="M20 12H9"/>',
  external: '<path d="M13 5h6v6M19 5l-9 9"/><path d="M18 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  sparkle: '<path d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  edit: '<path d="m14 5 5 5"/><path d="m4 20 4.3-.8L19 8.5a2.1 2.1 0 0 0-3-3L5.3 16.2 4 20Z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 13h11l1-13M9 7V4h6v3"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  send: '<path d="m21 3-7.5 18-3.5-7-7-3.5z"/><path d="M21 3 10 14"/>',
  document: '<path d="M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.1 0l2.5-2.5a5 5 0 0 0-7.1-7.1L11 4.9"/><path d="M14 11a5 5 0 0 0-7.1 0l-2.5 2.5a5 5 0 0 0 7.1 7.1l1.5-1.5"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  reset: '<path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  tag: '<path d="M20 13 13 20 4 11V4h7z"/><circle cx="8" cy="8" r="1"/>',
  sparkleSmall: '<path d="m12 3 1.3 5.7L19 10l-5.7 1.3L12 17l-1.3-5.7L4 10l5.7-1.3z"/>',
};

function icon(name, className = "icon") {
  return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconShapes[name] || iconShapes.document}</svg>`;
}

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function uid(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
}

function projectById(id) { return db.projects.find((project) => project.id === id); }
function projectTitle(id) { return projectById(id)?.name || "未关联项目"; }
function openTasks() { return db.tasks.filter((task) => task.status !== "done"); }
function priorityClass(priority = "低") { return priority === "高" ? "high" : priority === "中" ? "medium" : "low"; }
function statusClass(status = "") { return status === "进行中" ? "active" : status === "暂停" ? "paused" : "planned"; }
function initials(title = "?") { return [...title.trim()].slice(0, 2).join("") || "?"; }

function timeAgo(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "刚刚";
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days} 天前` : date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

function formattedDate() {
  return new Date().toLocaleDateString("zh-CN", { weekday: "short", month: "long", day: "numeric" });
}

function persist() {
  saveData(db);
}

function logActivity(type, title, projectId = null) {
  db.activities.unshift({ id: uid("activity"), type, title, projectId, createdAt: new Date().toISOString() });
  db.activities = db.activities.slice(0, 80);
}

function go(page, projectId = null, push = true) {
  ui.page = page;
  ui.projectId = projectId;
  ui.searchOpen = false;
  if (push) history.pushState({ page, projectId }, "", page === "project" ? `#project/${encodeURIComponent(projectId)}` : `#${page}`);
  render();
}

window.addEventListener("popstate", () => {
  const match = location.hash.match(/^#project\/(.+)$/);
  if (match) go("project", decodeURIComponent(match[1]), false);
  else {
    const page = ["home", "projects", "knowledge", "decisions", "tasks"].includes(location.hash.slice(1)) ? location.hash.slice(1) : "home";
    go(page, null, false);
  }
});

function statusPill(status) {
  return `<span class="status-pill ${statusClass(status)}">${esc(status)}</span>`;
}

function taskRow(task, compact = false) {
  const project = projectById(task.projectId);
  return `<div class="task-row ${task.status === "done" ? "is-done" : ""}">
    <button class="check-button ${task.status === "done" ? "checked" : ""}" data-action="toggle-task" data-id="${esc(task.id)}" aria-label="${task.status === "done" ? "重新打开" : "完成"}任务">${task.status === "done" ? icon("checkSquare") : ""}</button>
    <div class="task-text">${esc(task.title)}${!compact ? `<div class="task-sub">${esc(project?.name || "无关联项目")}${task.due ? ` · ${esc(task.due)}` : ""}</div>` : ""}</div>
    <span class="priority ${priorityClass(task.priority)}">${esc(task.priority || "低")}优先级</span>
    ${compact ? "" : `<button class="icon-button" data-action="edit-task" data-id="${esc(task.id)}" aria-label="编辑任务">${icon("edit")}</button>`}
  </div>`;
}

function projectRow(project) {
  const count = db.tasks.filter((task) => task.projectId === project.id && task.status !== "done").length;
  return `<div class="project-row" data-action="view-project" data-id="${esc(project.id)}" tabindex="0" role="button" aria-label="打开项目 ${esc(project.name)}">
    <div class="project-glyph">${esc(initials(project.name))}</div>
    <div class="project-main"><div class="project-name">${esc(project.name)}</div><div class="project-meta">${esc(project.stage || "尚未设置阶段")} · ${count} 个待办</div></div>
    <div class="project-trailing">${statusPill(project.status)}${icon("chevron")}</div>
  </div>`;
}

function recordIcon(type) {
  if (type === "链接") return icon("link");
  if (type === "decision") return icon("bulb");
  if (type === "task") return icon("checkSquare");
  if (type === "project") return icon("folder");
  return icon("document");
}

function knowledgeRow(item, compact = false) {
  return `<div class="knowledge-row">
    <div class="record-icon">${recordIcon(item.type)}</div>
    <div class="record-copy"><div class="record-title">${esc(item.title)}</div>
      <div class="record-meta">${esc(item.summary || item.content.slice(0, 92))}${item.content.length > 92 && !item.summary ? "…" : ""}</div>
      <div class="tag-row">${compact ? `<span class="tag">${esc(projectTitle(item.projectId))}</span>` : item.tags.map((tag) => `<span class="tag">#${esc(tag)}</span>`).join("")}</div>
    </div>
    ${compact ? "" : `<div class="record-actions"><button class="icon-button" data-action="edit-knowledge" data-id="${esc(item.id)}" aria-label="编辑资料">${icon("edit")}</button><button class="icon-button" data-action="delete-knowledge" data-id="${esc(item.id)}" aria-label="删除资料">${icon("trash")}</button></div>`}
  </div>`;
}

function decisionRow(decision, compact = false) {
  return `<div class="decision-row ${compact ? "clickable" : ""}" ${compact ? `data-action="view-decision" data-id="${esc(decision.id)}" tabindex="0" role="button"` : ""}>
    <div class="record-icon decision">${icon("bulb")}</div>
    <div class="record-copy decision-copy"><div class="record-title">${esc(decision.question)}</div><div class="decision-answer">${decision.final ? `已决定：${esc(decision.final)}` : "尚未做最终决定"}</div><div class="record-meta">${esc(projectTitle(decision.projectId))} · ${timeAgo(decision.createdAt)}</div></div>
    ${compact ? icon("chevron") : `<div class="record-actions"><button class="icon-button" data-action="edit-decision" data-id="${esc(decision.id)}" aria-label="编辑决策">${icon("edit")}</button></div>`}
  </div>`;
}

function activityRow(activity) {
  return `<div class="activity-row"><span class="activity-dot"></span><div class="record-copy"><div class="record-title">${esc(activity.title)}</div><div class="record-meta">${esc(projectTitle(activity.projectId))}</div></div><time class="activity-time">${timeAgo(activity.createdAt)}</time></div>`;
}

function sectionTitle(title, trailing = "") {
  return `<div class="section-title"><h2>${title}</h2>${trailing}</div>`;
}

function suggestionTask() {
  return openTasks().sort((a, b) => ["高", "中", "低"].indexOf(a.priority) - ["高", "中", "低"].indexOf(b.priority))[0];
}

function renderDashboard() {
  const pending = openTasks();
  const task = suggestionTask();
  const activeProjects = db.projects.filter((project) => project.status === "进行中").length;
  const recentProjects = [...db.projects].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4);
  const recentKnowledge = [...db.knowledge].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3);
  const recentDecisions = [...db.decisions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3);
  const activities = db.activities.slice(0, 6);

  return `<div class="page-heading"><div><div class="eyebrow">${formattedDate()} · 你的个人工作区</div><h1>早上好，Daniel</h1><p>看一眼当前进展，选一件最值得推进的事。</p></div><div class="heading-actions"><button class="button quiet small" data-action="reset-demo">${icon("reset")} 重置演示</button><button class="button" data-action="open-create-knowledge">${icon("plus")} 添加资料</button><button class="button primary" data-action="open-create-task">${icon("plus")} 新建任务</button></div></div>
    <div class="stat-row">
      <div class="stat-card"><div class="stat-icon">${icon("folder")}</div><div><div class="stat-value">${activeProjects}</div><div class="stat-label">进行中的项目</div></div></div>
      <div class="stat-card"><div class="stat-icon">${icon("checkSquare")}</div><div><div class="stat-value">${pending.length}</div><div class="stat-label">待办任务</div></div></div>
      <div class="stat-card"><div class="stat-icon">${icon("document")}</div><div><div class="stat-value">${db.knowledge.length}</div><div class="stat-label">已收集资料</div></div></div>
      <div class="stat-card"><div class="stat-icon">${icon("bulb")}</div><div><div class="stat-value">${db.decisions.length}</div><div class="stat-label">已记录决策</div></div></div>
    </div>
    <div class="dashboard-grid">
      <section class="suggestion-card grid-span-5"><div class="suggestion-kicker">${icon("sparkle", "icon spark")} AI 建议下一步 <span class="tag">Mock</span></div>
        <div class="suggestion-title">${task ? esc(task.title) : "给自己留一点思考空间"}</div>
        <p class="suggestion-copy">${task ? `这是目前优先级最高的待办，属于「${esc(projectTitle(task.projectId))}」。先用 25 分钟推进它，完成后再看下一步。` : "目前没有未完成任务，可以回顾最近的项目进度，或者创建一项新的行动。"}</p>
        <div class="suggestion-footer"><span class="suggestion-footnote">基于本地项目和待办生成 · 不会调用外部 API</span><button class="button small" data-action="open-assistant">问问 AI ${icon("arrow")}</button></div>
      </section>
      <section class="card card-pad grid-span-7">${sectionTitle("最近项目", `<button class="button quiet small" data-page="projects">查看全部 ${icon("arrow")}</button>`)}<div class="project-list">${recentProjects.length ? recentProjects.map(projectRow).join("") : `<div class="empty-state">还没有项目，先创建一个吧。</div>`}</div></section>
      <section class="card card-pad grid-span-7">${sectionTitle("待办任务", `<button class="button quiet small" data-page="tasks">所有任务 ${icon("arrow")}</button>`)}<div class="task-list">${pending.slice(0, 4).map((item) => taskRow(item, true)).join("") || `<div class="empty-state"><strong>暂时没有待办</strong>今天的清单已经清空。</div>`}</div></section>
      <section class="card card-pad grid-span-5">${sectionTitle("最近资料", `<button class="button quiet small" data-page="knowledge">打开收件箱 ${icon("arrow")}</button>`)}<div>${recentKnowledge.map((item) => knowledgeRow(item, true)).join("") || `<div class="empty-state">还没有资料。</div>`}</div></section>
      <section class="card card-pad grid-span-6">${sectionTitle("最近决策", `<button class="button quiet small" data-page="decisions">决策历史 ${icon("arrow")}</button>`)}<div>${recentDecisions.map((decision) => decisionRow(decision, true)).join("") || `<div class="empty-state">还没有记录过决策。</div>`}</div></section>
      <section class="card card-pad grid-span-6">${sectionTitle("最近活动", `<span class="minor">${db.activities.length} 条记录</span>`)}<div>${activities.map(activityRow).join("") || `<div class="empty-state">创建一个任务，活动就会出现在这里。</div>`}</div></section>
    </div>`;
}

function renderProjects() {
  const projects = [...db.projects].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return `<div class="page-heading"><div><div class="eyebrow">工作空间</div><h1>Projects</h1><p>项目、当前阶段与下一步都在这里。</p></div><div class="heading-actions"><button class="button primary" data-action="open-create-project">${icon("plus")} 新建项目</button></div></div>
    ${projects.length ? `<div class="project-cards">${projects.map((project) => {
      const tasks = db.tasks.filter((item) => item.projectId === project.id);
      const done = tasks.filter((item) => item.status === "done").length;
      return `<article class="card project-card" data-action="view-project" data-id="${esc(project.id)}" tabindex="0" role="button"><div class="project-card-top"><div class="project-glyph">${esc(initials(project.name))}</div><div class="project-main"><h3>${esc(project.name)}</h3><div class="project-meta">${esc(project.stage || "尚未设置阶段")}</div></div>${statusPill(project.status)}</div><p>${esc(project.description || "还没有项目简介。")}</p><div class="project-card-bottom"><span>${esc(project.next || "下一步待定")}</span><span>${done}/${tasks.length} 完成</span></div></article>`;
    }).join("")}</div>` : `<div class="card empty-state"><strong>还没有项目</strong>创建第一个项目来整理任务与资料。<br><br><button class="button primary" data-action="open-create-project">${icon("plus")} 新建项目</button></div>`}`;
}

function safeExternal(url) {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
  } catch { return ""; }
}

function knowledgeContent(item) {
  const href = item.type === "链接" ? safeExternal(item.content.trim()) : "";
  return href ? `<a class="knowledge-external" href="${esc(href)}" target="_blank" rel="noreferrer">${esc(href)} ${icon("external")}</a>` : esc(item.content);
}

function renderProjectDetail() {
  const project = projectById(ui.projectId);
  if (!project) return `<div class="page-heading"><div><h1>找不到这个项目</h1><p>它可能已经被删除。</p></div><button class="button" data-page="projects">${icon("back")} 返回项目</button></div>`;
  const tasks = db.tasks.filter((item) => item.projectId === project.id).sort((a, b) => Number(a.status === "done") - Number(b.status === "done"));
  const knowledge = db.knowledge.filter((item) => item.projectId === project.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const activities = db.activities.filter((item) => item.projectId === project.id).slice(0, 6);
  const github = safeExternal(project.github);
  const live = safeExternal(project.url);
  return `<div class="detail-topline"><button class="icon-button" data-page="projects" aria-label="返回项目">${icon("back")}</button><span>Projects</span>${icon("chevron")}<span>${esc(project.name)}</span></div>
    <section class="card detail-hero"><div class="detail-hero-head"><div class="detail-hero-copy">${statusPill(project.status)}<h2 style="margin-top:11px">${esc(project.name)}</h2><p>${esc(project.description || "还没有项目简介。")}</p></div><button class="button" data-action="edit-project" data-id="${esc(project.id)}">${icon("edit")} 编辑项目</button></div><div class="detail-links"><span class="detail-link">${icon("folder")} ${esc(project.path || "本地路径未设置")}</span>${github ? `<a class="detail-link" href="${esc(github)}" target="_blank" rel="noreferrer">${icon("external")} GitHub</a>` : ""}${live ? `<a class="detail-link" href="${esc(live)}" target="_blank" rel="noreferrer">${icon("external")} 在线网址</a>` : ""}</div></section>
    <div class="detail-meta-grid"><div class="card meta-card"><div class="meta-label">当前阶段</div><div class="meta-value">${esc(project.stage || "未设置")}</div></div><div class="card meta-card"><div class="meta-label">下一步</div><div class="meta-value">${esc(project.next || "待补充")}</div></div><div class="card meta-card"><div class="meta-label">进度概览</div><div class="meta-value">${tasks.filter((task) => task.status === "done").length} / ${tasks.length} 项任务完成</div></div></div>
    <div class="subgrid"><section class="card task-panel">${sectionTitle("TODO", `<button class="button quiet small" data-action="open-create-task" data-project-id="${esc(project.id)}">${icon("plus")} 添加任务</button>`)}<div>${tasks.map((task) => `<div class="task-detail-row"><button class="check-button ${task.status === "done" ? "checked" : ""}" data-action="toggle-task" data-id="${esc(task.id)}" aria-label="完成任务">${task.status === "done" ? icon("checkSquare") : ""}</button><div class="task-text">${esc(task.title)}</div><span class="priority ${priorityClass(task.priority)}">${esc(task.priority || "低")}</span></div>`).join("") || `<div class="empty-state">这个项目还没有任务。</div>`}</div></section>
      <section class="card card-pad">${sectionTitle("最近活动", `<span class="minor">${activities.length} 条</span>`)}<div>${activities.map(activityRow).join("") || `<div class="empty-state">项目活动会显示在这里。</div>`}</div></section>
      <section class="card card-pad" style="grid-column:1/-1">${sectionTitle("相关资料", `<button class="button quiet small" data-action="open-create-knowledge" data-project-id="${esc(project.id)}">${icon("plus")} 添加资料</button>`)}<div class="subgrid">${knowledge.map((item) => `<article class="card knowledge-card"><span class="type-pill">${esc(item.type)}</span><h3>${esc(item.title)}</h3><p>${esc(item.summary || item.content)}</p><div class="tag-row">${item.tags.map((tag) => `<span class="tag">#${esc(tag)}</span>`).join("")}</div></article>`).join("") || `<div class="empty-state">还没有关联资料。</div>`}</div></section></div>`;
}

function renderTasks() {
  const filters = [["all", "全部"], ["todo", "待办"], ["done", "已完成"]];
  const tasks = [...db.tasks].filter((task) => ui.taskFilter === "all" || task.status === ui.taskFilter).sort((a, b) => Number(a.status === "done") - Number(b.status === "done") || ["高", "中", "低"].indexOf(a.priority) - ["高", "中", "低"].indexOf(b.priority));
  return `<div class="page-heading"><div><div class="eyebrow">行动清单</div><h1>Tasks</h1><p>把下一步写清楚，一件一件完成。</p></div><div class="heading-actions"><button class="button primary" data-action="open-create-task">${icon("plus")} 新建任务</button></div></div>
    <div class="toolbar"><div class="filter-list">${filters.map(([value, label]) => `<button class="filter-button ${ui.taskFilter === value ? "active" : ""}" data-action="filter-tasks" data-filter="${value}">${label}${value === "todo" ? ` · ${openTasks().length}` : ""}</button>`).join("")}</div><span class="muted">${tasks.length} 项任务</span></div>
    <section class="card card-pad"><div class="task-list">${tasks.map((task) => taskRow(task)).join("") || `<div class="empty-state"><strong>没有符合条件的任务</strong>创建一条任务，让下一步更清晰。</div>`}</div></section>`;
}

function renderKnowledge() {
  const records = [...db.knowledge].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return `<div class="page-heading"><div><div class="eyebrow">收件箱 · 本地资料</div><h1>Knowledge</h1><p>先收集，再整理。V1 保存文本、笔记和链接。</p></div><div class="heading-actions"><button class="button primary" data-action="open-create-knowledge">${icon("plus")} 添加资料</button></div></div>
    <section class="card card-pad"><div class="card-header"><h3>所有资料</h3><span class="minor">${records.length} 条</span></div>${records.map((item) => `<article class="knowledge-row"><div class="record-icon">${recordIcon(item.type)}</div><div class="record-copy"><div class="record-title">${esc(item.title)}</div><div class="record-meta">${esc(item.summary || "暂无摘要")} · ${esc(projectTitle(item.projectId))} · ${timeAgo(item.createdAt)}</div><details style="margin-top:8px"><summary style="color:#8e909a;font-size:9px;cursor:pointer">查看内容</summary><div class="record-meta content-text" style="margin-top:7px">${knowledgeContent(item)}</div></details><div class="tag-row">${item.tags.map((tag) => `<span class="tag">#${esc(tag)}</span>`).join("")}</div></div><div class="record-actions" style="opacity:1"><button class="icon-button" data-action="edit-knowledge" data-id="${esc(item.id)}" aria-label="编辑资料">${icon("edit")}</button><button class="icon-button" data-action="delete-knowledge" data-id="${esc(item.id)}" aria-label="删除资料">${icon("trash")}</button></div></article>`).join("") || `<div class="empty-state"><strong>收件箱还空着</strong>添加一段文字、一则笔记或一个网页链接。</div>`}</section>`;
}

function decisionCard(decision) {
  const expanded = ui.expandedDecisionId === decision.id;
  return `<article class="card decision-card" data-action="toggle-decision" data-id="${esc(decision.id)}" tabindex="0" role="button" aria-expanded="${expanded}"><div class="decision-card-top"><div><h3>${esc(decision.question)}</h3><p>${esc(decision.goal || "尚未描述目标")}</p></div><button class="icon-button" data-action="edit-decision" data-id="${esc(decision.id)}" aria-label="编辑决策">${icon("edit")}</button></div><div class="decision-result">${icon("target")} ${esc(decision.final || "尚未填写最终决定")}</div><div class="record-meta">${esc(projectTitle(decision.projectId))} · ${timeAgo(decision.createdAt)}</div>${expanded ? `<div class="decision-detail-grid"><div class="decision-detail-cell"><div class="meta-label">可选方案</div><div class="meta-value">${esc(decision.options.join("；") || "未记录")}</div></div><div class="decision-detail-cell"><div class="meta-label">Mock AI 建议</div><div class="meta-value">${esc(decision.recommendation || "未生成")}</div></div><div class="decision-detail-cell"><div class="meta-label">时间 · 成本</div><div class="meta-value">${esc(decision.time || "未记录")} · ${esc(decision.cost || "未记录")}</div></div><div class="decision-detail-cell"><div class="meta-label">风险</div><div class="meta-value">${esc(decision.risk || "未记录")}</div></div><div class="decision-detail-cell" style="grid-column:1/-1"><div class="meta-label">决定原因</div><div class="meta-value">${esc(decision.reason || "未记录")}</div></div></div>` : ""}</article>`;
}

function renderDecisions() {
  const decisions = [...db.decisions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return `<div class="page-heading"><div><div class="eyebrow">决策记录</div><h1>Decisions</h1><p>把问题、选项和最终原因放在一起，方便以后回看。</p></div><div class="heading-actions"><button class="button primary" data-action="open-create-decision">${icon("plus")} 新建决策</button></div></div>
    <div class="section-title"><h2>历史决策</h2><span class="muted">${decisions.length} 条记录</span></div>${decisions.map(decisionCard).join("") || `<div class="card empty-state"><strong>还没有决策记录</strong>记录一次选择，之后就能回看当时的考虑。<br><br><button class="button primary" data-action="open-create-decision">${icon("plus")} 新建决策</button></div>`}`;
}

function pageTitle() {
  if (ui.page === "project") return projectTitle(ui.projectId);
  return ({ home: "Home", projects: "Projects", knowledge: "Knowledge", decisions: "Decisions", tasks: "Tasks" })[ui.page] || "Home";
}

function renderNav() {
  const items = [["home", "grid", "Home"], ["projects", "folder", "Projects"], ["knowledge", "inbox", "Knowledge"], ["decisions", "bulb", "Decisions"], ["tasks", "checkSquare", "Tasks"]];
  return `<aside class="sidebar"><div class="brand"><div class="brand-mark">D</div><div><div class="brand-name">Daniel Workspace</div><div class="brand-caption">个人 AI 工作台 · V1</div></div></div><div class="nav-label">Workspace</div><nav class="nav-list" aria-label="主导航">${items.map(([page, iconName, label]) => `<button class="nav-item ${(ui.page === page || (ui.page === "project" && page === "projects")) ? "active" : ""}" data-page="${page}">${icon(iconName)}<span>${label}</span>${page === "tasks" ? `<span class="nav-count">${openTasks().length}</span>` : ""}</button>`).join("")}</nav><div class="sidebar-spacer"></div><div class="workspace-mini"><div class="avatar">D</div><div><div class="workspace-title">Daniel 的工作区</div><div class="workspace-sub">仅保存在此浏览器</div></div><button class="icon-button" data-action="reset-demo" title="重置演示数据" aria-label="重置演示数据">${icon("more")}</button></div><div class="sidebar-footer"><span class="local-label"><span class="local-dot"></span> 本地数据已启用</span><button class="icon-button" data-action="reset-demo" title="重置演示数据" aria-label="重置演示数据">${icon("reset")}</button></div></aside>`;
}

function searchItems(query) {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [];
  const records = [
    ...db.projects.map((item) => ({ kind: "project", type: "Project", id: item.id, title: item.name, subtitle: `${item.stage || "项目"} · ${item.next || ""}`, haystack: `${item.name} ${item.status} ${item.path} ${item.github} ${item.url} ${item.stage} ${item.next} ${item.description}` })),
    ...db.knowledge.map((item) => ({ kind: "knowledge", type: "Knowledge", id: item.id, title: item.title, subtitle: `${item.type} · ${projectTitle(item.projectId)}`, haystack: `${item.title} ${item.content} ${item.summary} ${item.tags.join(" ")} ${projectTitle(item.projectId)}` })),
    ...db.decisions.map((item) => ({ kind: "decision", type: "Decision", id: item.id, title: item.question, subtitle: `${item.final || "待决定"} · ${projectTitle(item.projectId)}`, haystack: `${item.question} ${item.options.join(" ")} ${item.goal} ${item.time} ${item.cost} ${item.risk} ${item.recommendation} ${item.final} ${item.reason}` })),
    ...db.tasks.map((item) => ({ kind: "task", type: "Task", id: item.id, title: item.title, subtitle: `${projectTitle(item.projectId)} · ${item.status === "done" ? "已完成" : "待办"}`, haystack: `${item.title} ${item.priority} ${item.status} ${projectTitle(item.projectId)}` })),
  ];
  return records.map((record) => ({ ...record, score: record.title.toLocaleLowerCase().includes(needle) ? 0 : record.haystack.toLocaleLowerCase().includes(needle) ? 1 : 5 }))
    .filter((record) => record.score < 5).sort((a, b) => a.score - b.score || a.title.localeCompare(b.title, "zh-CN")).slice(0, 8);
}

function renderSearchResults() {
  const host = document.querySelector("#search-results");
  if (!host) return;
  if (!ui.searchOpen || !ui.query.trim()) { host.innerHTML = ""; return; }
  const results = searchItems(ui.query);
  host.innerHTML = `<div class="search-results"><div class="search-results-head">搜索结果</div>${results.length ? results.map((item) => `<button class="search-result" data-action="open-search-result" data-kind="${item.kind}" data-id="${esc(item.id)}"><span class="record-icon">${recordIcon(item.kind)}</span><span class="search-result-copy"><span class="search-result-title">${esc(item.title)}</span><span class="search-result-sub">${esc(item.subtitle)}</span></span><span class="search-result-type">${item.type}</span></button>`).join("") : `<div class="search-no-results">没有找到相关记录</div>`}<div class="search-footer"><span>搜索项目、资料、决策和任务</span><span>Enter 打开首个结果</span></div></div>`;
}

function contextLabel() {
  if (ui.page === "project") return `当前项目：${projectTitle(ui.projectId)}`;
  return `当前页面：${pageTitle()}`;
}

function renderAssistant() {
  if (!ui.assistantOpen) return `<button class="assistant-launcher" data-action="open-assistant" aria-label="打开 AI 助手"><span class="assistant-orb">${icon("sparkle")}</span><span>问问 AI</span></button>`;
  const prompts = ui.page === "project" ? ["这个项目现在做到哪了？", "帮我总结下一步"] : ui.page === "decisions" ? ["帮我整理这个决定", "我最近做了什么决定？"] : ui.page === "tasks" ? ["我下一步应该做什么？", "哪个任务优先？"] : ui.page === "knowledge" ? ["最近收集了哪些资料？", "总结一下当前收件箱"] : ["我下一步应该做什么？", "最近有哪些进展？"];
  return `<section class="assistant-panel" aria-label="AI Assistant"><header class="assistant-head"><span class="assistant-orb">${icon("sparkle")}</span><div class="assistant-head-copy"><div class="assistant-head-title">Workspace Assistant <span class="tag">Mock AI</span></div><div class="assistant-context">${esc(contextLabel())} · 本地数据上下文</div></div><button class="icon-button" data-action="clear-chat" title="清空对话" aria-label="清空对话">${icon("reset")}</button><button class="icon-button" data-action="close-assistant" aria-label="关闭助手">${icon("close")}</button></header>
    <div class="assistant-messages" id="assistant-messages">${ui.chat.map((message) => `<div class="chat-message ${message.role === "user" ? "user" : ""}">${esc(message.text)}</div>`).join("")}</div>
    <div class="assistant-suggestions">${prompts.map((prompt) => `<button class="suggestion-chip" data-action="send-prompt" data-prompt="${esc(prompt)}">${esc(prompt)}</button>`).join("")}</div>
    <form class="assistant-compose" id="assistant-form"><label class="sr-only" for="assistant-input">给 AI 助手发消息</label><textarea id="assistant-input" name="message" rows="1" placeholder="问问当前工作区…" required></textarea><button class="send-button" type="submit" aria-label="发送">${icon("send")}</button></form><div class="assistant-note">Mock AI · 回复基于本地数据，不会发送到网络</div></section>`;
}

function projectOptions(selected = "") {
  return `<option value="">不关联项目</option>${db.projects.map((project) => `<option value="${esc(project.id)}" ${project.id === selected ? "selected" : ""}>${esc(project.name)}</option>`).join("")}`;
}

function field(label, name, value = "", options = {}) {
  const full = options.full ? "full" : "";
  const optional = options.optional ? ` <span class="optional">可选</span>` : "";
  const placeholder = options.placeholder ? ` placeholder="${esc(options.placeholder)}"` : "";
  const required = options.required === false ? "" : "required";
  const input = options.textarea
    ? `<textarea name="${name}" class="${options.short ? "short" : ""}"${placeholder} ${required}>${esc(value)}</textarea>`
    : options.select
      ? `<select name="${name}" ${required}>${options.select}</select>`
      : `<input name="${name}" value="${esc(value)}" type="text" ${required}${placeholder}/>`;
  return `<div class="field ${full}"><label>${label}${optional}</label>${input}</div>`;
}

function recommendationFor(options, goal, risk) {
  const choices = options.filter(Boolean);
  if (!choices.length) return "补充可选方案后，这里会给出一条本地 Mock 建议。";
  const first = choices[0];
  const hasHighRisk = /高|不确定|延期|依赖|昂贵/.test(risk);
  const second = choices[1];
  if (second && hasHighRisk) return `结合目标「${goal || "尚未填写"}」和风险描述，建议先验证「${second}」的成本与可行性，再决定是否投入。`;
  return `先围绕目标「${goal || "尚未填写"}」评估「${first}」是否能用最少时间验证关键假设；如果不行，再比较其他方案。`;
}

function renderModal() {
  if (!ui.modal) return "";
  const { kind, id } = ui.modal;
  const existing = id ? ({ project: projectById(id), task: db.tasks.find((item) => item.id === id), knowledge: db.knowledge.find((item) => item.id === id), decision: db.decisions.find((item) => item.id === id) })[kind] : null;
  if (id && !existing) return "";
  const isEdit = Boolean(existing);
  let title = "", subtitle = "", form = "", wide = "";

  if (kind === "project") {
    title = isEdit ? "编辑项目" : "新建项目"; subtitle = "记录当前阶段、路径与下一步。";
    form = `<div class="form-grid">${field("项目名称", "name", existing?.name || "", { full: true })}${field("项目简介", "description", existing?.description || "", { full: true, textarea: true, short: true, required: false, placeholder: "这个项目要解决什么问题？" })}${field("当前状态", "status", existing?.status || "计划中", { select: ["计划中", "进行中", "暂停", "已完成"].map((x) => `<option ${x === (existing?.status || "计划中") ? "selected" : ""}>${x}</option>`).join("") })}${field("当前阶段", "stage", existing?.stage || "", { placeholder: "例如：原型验证" })}${field("本地路径", "path", existing?.path || "", { full: true, optional: true, required: false, placeholder: "D:\\Projects\\my-project" })}${field("GitHub 地址", "github", existing?.github || "", { optional: true, required: false, placeholder: "https://github.com/..." })}${field("在线网址", "url", existing?.url || "", { optional: true, required: false, placeholder: "https://..." })}${field("下一步", "next", existing?.next || "", { full: true, textarea: true, short: true, required: false })}</div>`;
  } else if (kind === "task") {
    title = isEdit ? "编辑任务" : "新建任务"; subtitle = "任务保存在本地，可以随时调整优先级和关联项目。";
    const selectedProject = existing?.projectId || ui.modal.projectId || "";
    form = `<div class="form-grid">${field("任务名称", "title", existing?.title || "", { full: true })}${field("关联项目", "projectId", "", { select: projectOptions(selectedProject), required: false })}${field("优先级", "priority", "", { select: ["高", "中", "低"].map((x) => `<option ${x === (existing?.priority || "中") ? "selected" : ""}>${x}</option>`).join("") })}${field("到期提示", "due", existing?.due || "", { optional: true, required: false, placeholder: "例如：周五" })}</div>`;
  } else if (kind === "knowledge") {
    title = isEdit ? "编辑资料" : "添加资料"; subtitle = "手动保存文本、笔记或链接，不会解析网页内容。"; wide = "wide";
    const typeSelect = ["文本", "笔记", "链接"].map((x) => `<option ${x === (existing?.type || "笔记") ? "selected" : ""}>${x}</option>`).join("");
    form = `<div class="form-grid">${field("资料类型", "type", "", { select: typeSelect })}${field("关联项目", "projectId", "", { select: projectOptions(existing?.projectId || ui.modal.projectId || ""), required: false })}${field("标题", "title", existing?.title || "", { full: true })}${field("内容", "content", existing?.content || "", { full: true, textarea: true, placeholder: "粘贴文字、写一则笔记或输入网页链接…" })}${field("简单摘要", "summary", existing?.summary || "", { full: true, textarea: true, short: true, optional: true, required: false, placeholder: "一句话概括这条资料" })}${field("标签", "tags", existing?.tags.join(", ") || "", { full: true, optional: true, required: false, placeholder: "用逗号分隔，例如：产品, 灵感" })}</div>`;
  } else if (kind === "decision") {
    title = isEdit ? "编辑决策" : "新建决策"; subtitle = "把目标、方案、取舍和最终理由保留在一起。"; wide = "wide";
    const optionsText = existing?.options.join("\n") || "";
    form = `<div class="form-grid">${field("问题", "question", existing?.question || "", { full: true })}${field("目标", "goal", existing?.goal || "", { full: true, textarea: true, short: true })}${field("可选方案", "options", optionsText, { full: true, textarea: true, short: true, placeholder: "每行一个方案" })}${field("时间", "time", existing?.time || "", { textarea: true, short: true, optional: true, required: false })}${field("成本", "cost", existing?.cost || "", { textarea: true, short: true, optional: true, required: false })}${field("风险", "risk", existing?.risk || "", { full: true, textarea: true, short: true, optional: true, required: false })}<div class="field full"><label>AI 建议 <span class="tag">Mock</span></label><div class="recommendation-box" id="decision-recommendation">${esc(existing?.recommendation || recommendationFor([], existing?.goal || "", existing?.risk || ""))}</div></div>${field("最终决定", "final", existing?.final || "", { full: true, optional: true, required: false, placeholder: "填写最终选择的方案" })}${field("决定原因", "reason", existing?.reason || "", { full: true, textarea: true, short: true, optional: true, required: false })}${field("关联项目", "projectId", "", { full: true, select: projectOptions(existing?.projectId || ""), required: false })}</div>`;
  }

  return `<div class="modal-backdrop" data-action="close-modal-backdrop"><section class="modal ${wide}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header class="modal-head"><div class="modal-head-copy"><h2 id="modal-title">${title}</h2><p>${subtitle}</p></div><button class="icon-button" data-action="close-modal" aria-label="关闭">${icon("close")}</button></header><form id="record-form" data-kind="${kind}" data-id="${esc(id || "")}"><div class="modal-body">${form}</div><footer class="modal-foot"><button class="button" type="button" data-action="close-modal">取消</button><button class="button primary" type="submit">${isEdit ? "保存修改" : kind === "decision" ? "保存决策" : "保存"}</button></footer></form></section></div>`;
}

function render() {
  const page = ui.page === "home" ? renderDashboard() : ui.page === "projects" ? renderProjects() : ui.page === "project" ? renderProjectDetail() : ui.page === "tasks" ? renderTasks() : ui.page === "knowledge" ? renderKnowledge() : renderDecisions();
  app.innerHTML = `${renderNav()}<main class="main-shell"><header class="topbar"><div class="breadcrumbs"><span>Daniel Workspace</span><span class="crumb-sep">/</span><strong>${esc(pageTitle())}</strong></div><div class="search-wrap"><div class="search-box">${icon("search")}<input id="global-search" type="search" value="${esc(ui.query)}" placeholder="搜索项目、资料、决策或任务…" autocomplete="off" aria-label="全局搜索"/><kbd class="search-hint">Ctrl K</kbd></div><div id="search-results"></div></div><div class="topbar-actions"><span class="today-label">${formattedDate()}</span><button class="icon-button" data-action="open-assistant" title="打开 AI Assistant" aria-label="打开 AI Assistant">${icon("sparkle")}</button><span class="top-avatar">D</span></div></header><div class="content">${page}</div></main>${renderAssistant()}${renderModal()}<div class="toast-region" id="toast-region" aria-live="polite"></div>`;
  renderSearchResults();
  if (ui.assistantOpen) document.querySelector("#assistant-messages")?.scrollTo({ top: 999999, behavior: "smooth" });
}

function toast(message) {
  const region = document.querySelector("#toast-region");
  if (!region) return;
  const element = document.createElement("div");
  element.className = "toast";
  element.innerHTML = `${icon("checkSquare")}<span>${esc(message)}</span>`;
  region.append(element);
  setTimeout(() => element.remove(), 2800);
}

function openModal(kind, id = null, projectId = null) {
  ui.modal = { kind, id, projectId };
  render();
  document.querySelector(".modal input, .modal textarea")?.focus({ preventScroll: true });
}

function mockReply(message) {
  const text = message.toLocaleLowerCase();
  if (ui.page === "project") {
    const project = projectById(ui.projectId);
    if (!project) return "先从 Projects 里打开一个项目，我就可以根据它的资料和任务回答。";
    const tasks = db.tasks.filter((task) => task.projectId === project.id);
    const pending = tasks.filter((task) => task.status !== "done");
    const knowledge = db.knowledge.filter((item) => item.projectId === project.id);
    const decision = db.decisions.find((item) => item.projectId === project.id);
    if (/下一步|next|建议|做什么/.test(text)) return `「${project.name}」目前处于${project.stage || "阶段未设置"}阶段。项目记录的下一步是：${project.next || "还没有写下一步"}。${pending[0] ? `最近的待办是「${pending[0].title}」。` : "当前没有未完成任务。"}`;
    if (/决定|选择|决策/.test(text) && decision) return `这个项目最近的决策是：${decision.question}\n最终选择：${decision.final || "尚未决定"}\n原因：${decision.reason || "尚未填写"}`;
    return `「${project.name}」当前状态：${project.status} · ${project.stage || "阶段未设置"}。\n${project.description || "项目还没有简介。"}\n待办 ${pending.length} 项，关联资料 ${knowledge.length} 条。${project.next ? `\n下一步：${project.next}` : ""}`;
  }
  if (/下一步|next|优先|做什么/.test(text)) {
    const task = suggestionTask();
    return task ? `建议先处理「${task.title}」（${task.priority}优先级，关联项目：${projectTitle(task.projectId)}）。\n完成后再从 ${openTasks().length - 1} 项待办中选下一件。` : "你现在没有未完成任务。可以回顾项目的下一步，或新建一条任务。";
  }
  if (ui.page === "decisions" || /整理|决定|决策/.test(text)) {
    const decision = ui.page === "decisions" ? db.decisions[0] : db.decisions.find((item) => item.projectId === ui.projectId) || db.decisions[0];
    return decision ? `我根据现有记录整理了一下：\n问题：${decision.question}\n目标：${decision.goal || "未记录"}\n方案：${decision.options.join("；") || "未记录"}\nMock 建议：${decision.recommendation || "未记录"}\n最终决定：${decision.final || "待定"}\n原因：${decision.reason || "未记录"}` : "还没有历史决策。先新建一条决策，记录问题、选项和目标，我就能帮你整理。";
  }
  if (ui.page === "knowledge") {
    const latest = [...db.knowledge].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4);
    return latest.length ? `当前收件箱有 ${db.knowledge.length} 条资料。最近几条：\n${latest.map((item, index) => `${index + 1}. ${item.title} — ${item.summary || item.content.slice(0, 48)}`).join("\n")}` : "收件箱目前是空的。你可以先添加文本、笔记或链接。";
  }
  if (ui.page === "tasks") return `目前有 ${openTasks().length} 项未完成任务，${db.tasks.length - openTasks().length} 项已经完成。${suggestionTask() ? `\n优先级最高的是「${suggestionTask().title}」。` : ""}你可以用状态筛选来只看待办或已完成。`;
  const latestActivity = db.activities[0];
  return `现在有 ${db.projects.length} 个项目、${openTasks().length} 项待办、${db.knowledge.length} 条资料和 ${db.decisions.length} 条决策。${suggestionTask() ? `\n建议先推进「${suggestionTask().title}」。` : ""}${latestActivity ? `\n最近活动：${latestActivity.title}` : ""}`;
}

function sendChat(message) {
  const clean = message.trim();
  if (!clean) return;
  ui.chat.push({ role: "user", text: clean }, { role: "assistant", text: mockReply(clean) });
  ui.assistantOpen = true;
  render();
}

function submitRecord(form) {
  const data = new FormData(form);
  const values = Object.fromEntries(data.entries());
  const kind = form.dataset.kind;
  const id = form.dataset.id;
  const existing = id ? ({ project: projectById(id), task: db.tasks.find((x) => x.id === id), knowledge: db.knowledge.find((x) => x.id === id), decision: db.decisions.find((x) => x.id === id) })[kind] : null;
  const now = new Date().toISOString();

  if (kind === "project") {
    const item = { ...values, id: existing?.id || uid("project"), createdAt: existing?.createdAt || now, status: values.status || "计划中" };
    if (existing) Object.assign(existing, item);
    else { db.projects.unshift(item); logActivity("project-created", `创建项目「${item.name}」`, item.id); }
    ui.page = "project"; ui.projectId = item.id;
    history.replaceState({ page: "project", projectId: item.id }, "", `#project/${encodeURIComponent(item.id)}`);
  } else if (kind === "task") {
    const item = { ...values, id: existing?.id || uid("task"), status: existing?.status || "todo", createdAt: existing?.createdAt || now };
    if (existing) Object.assign(existing, item);
    else { db.tasks.unshift(item); logActivity("task-added", `创建任务「${item.title}」`, item.projectId || null); }
  } else if (kind === "knowledge") {
    const item = { ...values, id: existing?.id || uid("knowledge"), tags: values.tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean), createdAt: existing?.createdAt || now };
    if (existing) Object.assign(existing, item);
    else { db.knowledge.unshift(item); logActivity("knowledge-added", `新增资料「${item.title}」`, item.projectId || null); }
  } else if (kind === "decision") {
    const options = values.options.split(/\r?\n/).map((option) => option.trim()).filter(Boolean);
    const recommendation = recommendationFor(options, values.goal, values.risk);
    const item = { ...values, options, recommendation, id: existing?.id || uid("decision"), createdAt: existing?.createdAt || now };
    if (existing) Object.assign(existing, item);
    else { db.decisions.unshift(item); logActivity("decision-saved", `保存决策「${item.question}」`, item.projectId || null); }
    ui.page = "decisions";
  }
  persist();
  ui.modal = null;
  render();
  toast(existing ? "修改已保存" : ({ project: "项目已创建", task: "任务已创建", knowledge: "资料已保存", decision: "决策已保存" })[kind]);
}

function handleSearchResult(kind, id) {
  ui.query = "";
  if (kind === "project") go("project", id);
  if (kind === "knowledge") go("knowledge");
  if (kind === "decision") go("decisions");
  if (kind === "task") go("tasks");
}

function handleAction(action, element, sourceEvent) {
  const id = element.dataset.id;
  if (action === "open-create-project") openModal("project");
  if (action === "open-create-task") openModal("task", null, element.dataset.projectId || null);
  if (action === "open-create-knowledge") openModal("knowledge", null, element.dataset.projectId || null);
  if (action === "open-create-decision") openModal("decision");
  if (action === "edit-project") openModal("project", id);
  if (action === "edit-task") openModal("task", id);
  if (action === "edit-knowledge") openModal("knowledge", id);
  if (action === "edit-decision") openModal("decision", id);
  if (action === "view-project") go("project", id);
  if (action === "view-decision") { ui.expandedDecisionId = id; go("decisions"); }
  if (action === "toggle-decision") { ui.expandedDecisionId = ui.expandedDecisionId === id ? null : id; render(); }
  if (action === "open-search-result") handleSearchResult(element.dataset.kind, id);
  if (action === "filter-tasks") { ui.taskFilter = element.dataset.filter; render(); }
  if (action === "toggle-task") {
    const task = db.tasks.find((item) => item.id === id);
    if (task) {
      task.status = task.status === "done" ? "todo" : "done";
      if (task.status === "done") logActivity("task-done", `完成任务「${task.title}」`, task.projectId || null);
      persist(); render(); toast(task.status === "done" ? "任务已完成" : "任务已重新打开");
    }
  }
  if (action === "delete-knowledge") {
    const item = db.knowledge.find((record) => record.id === id);
    if (item && window.confirm(`确定删除资料「${item.title}」吗？此操作无法撤销。`)) {
      db.knowledge = db.knowledge.filter((record) => record.id !== id); persist(); render(); toast("资料已删除");
    }
  }
  if (action === "close-modal" || action === "close-modal-backdrop") {
    if (action === "close-modal-backdrop" && element !== sourceEvent?.target) return;
    ui.modal = null; render();
  }
  if (action === "open-assistant") { ui.assistantOpen = true; render(); document.querySelector("#assistant-input")?.focus(); }
  if (action === "close-assistant") { ui.assistantOpen = false; render(); }
  if (action === "clear-chat") { ui.chat = [{ role: "assistant", text: "对话已清空。我会继续根据你当前打开的页面和本地数据回答。" }]; render(); }
  if (action === "send-prompt") sendChat(element.dataset.prompt || "");
  if (action === "reset-demo") {
    if (window.confirm("重置会清除这个浏览器中保存的自定义内容，并恢复演示数据。确定继续吗？")) {
      db = resetData(); ui.page = "home"; ui.projectId = null; ui.taskFilter = "all"; ui.query = ""; ui.chat = [{ role: "assistant", text: "演示数据已恢复。你可以从当前页面开始提问。" }]; ui.modal = null; persist(); render(); toast("演示数据已恢复");
    }
  }
}

app.addEventListener("click", (event) => {
  const element = event.target.closest("[data-action], [data-page]");
  if (!element) return;
  if (element.dataset.page) { go(element.dataset.page); return; }
  handleAction(element.dataset.action, element, event);
});

app.addEventListener("keydown", (event) => {
  const target = event.target.closest('[data-action="view-project"], [data-action="view-decision"], [data-action="toggle-decision"]');
  if (target && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); handleAction(target.dataset.action, target); }
  if (event.target.id === "global-search" && event.key === "Enter") {
    event.preventDefault();
    const first = searchItems(ui.query)[0];
    if (first) handleSearchResult(first.kind, first.id);
  }
  if (event.key === "Escape") {
    if (ui.modal) { ui.modal = null; render(); }
    else if (ui.assistantOpen) { ui.assistantOpen = false; render(); }
    else if (ui.searchOpen) { ui.searchOpen = false; renderSearchResults(); }
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); document.querySelector("#global-search")?.focus(); }
});

app.addEventListener("input", (event) => {
  if (event.target.id === "global-search") {
    ui.query = event.target.value;
    ui.searchOpen = true;
    renderSearchResults();
  }
  if (event.target.closest("#record-form")?.dataset.kind === "decision") {
    const form = event.target.closest("form");
    const values = Object.fromEntries(new FormData(form).entries());
    const recommendation = form.querySelector("#decision-recommendation");
    if (recommendation) recommendation.textContent = recommendationFor((values.options || "").split(/\r?\n/).map((value) => value.trim()), values.goal, values.risk);
  }
});

app.addEventListener("focusin", (event) => {
  if (event.target.id === "global-search") { ui.searchOpen = Boolean(ui.query.trim()); renderSearchResults(); }
});
app.addEventListener("focusout", (event) => {
  if (event.target.id === "global-search") setTimeout(() => { if (!document.activeElement?.closest("#search-results")) { ui.searchOpen = false; renderSearchResults(); } }, 160);
});

app.addEventListener("submit", (event) => {
  event.preventDefault();
  if (event.target.id === "record-form") {
    submitRecord(event.target);
  } else if (event.target.id === "assistant-form") {
    const input = event.target.elements.message;
    const message = input.value;
    input.value = "";
    sendChat(message);
  }
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); document.querySelector("#global-search")?.focus(); }
});

const initialProjectRoute = location.hash.match(/^#project\/(.+)$/);
if (initialProjectRoute) {
  try {
    const id = decodeURIComponent(initialProjectRoute[1]);
    if (projectById(id)) { ui.page = "project"; ui.projectId = id; }
  } catch { /* Ignore malformed local routes. */ }
} else {
  const initialPage = location.hash.slice(1);
  if (["home", "projects", "knowledge", "decisions", "tasks"].includes(initialPage)) ui.page = initialPage;
}

render();
