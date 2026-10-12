import { renderDashboardLayout } from "./dashboard-layout.js?v=3.8-a";
import { resolveActivityRange, shiftDateKey, shanghaiDateKey } from "./home-activity.js?v=3.8-a";

const WORKER_BASE = "https://daniel-workspace-api.ai-investment-dashboard.workers.dev";
const ACTIVITY_REPOSITORIES = Object.freeze([
  { id: "workspace", name: "Daniel Workspace", fullName: "danielsxujiacong-cell/daniel-workspace" },
  { id: "portfolio", name: "个人作品集", fullName: "danielsxujiacong-cell/personal-portfolio" },
  { id: "investment-dashboard", name: "AI 投资看板", fullName: "danielsxujiacong-cell/AI-investment-dashboard" },
]);

const PUBLIC_PROJECTS = Object.freeze([
  {
    id: "workspace", name: "Daniel Workspace", status: "线上作品",
    summary: "公开只读项目指挥中心；登录后进入私人工作台。",
    details: "把项目、任务和工作记录集中到一处，并用基于真实来源的 Dashboard 查看进展。公开页面只显示经过白名单筛选的项目与 GitHub 聚合统计。",
    websiteUrl: "https://workspace.danielxu.cn/",
    repositoryUrl: "https://github.com/danielsxujiacong-cell/daniel-workspace",
    features: ["公开只读 Dashboard 与私人登录工作台共用布局。", "公开活动图只显示已确认公开仓库的每日提交数。"],
  },
  {
    id: "project-hub", name: "Daniel Project Hub", status: "线上作品",
    summary: "AI 产品、网站与实验作品的公开导航站。",
    details: "作品导航站已发布，可从目录进入各个可公开体验的项目。",
    websiteUrl: "https://hub.danielxu.cn/",
    repositoryUrl: "",
    features: ["按类别浏览公开作品。", "为 FlowOps 模拟流程提供独立入口。"],
  },
  {
    id: "flowops", name: "FlowOps AI", status: "模拟演示", simulated: true,
    summary: "采购流程交互演示，所有工单与运营信息均为虚构样例。",
    details: "演示回放正常批准、审批拒绝和重复事件。它不连接真实客户、团队或生产系统。",
    websiteUrl: "https://hub.danielxu.cn/flowops",
    repositoryUrl: "",
    features: ["查看流程步骤、规则判定与处置结果。", "演示中的业务数据只用于模拟交互。"],
  },
  {
    id: "portfolio", name: "Daniel Xu 个人作品集", status: "线上作品",
    summary: "通过滚动交互和 3D 场景展示个人作品。",
    details: "已发布的个人作品集网站，以单页叙事呈现设计与开发实践。",
    websiteUrl: "https://danielxu.cn/",
    repositoryUrl: "https://github.com/danielsxujiacong-cell/personal-portfolio",
    features: ["滚动时切换页面章节。", "用 3D 场景呈现视觉主题。"],
  },
  {
    id: "investment-dashboard", name: "AI 投资看板", status: "公开源码",
    summary: "公开代码仓库中的投资数据与研究看板项目。",
    details: "这里只链接到 GitHub 已确认公开的代码仓库；不展示个人账户、持仓或运行数据。",
    websiteUrl: "",
    repositoryUrl: "https://github.com/danielsxujiacong-cell/AI-investment-dashboard",
    features: ["查看公开仓库的代码与项目说明。"],
  },
]);

const STATUS_COLORS = { "线上作品": "#4b907b", "模拟演示": "#c38c4d", "公开源码": "#6e63d8" };
const CHART_COLORS = ["#6e63d8", "#958be7", "#527d9f", "#4b907b", "#c38c4d"];

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function validDateKey(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

export function sanitizePublicActivity(payload, now = Date.now()) {
  const expected = resolveActivityRange("30d", { now });
  const period = payload?.period;
  if (!period || !validDateKey(period.startDate) || !validDateKey(period.endDate)
    || period.startDate !== expected.startDate || period.endDate !== expected.endDate) return null;

  const allowedById = new Map(ACTIVITY_REPOSITORIES.map((item) => [item.id, item]));
  const allowedResults = new Map();
  for (const result of (Array.isArray(payload.repositories) ? payload.repositories : []).slice(0, ACTIVITY_REPOSITORIES.length + 5)) {
    const repository = allowedById.get(result?.projectId);
    if (!repository || allowedResults.has(repository.id)) continue;
    const dailyCounts = new Map();
    for (const entry of Array.isArray(result.dailyCounts) ? result.dailyCounts : []) {
      if (!validDateKey(entry?.date) || entry.date < period.startDate || entry.date > period.endDate) continue;
      if (!Number.isSafeInteger(entry.count) || entry.count < 0 || entry.count > 100_000) continue;
      if (!dailyCounts.has(entry.date)) dailyCounts.set(entry.date, entry.count);
    }
    allowedResults.set(repository.id, { complete: result.complete === true && result.truncated !== true, dailyCounts });
  }

  const complete = allowedResults.size === ACTIVITY_REPOSITORIES.length
    && [...allowedResults.values()].every((result) => result.complete);
  const days = [];
  for (let date = period.startDate; date <= period.endDate; date = shiftDateKey(date, 1)) {
    const repositories = ACTIVITY_REPOSITORIES.flatMap((repository) => {
      const result = allowedResults.get(repository.id);
      return result?.dailyCounts.get(date) ? [{ id: repository.id, name: repository.name, count: result.dailyCounts.get(date) }] : [];
    });
    days.push({ date, commits: repositories.reduce((sum, item) => sum + item.count, 0), repositories, partial: !complete });
  }
  return {
    startDate: period.startDate,
    endDate: period.endDate,
    complete,
    completeRepositories: [...allowedResults.values()].filter((result) => result.complete).length,
    repositoryCount: ACTIVITY_REPOSITORIES.length,
    commits: days.reduce((sum, day) => sum + day.commits, 0),
    activeDays: days.filter((day) => day.commits > 0).length,
    days,
  };
}

function renderStats(activity) {
  const total = activity?.commits ?? null;
  const cards = [
    ["公开项目", PUBLIC_PROJECTS.length, "精选公开清单"],
    ["线上入口", PUBLIC_PROJECTS.filter((project) => project.status === "线上作品").length, "已发布网站"],
    ["模拟演示", PUBLIC_PROJECTS.filter((project) => project.simulated).length, "虚构样例数据"],
    ["近 30 天 Commit", total === null ? "—" : `${activity.complete ? "" : "≥ "}${total}`, activity ? `${activity.activeDays} 个活跃日` : "读取公开 GitHub 活动"],
  ];
  return `<section class="dashboard-overview grid-span-12" aria-label="公开项目指挥中心"><div class="dashboard-home-title"><div class="eyebrow">DANIEL WORKSPACE · PROJECT CONTROL CENTER</div><h1>项目指挥中心</h1><p class="public-dashboard-intro">公开只读视图 · 仅统计精选公开项目与公开仓库</p></div><div class="dashboard-stat-row">${cards.map(([label, value, note]) => `<article class="dashboard-stat-card"><span class="dashboard-stat-label">${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small class="dashboard-stat-link">${escapeHtml(note)}</small></article>`).join("")}</div></section>`;
}

function renderPublicHeatmap(activity, selectedDate, error = "") {
  if (!activity) return `<section class="card dashboard-chart-card dashboard-heatmap-card grid-span-12"><header class="dashboard-chart-heading"><div><h2>近 30 天开发活动</h2><p>GitHub 公开仓库 Commit</p></div></header><p class="dashboard-activity-status ${error ? "warning" : ""}" role="status">${escapeHtml(error || "正在读取公开仓库活动…")}</p><div class="dashboard-chart-empty">${error ? "项目与公开入口仍可浏览；活动统计暂不可用" : "活动统计加载中"}</div></section>`;
  const maximum = Math.max(1, ...activity.days.map((day) => day.commits));
  const weeks = [];
  let week = Array(7).fill(null);
  for (const day of activity.days) {
    const weekday = (new Date(`${day.date}T00:00:00.000Z`).getUTCDay() + 6) % 7;
    if (weekday === 0 && week.some(Boolean)) { weeks.push(week); week = Array(7).fill(null); }
    week[weekday] = day;
    if (weekday === 6) { weeks.push(week); week = Array(7).fill(null); }
  }
  if (week.some(Boolean)) weeks.push(week);
  const cells = weeks.flatMap((days, weekIndex) => days.map((day, weekday) => {
    if (!day) return `<span class="dashboard-heatmap-spacer" aria-hidden="true" data-week="${weekIndex}" data-weekday="${weekday}"></span>`;
    const level = day.commits ? Math.max(1, Math.min(4, Math.ceil(day.commits / maximum * 4))) : 0;
    const label = `${day.date} · ${activity.complete ? "" : "已读取 "}${day.commits} 条公开 Commit`;
    return `<button type="button" class="dashboard-heatmap-cell ${day.partial && !day.commits ? "unknown" : `level-${level}`}${selectedDate === day.date ? " selected" : ""}" data-action="select-public-day" data-date="${day.date}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}"></button>`;
  })).join("");
  const chosen = activity.days.find((day) => day.date === selectedDate);
  const detail = chosen
    ? `<div class="dashboard-activity-day-detail"><div><strong>${escapeHtml(chosen.date)}</strong><span>${activity.complete ? "公开仓库 Commit" : "已读取公开仓库 Commit"} ${chosen.commits} 条</span></div>${chosen.repositories.length ? `<p>${chosen.repositories.map((item) => `${escapeHtml(item.name)}（${item.count}）`).join("、")}</p>` : `<p>${activity.complete ? "所选公开仓库在这一天没有提交。" : "部分仓库历史读取不完整，不能确认这一天没有提交。"}</p>`}</div>`
    : `<p class="dashboard-activity-day-hint">悬停或点击日期，查看公开仓库提交数量。</p>`;
  const status = activity.complete
    ? `已读取 ${activity.completeRepositories}/${activity.repositoryCount} 个白名单公开仓库`
    : `历史读取不完整：${activity.completeRepositories}/${activity.repositoryCount} 个白名单公开仓库已完整读取；空白日期不按零解释`;
  return `<section class="card dashboard-chart-card dashboard-heatmap-card grid-span-12"><header class="dashboard-chart-heading"><div><h2>近 30 天开发活动</h2><p>${escapeHtml(activity.startDate)} 至 ${escapeHtml(activity.endDate)} · GitHub 公开仓库 Commit</p></div></header><p class="dashboard-activity-status ${activity.complete ? "" : "warning"}" role="status">${escapeHtml(status)}</p><div class="dashboard-activity-metrics"><span class="activity-metric"><strong>${activity.complete ? "" : "≥ "}${activity.commits}</strong><small>${activity.complete ? "公开 Commit" : "已读取公开 Commit"}</small></span><span class="activity-metric"><strong>${activity.complete ? "" : "≥ "}${activity.activeDays}</strong><small>${activity.complete ? "活跃日期" : "已确认活跃日期"}</small></span></div><div class="dashboard-heatmap-scroll"><div class="dashboard-heatmap-layout"><div class="dashboard-heatmap-weekdays" aria-hidden="true"><span>一</span><span></span><span>三</span><span></span><span>五</span><span></span><span>日</span></div><div class="dashboard-heatmap-grid" style="--heatmap-weeks:${weeks.length}">${cells}</div></div></div><div class="dashboard-heatmap-legend"><span>少</span><i class="level-0"></i><i class="level-1"></i><i class="level-2"></i><i class="level-3"></i><i class="level-4"></i><span>多</span><span class="unknown-key">斜纹表示历史不完整</span></div>${detail}<p class="dashboard-chart-footnote">仅汇总白名单公开仓库的 Commit 数；不读取 Commit 原文、工作记录或私人表。</p></section>`;
}

function renderPublicTrend(activity, error = "") {
  if (!activity) return `<section class="card dashboard-chart-card dashboard-trend-card grid-span-7"><header class="dashboard-chart-heading"><div><h2>活动趋势</h2><p>公开仓库每日 Commit 数</p></div></header><div class="dashboard-chart-empty">${error ? "公开活动统计暂不可用" : "活动统计加载中"}</div></section>`;
  const width = 780, height = 190, left = 38, right = 10, top = 12, bottom = 27;
  const chartHeight = height - top - bottom, chartWidth = width - left - right;
  const maxValue = Math.max(1, ...activity.days.map((day) => day.commits));
  const slot = chartWidth / activity.days.length, barWidth = Math.max(1, slot * 0.68);
  const ticks = Math.min(6, activity.days.length);
  const tickIndexes = [...new Set(Array.from({ length: ticks }, (_, index) => Math.round(index * (activity.days.length - 1) / Math.max(1, ticks - 1))))];
  const grid = [0, 0.5, 1].map((ratio) => {
    const y = top + chartHeight * (1 - ratio);
    return `<line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}" class="dashboard-trend-gridline"/><text x="${left - 9}" y="${y + 3}" class="dashboard-trend-y-label">${Math.round(maxValue * ratio)}</text>`;
  }).join("");
  const bars = activity.days.map((day, index) => {
    const x = left + index * slot + (slot - barWidth) / 2;
    const barHeight = day.commits * chartHeight / maxValue;
    return `<rect x="${x.toFixed(2)}" y="${(top + chartHeight - barHeight).toFixed(2)}" width="${barWidth.toFixed(2)}" height="${barHeight.toFixed(2)}" rx="1" class="dashboard-trend-bar github"${day.partial ? " opacity=\".72\"" : ""}><title>${escapeHtml(`${day.date} · ${day.commits} 条公开 Commit`)}</title></rect>`;
  }).join("");
  const xLabels = tickIndexes.map((index) => {
    const day = activity.days[index];
    const x = left + index * slot + slot / 2;
    return `<text x="${x.toFixed(2)}" y="${height - 8}" text-anchor="middle" class="dashboard-trend-x-label">${escapeHtml(day.date.slice(5))}</text>`;
  }).join("");
  return `<section class="card dashboard-chart-card dashboard-trend-card grid-span-7"><header class="dashboard-chart-heading"><div><h2>活动趋势</h2><p>公开仓库每日 Commit 数</p></div></header><div class="dashboard-trend-legend"><span><i class="github"></i>GitHub 公开 Commit</span></div><div class="dashboard-trend-scroll"><svg class="dashboard-trend-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(`近 30 天每日公开 GitHub Commit 趋势，共 ${activity.commits} 条${activity.complete ? "" : "已读取"}`)}">${grid}${bars}${xLabels}</svg></div><p class="dashboard-chart-footnote">${activity.complete ? "" : "历史读取不完整；缺失记录不作为零活动解读。"}只显示每日汇总。</p></section>`;
}

function renderPublicStatus() {
  const counts = new Map();
  for (const project of PUBLIC_PROJECTS) counts.set(project.status, (counts.get(project.status) || 0) + 1);
  const breakdown = [...counts.entries()].map(([label, count]) => ({ label, count }));
  const total = PUBLIC_PROJECTS.length, radius = 54, circumference = 2 * Math.PI * radius;
  let offset = 0;
  const slices = breakdown.map((item, index) => {
    const length = circumference * item.count / total;
    const color = STATUS_COLORS[item.label] || CHART_COLORS[index % CHART_COLORS.length];
    const ring = `<circle cx="76" cy="76" r="${radius}" fill="none" stroke="${color}" stroke-width="18" stroke-dasharray="${length.toFixed(2)} ${(circumference - length).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}"><title>${escapeHtml(`${item.label} ${item.count} 个公开项目`)}</title></circle>`;
    offset += length;
    return ring;
  }).join("");
  const legend = breakdown.map((item) => `<li><i style="--status-color:${STATUS_COLORS[item.label]}"></i><span>${escapeHtml(item.label)}</span><strong>${item.count}</strong><small>${Math.round(item.count / total * 100)}%</small></li>`).join("");
  return `<section class="card dashboard-chart-card dashboard-status-card grid-span-5"><header class="dashboard-chart-heading"><div><h2>项目状态</h2><p>仅按公开入口与公开仓库分类</p></div></header><div class="dashboard-status-body"><svg class="dashboard-status-donut" viewBox="0 0 152 152" role="img" aria-label="${escapeHtml(`${total} 个精选公开项目的公开状态分类`)}"><circle cx="76" cy="76" r="${radius}" fill="none" stroke="var(--line)" stroke-width="18"/>${slices}<text x="76" y="73" class="dashboard-donut-total">${total}</text><text x="76" y="91" class="dashboard-donut-label">公开项目</text></svg><ul class="dashboard-status-legend">${legend}</ul></div><p class="dashboard-chart-footnote">不展示私人工作区中保存的项目状态或阶段。</p></section>`;
}

function projectLinks(project) {
  const links = [];
  if (project.websiteUrl) links.push(`<a class="button quiet small" href="${escapeHtml(project.websiteUrl)}" target="_blank" rel="noopener noreferrer">${project.simulated ? "打开模拟演示" : "体验网站"}</a>`);
  if (project.repositoryUrl) links.push(`<a class="button quiet small" href="${escapeHtml(project.repositoryUrl)}" target="_blank" rel="noopener noreferrer">查看公开源码</a>`);
  return links.join("");
}

function renderFocusProjects() {
  const cards = PUBLIC_PROJECTS.map((project) => `<article class="dashboard-focus-card"><header class="dashboard-focus-card-header"><strong class="dashboard-focus-name">${escapeHtml(project.name)}</strong><span class="status-pill">${escapeHtml(project.status)}</span></header><div class="dashboard-focus-card-details"><p class="public-project-summary">${escapeHtml(project.summary)}</p><details class="public-project-detail"><summary>查看公开项目详情</summary><p>${escapeHtml(project.details)}</p><ul>${project.features.map((feature) => `<li>${escapeHtml(feature)}</li>`).join("")}</ul></details>${project.simulated ? `<small class="public-simulation-note">模拟操作 · 虚构数据，不连接真实业务系统</small>` : ""}</div><footer class="dashboard-focus-card-footer">${projectLinks(project)}</footer></article>`).join("");
  return `<section class="dashboard-focus-section grid-span-12" aria-labelledby="dashboard-focus-title"><div class="dashboard-focus-heading"><h2 id="dashboard-focus-title">重点公开项目</h2><span class="muted">${PUBLIC_PROJECTS.length} 个白名单项目</span></div><div class="dashboard-focus-grid">${cards}</div></section>`;
}

function renderPublicContent(state) {
  const activity = state.activity;
  return renderDashboardLayout([
    renderStats(activity),
    renderPublicHeatmap(activity, state.selectedDate, state.activityError),
    renderPublicTrend(activity, state.activityError),
    renderPublicStatus(),
    renderFocusProjects(),
    `<section class="public-data-note grid-span-12"><strong>公开数据说明</strong><span>项目详情来自静态白名单；开发活动只读取三个已确认公开的 GitHub 仓库并仅返回每日计数。工作记录、私人项目、账号资料和密钥不会进入此页面。</span></section>`,
  ]);
}

export function mountPublicDashboard({ root } = {}) {
  const state = { activity: null, selectedDate: "" };
  let active = true;
  const render = () => {
    root.innerHTML = `<main class="main-shell public-dashboard-shell"><header class="topbar"><div class="breadcrumbs"><span>Daniel Workspace</span><span class="crumb-sep">/</span><strong>项目指挥中心</strong></div><div class="topbar-actions"><span class="today-label">公开只读</span><a class="button quiet small public-login-link" href="?mode=login">登录</a></div></header><div class="content">${renderPublicContent(state)}</div></main>`;
  };
  root.addEventListener("click", (event) => {
    const cell = event.target.closest('[data-action="select-public-day"]');
    if (!cell) return;
    state.selectedDate = cell.dataset.date || "";
    render();
  });
  render();
  void (async () => {
    try {
      const response = await fetch(`${WORKER_BASE}/api/public/dashboard`, {
        method: "GET",
        credentials: "omit",
        cache: "default",
        referrerPolicy: "no-referrer",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`公开活动读取失败（HTTP ${response.status}）。`);
      const payload = await response.json();
      state.activity = sanitizePublicActivity(payload);
      if (!state.activity) throw new Error("公开活动响应校验失败。");
    } catch (error) {
      state.activity = null;
      state.activityError = typeof error?.message === "string" ? error.message : "公开活动暂不可用。";
    }
    if (active) render();
  })();
  return { destroy() { active = false; root.replaceChildren?.(); } };
}
