import { parsePublicGitHubRepository } from "./github/public-api.js";
import { shanghaiDateKey, shiftDateKey } from "./home-activity.js";

export const PROJECT_TYPES = ["AI 与数据", "自动化", "效率工具", "创作与展示", "其他"];

const TYPE_COLORS = {
  "AI 与数据": "#7869d8",
  "自动化": "#3d9d91",
  "效率工具": "#5b83c8",
  "创作与展示": "#c879a8",
  "其他": "#8b96aa",
};

const RELEASE_MILESTONES = [
  {
    id: "release-v4.0",
    date: "2026-10-14",
    kind: "版本",
    title: "V4.0 · Visual Command Center",
    detail: "项目星系、GitHub/Codex 双热力图、7×24 开发指纹、Treemap 与成果时间长河上线。",
    source: "CHANGELOG",
  },
  {
    id: "release-v3.8-c2",
    date: "2026-10-12",
    kind: "上线",
    title: "V3.8-C.2 · 访客快照上线",
    detail: "26 个项目的手动发布快照通过脱敏核验；只读访客页读取最新发布版本。",
    source: "CHANGELOG · HANDOFF",
  },
  {
    id: "release-v3.9",
    date: "2026-10-13",
    kind: "版本",
    title: "V3.9 · Dashboard 2.0 发布",
    detail: "双热力图、项目活跃排行与本机 Codex Token 汇总完成线上部署。",
    source: "CHANGELOG · HANDOFF",
  },
];

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function projectRepoKey(project) {
  return parsePublicGitHubRepository(project?.github)?.fullName?.toLowerCase() || "";
}

export function inferProjectType(project = {}) {
  const text = [project.name, project.description, project.notes, project.github, project.url]
    .map(cleanText).join(" ").toLocaleLowerCase();
  if (/投资|行情|市场|量化|investment|finance|stock|trading|数据分析|analytics/.test(text)) return "AI 与数据";
  if (/自动化|工作流|流程|n8n|automation|workflow/.test(text)) return "自动化";
  if (/工作台|项目管理|效率|dashboard|workspace|productivity|管理工具/.test(text)) return "效率工具";
  if (/作品集|作品展示|portfolio|creative|3d|游戏|game|视觉|艺术|design/.test(text)) return "创作与展示";
  if (/\bai\b|\bllm\b|\bagent\b|人工智能|大模型|智能助手|生成式/.test(text)) return "AI 与数据";
  return "其他";
}

function projectReferenceText(project, tasksByProject, logsByProject) {
  const values = [project.description, project.next, project.notes];
  values.push(...(tasksByProject.get(String(project.id)) || []));
  values.push(...(logsByProject.get(String(project.id)) || []));
  return values.map(cleanText).join("\n").toLowerCase();
}

function explicitlyReferencesRepository(text, repo) {
  if (!text || !repo) return false;
  const escaped = repo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:https?:\\/\\/)?(?:www\\.)?github\\.com\\/${escaped}(?=$|[\\s/#?.,;:)}\\]])`, "i").test(text);
}

export function buildProjectRelationships(projects = [], tasks = [], workLogs = []) {
  const rows = (Array.isArray(projects) ? projects : []).filter((item) => item?.id && item?.name);
  const tasksByProject = new Map();
  const logsByProject = new Map();
  for (const task of Array.isArray(tasks) ? tasks : []) {
    const id = String(task?.projectId || "");
    if (!id) continue;
    tasksByProject.set(id, [...(tasksByProject.get(id) || []), task.title, task.description]);
  }
  for (const log of Array.isArray(workLogs) ? workLogs : []) {
    const id = String(log?.projectId || "");
    if (!id) continue;
    // Evidence URLs and next-step text are intentionally excluded from relationship matching.
    logsByProject.set(id, [...(logsByProject.get(id) || []), log.completedItems, log.outcomes]);
  }
  const indexed = rows.map((project) => ({
    id: String(project.id),
    repo: projectRepoKey(project),
    text: projectReferenceText(project, tasksByProject, logsByProject),
  }));
  const links = [];
  for (let left = 0; left < indexed.length; left += 1) {
    for (let right = left + 1; right < indexed.length; right += 1) {
      const a = indexed[left];
      const b = indexed[right];
      const sharedRepository = Boolean(a.repo && a.repo === b.repo);
      const explicitReference = explicitlyReferencesRepository(a.text, b.repo) || explicitlyReferencesRepository(b.text, a.repo);
      if (sharedRepository || explicitReference) {
        links.push({ source: a.id, target: b.id, kind: sharedRepository ? "共享仓库" : "仓库引用" });
      }
    }
  }
  return links;
}

function stableProjectId(project) {
  return String(project.id || project.name || "");
}

export function buildProjectUniverse({ projects = [], activity = null, tasks = [], workLogs = [], width = 960, height = 420 } = {}) {
  const projectRows = (Array.isArray(projects) ? projects : []).filter((project) => project?.id && project?.name);
  const activityById = new Map((activity?.projectActivity || []).map((item) => [String(item.projectId), item]));
  const coverageById = new Map((activity?.projectCoverage || []).map((item) => [String(item.projectId), item]));
  const maxActivity = Math.max(0, ...[...activityById.values()].map((item) => item.githubCommits + item.workLogs));
  const sorted = [...projectRows].sort((a, b) => {
    const left = activityById.get(String(a.id));
    const right = activityById.get(String(b.id));
    return (right?.githubCommits + right?.workLogs || 0) - (left?.githubCommits + left?.workLogs || 0)
      || String(a.name).localeCompare(String(b.name), "zh-CN");
  });
  const centerX = width / 2;
  const centerY = height / 2;
  const orbitRadius = Math.min(width * 0.43, height * 0.39);
  const nodes = sorted.map((project, index) => {
    const row = activityById.get(String(project.id)) || { githubCommits: 0, workLogs: 0 };
    const score = row.githubCommits + row.workLogs;
    const angle = index * 2.399963229728653 - Math.PI / 2;
    const distance = index === 0 ? 0 : 20 + orbitRadius * Math.sqrt(index / Math.max(1, sorted.length - 1));
    const coverage = coverageById.get(String(project.id));
    return {
      project,
      id: String(project.id),
      category: inferProjectType(project),
      color: TYPE_COLORS[inferProjectType(project)],
      activity: row,
      score,
      coverage,
      x: centerX + Math.cos(angle) * distance,
      y: centerY + Math.sin(angle) * distance * 0.78,
      radius: 9 + (maxActivity ? Math.sqrt(score / maxActivity) * 20 : 0),
    };
  });
  const ids = new Set(nodes.map((item) => item.id));
  const edges = buildProjectRelationships(projectRows, tasks, workLogs)
    .filter((link) => ids.has(link.source) && ids.has(link.target))
    .map((link) => ({ ...link, from: nodes.find((node) => node.id === link.source), to: nodes.find((node) => node.id === link.target) }));
  const legend = PROJECT_TYPES.filter((type) => nodes.some((node) => node.category === type))
    .map((type) => ({ label: type, color: TYPE_COLORS[type], count: nodes.filter((node) => node.category === type).length }));
  return { width, height, nodes, edges, legend, linksCount: edges.length };
}

function splitRectangles(items, rect) {
  if (items.length <= 1) return items.map((item) => ({ item, ...rect }));
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let weightBefore = 0;
  let splitAt = 1;
  let bestGap = Infinity;
  for (let index = 1; index < items.length; index += 1) {
    weightBefore += items[index - 1].weight;
    const gap = Math.abs(total / 2 - weightBefore);
    if (gap < bestGap) { bestGap = gap; splitAt = index; }
  }
  const first = items.slice(0, splitAt);
  const second = items.slice(splitAt);
  const firstWeight = first.reduce((sum, item) => sum + item.weight, 0);
  const fraction = firstWeight / total;
  if (rect.width >= rect.height) {
    const leftWidth = rect.width * fraction;
    return [
      ...splitRectangles(first, { ...rect, width: leftWidth }),
      ...splitRectangles(second, { ...rect, x: rect.x + leftWidth, width: rect.width - leftWidth }),
    ];
  }
  const topHeight = rect.height * fraction;
  return [
    ...splitRectangles(first, { ...rect, height: topHeight }),
    ...splitRectangles(second, { ...rect, y: rect.y + topHeight, height: rect.height - topHeight }),
  ];
}

export function buildProjectTreemap(projects = [], { width = 960, height = 390 } = {}) {
  const groups = new Map();
  for (const project of Array.isArray(projects) ? projects : []) {
    if (!project?.id || !project?.name) continue;
    const type = inferProjectType(project);
    groups.set(type, [...(groups.get(type) || []), project]);
  }
  const categories = [...groups.entries()].map(([type, items]) => ({ type, items, weight: items.length }))
    .sort((a, b) => PROJECT_TYPES.indexOf(a.type) - PROJECT_TYPES.indexOf(b.type));
  const categoryRects = splitRectangles(categories, { x: 0, y: 0, width, height });
  const tiles = [];
  const groupBounds = [];
  for (const categoryRect of categoryRects) {
    groupBounds.push({ ...categoryRect, type: categoryRect.item.type, count: categoryRect.item.items.length, color: TYPE_COLORS[categoryRect.item.type] });
    const inset = 5;
    const inner = {
      x: categoryRect.x + inset,
      y: categoryRect.y + inset,
      width: Math.max(1, categoryRect.width - inset * 2),
      height: Math.max(1, categoryRect.height - inset * 2),
    };
    const projectItems = categoryRect.item.items.map((project) => ({ project, weight: 1 }));
    for (const rect of splitRectangles(projectItems, inner)) {
      tiles.push({
        ...rect,
        project: rect.item.project,
        category: categoryRect.item.type,
        color: TYPE_COLORS[categoryRect.item.type],
      });
    }
  }
  return {
    width,
    height,
    categories: categories.map(({ type, items }) => ({ type, count: items.length, color: TYPE_COLORS[type] })),
    groupBounds,
    tiles,
  };
}

function validWeekdayHourCounts(value) {
  return Array.isArray(value) && value.length === 168
    && new Set(value.map((item) => `${item?.weekday}:${item?.hour}`)).size === 168
    && value.every((item) => Number.isInteger(item?.weekday) && item.weekday >= 0 && item.weekday < 7
      && Number.isInteger(item?.hour) && item.hour >= 0 && item.hour < 24
      && Number.isSafeInteger(item?.count) && item.count >= 0);
}

export function weekdayHourMatrix(activity) {
  const model = activity?.model || activity;
  if (!model) return { available: false, complete: false, cells: [] };
  const counts = model.weekdayHourCounts || [];
  if (!validWeekdayHourCounts(counts)) return { available: false, complete: false, cells: [] };
  return {
    available: true,
    complete: model.coverage?.weekdayHourlyComplete === true,
    cells: counts,
  };
}

export function buildOutcomeTimeline({ workLogs = [], projects = [], now = Date.now(), days = 30 } = {}) {
  const endDate = shanghaiDateKey(now);
  const startDate = shiftDateKey(endDate, 1 - Math.max(1, Math.min(30, Number(days) || 30)));
  if (!startDate || !endDate) return [];
  const projectById = new Map((Array.isArray(projects) ? projects : []).map((project) => [String(project.id), project]));
  const releases = RELEASE_MILESTONES.filter((item) => item.date >= startDate && item.date <= endDate);
  const outcomes = (Array.isArray(workLogs) ? workLogs : []).flatMap((log, index) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(log?.workDate || "")) || log.workDate < startDate || log.workDate > endDate) return [];
    const completed = cleanText(log.completedItems);
    const outcome = cleanText(log.outcomes);
    const text = outcome || completed;
    if (!text) return [];
    const project = projectById.get(String(log.projectId || ""));
    let hash = 2166136261;
    for (const character of `${log.workDate}|${log.projectId || ""}|${text}`) hash = Math.imul(hash ^ character.codePointAt(0), 16777619);
    const id = `work-${log.workDate}-${(hash >>> 0).toString(36)}-${index}`;
    return [{
      id,
      date: log.workDate,
      kind: "成果",
      title: text.split(/[。！？\n]/, 1)[0].slice(0, 68) || text.slice(0, 68),
      detail: [completed, outcome].filter((item, position, list) => item && list.indexOf(item) === position).join(" · ").slice(0, 320),
      projectId: project?.id ? String(project.id) : "",
      projectName: project?.name || "Workspace",
      source: "工作记录",
    }];
  });
  return [...releases, ...outcomes]
    .sort((a, b) => a.date.localeCompare(b.date)
      || Number(a.kind === "成果") - Number(b.kind === "成果")
      || a.title.localeCompare(b.title, "zh-CN"));
}

export function projectActivityCount(projectId, activity) {
  const id = String(projectId || "");
  const row = (activity?.projectActivity || []).find((item) => String(item.projectId) === id);
  return row ? row.githubCommits + row.workLogs : 0;
}
