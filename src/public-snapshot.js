import { validateStaticSnapshot } from "./static-snapshot.js?v=4.5";
const WORKER_BASE = "https://daniel-workspace-api.ai-investment-dashboard.workers.dev";
export const PUBLIC_SNAPSHOT_VERSION = 1;
export const PUBLIC_SNAPSHOT_ACTIVITY_DAYS = 366;

export const PUBLIC_SNAPSHOT_COLLECTION_LABELS = Object.freeze({
  projects: "项目",
  tasks: "任务",
  workLogs: "工作记录",
  knowledge: "知识资料",
  decisions: "决策",
  githubActivity: "公开仓库活动",
  summaries: "已生成的 AI 简报/周报",
});

const SECRET_PATTERNS = [
  { pattern: /\b(?:Bearer\s+[A-Za-z0-9._~-]{12,}|(?:gh[pousr]_[A-Za-z0-9_]{16,}|github_pat_[A-Za-z0-9_]{16,}|sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}))\b/gi, replacement: "[密钥已隐藏]" },
  { pattern: /[\"']?\b(?:api[_-]?key|client[_-]?secret|secret|password|passwd|access[_-]?token|refresh[_-]?token|authorization|auth[_-]?(?:token|key|secret|credential)|user[_-]?id|session[_-]?id|token)\b[\"']?\s*[:=]\s*[\"']?[^\s\"'`,;}{]{1,}[\"']?/gi, replacement: "[认证信息已隐藏]" },
  { pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/gi, replacement: "[认证信息已隐藏]" },
  { pattern: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, replacement: "[账号标识已隐藏]" },
  { pattern: /(?:\b[A-Z]:[\\/][^<>:"|?*\r\n,;，；。!?)]*|\\\\[^\\\s]+\\[^<>:"|?*\r\n,;，；。!?)]*|\/(?:Users|home|private|Volumes|mnt)\/[^<>"'`\r\n,;，；。!?)]*)/gi, replacement: "[本机路径已隐藏]" },
  { pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, replacement: "[邮箱已隐藏]" },
  { pattern: /(?<!\d)(?:\+?86[-\s]?)?1[3-9]\d{9}(?!\d)/g, replacement: "[联系方式已隐藏]" },
  { pattern: /(?<!\d)(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}(?!\d)/g, replacement: "[联系方式已隐藏]" },
  { pattern: /(?<!\d)\+\d{1,3}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}(?!\d)/g, replacement: "[联系方式已隐藏]" },
  { pattern: /https?:\/\/(?:www\.)?github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+[^\s]*/gi, replacement: "[仓库地址已隐藏]" },
  { pattern: /https?:\/\/[^\s<>"')\]]+/gi, replacement: "[外部链接已隐藏]" },
  { pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/gi, replacement: "[私钥已隐藏]" },
];
const PRIVATE_FIELD_NAME = /(?:^|_)(?:password|passwd|secret|token|authorization|api_key|client_secret|credential|user_id|session_id|auth|email|phone|mobile|address|path)(?:_|$)/i;
const PRIVATE_SHARE_DOMAINS = ["drive.google.com", "docs.google.com", "dropbox.com", "notion.so", "linear.app", "figma.com", "1drv.ms", "onedrive.live.com", "sharepoint.com", "box.com", "slack.com", "atlassian.net", "airtable.com"];

function isPrivateShareHost(host) {
  return PRIVATE_SHARE_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

function isPrivateFieldName(value) {
  const normalized = String(value).replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`).toLowerCase();
  return PRIVATE_FIELD_NAME.test(normalized);
}

function normalizedText(value, maxLength = 8_000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function safePublicUrl(value, { allowGitHub = false } = {}) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password || url.port) return "";
    if (url.search || url.hash) return "";
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.includes(":")) return "";
    if (isPrivateShareHost(host)) return "";
    if (!allowGitHub && ["github.com", "www.github.com"].includes(host)) return "";
    return url.href;
  } catch { return ""; }
}

function scrubValue(value, fieldName, depth = 0) {
  if (depth > 5) return null;
  if (typeof value === "string") {
    let result = normalizedText(value, fieldName === "content" ? 20_000 : 8_000);
    for (const item of SECRET_PATTERNS) {
      item.pattern.lastIndex = 0;
      if (item.pattern.test(result)) {
        item.pattern.lastIndex = 0;
        result = result.replace(item.pattern, item.replacement);
      }
    }
    return result;
  }
  if (Array.isArray(value)) return value.slice(0, 100).map((item, index) => scrubValue(item, `${fieldName}[${index + 1}]`, depth + 1));
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([key]) => !isPrivateFieldName(key)).slice(0, 100)
      .map(([key, item]) => [key.slice(0, 80), scrubValue(item, `${fieldName}.${key}`, depth + 1)]));
  }
  return null;
}

function safeSnapshotItem(collection, index, sourceId, fields) {
  const safeFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (key === "url" || key === "github") {
      safeFields[key] = safePublicUrl(value, { allowGitHub: key === "github" });
      continue;
    }
    safeFields[key] = scrubValue(value, key);
  }
  return {
    safeId: `${collection}-${index + 1}`,
    sourceId: String(sourceId || ""),
    collection,
    fields: safeFields,
  };
}

function publicRepoSnapshot(repo) {
  const name = typeof repo?.repositoryName === "string" ? repo.repositoryName : typeof repo?.fullName === "string" ? repo.fullName : "";
  if (repo?.isPublic !== true || !/^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9_.-]{1,100}$/.test(name)) return null;
  return { name, url: `https://github.com/${name}`, isPublic: true };
}

export function createPublicSnapshotDraft({ data = {}, workLogs = [], publicRepositories = [], githubActivity = {}, summaries = {}, tokenUsage = null, now = new Date().toISOString(), activityRange = null } = {}) {
  const sourceProjects = Array.isArray(data.projects) ? data.projects : [];
  const projectNameById = new Map(sourceProjects.map((item) => [String(item.id || ""), normalizedText(item.name, 200)]));
  const publicRepos = new Map((Array.isArray(publicRepositories) ? publicRepositories : [])
    .map(publicRepoSnapshot).filter(Boolean).map((repo) => [repo.name.toLowerCase(), repo]));
  const projects = sourceProjects.map((project, index) => {
    const repoName = String(project.github || "").match(/github\.com\/([^/]+\/[^/?#]+)/i)?.[1]?.replace(/\.git$/i, "") || "";
    const verifiedRepo = publicRepos.get(repoName.toLowerCase());
    const fields = {
      name: project.name,
      description: project.description,
      status: project.status,
      stage: project.stage,
      next: project.next,
      url: project.url,
      github: verifiedRepo?.url || "",
      notes: project.notes,
      isPinned: Boolean(project.isPinned),
    };
    return safeSnapshotItem("projects", index, project.id, fields);
  });

  const projectSafeId = new Map(projects.map((item) => [item.sourceId, item.safeId]));
  const tasks = (Array.isArray(data.tasks) ? data.tasks : []).map((item, index) => safeSnapshotItem("tasks", index, item.id, {
    title: item.title,
    description: item.description,
    projectId: projectSafeId.get(String(item.projectId || "")) || "",
    status: item.status,
    priority: item.priority,
    due: item.due,
  }));
  const knowledge = (Array.isArray(data.knowledge) ? data.knowledge : []).map((item, index) => safeSnapshotItem("knowledge", index, item.id, {
    type: item.type,
    title: item.title,
    content: item.content,
    summary: item.summary,
    tags: item.tags,
    projectId: projectSafeId.get(String(item.projectId || "")) || "",
  }));
  const decisions = (Array.isArray(data.decisions) ? data.decisions : []).map((item, index) => safeSnapshotItem("decisions", index, item.id, {
    question: item.question,
    options: item.options,
    goal: item.goal,
    time: item.time,
    cost: item.cost,
    risk: item.risk,
    recommendation: item.recommendation,
    final: item.final,
    reason: item.reason,
    projectId: projectSafeId.get(String(item.projectId || "")) || "",
  }));
  const logs = (Array.isArray(workLogs) ? workLogs : []).map((item, index) => {
    return safeSnapshotItem("workLogs", index, item.id, {
      projectId: projectSafeId.get(String(item.projectId || "")) || "",
      projectName: projectNameById.get(String(item.projectId || "")) || "未关联项目",
      workDate: item.workDate,
      completedItems: item.completedItems,
      outcomes: item.outcomes,
      nextStep: item.nextStep,
      evidenceLinkCount: Array.isArray(item.evidenceLinks) ? item.evidenceLinks.length : 0,
    });
  });

  const githubActivityItems = [];
  const byName = new Map((Array.isArray(githubActivity.repositories) ? githubActivity.repositories : [])
    .map((item) => [String(item.fullName || "").toLowerCase(), item]));
  for (const [index, repo] of [...publicRepos.values()].entries()) {
    const activity = byName.get(repo.name.toLowerCase());
    if (!activity) continue;
    const projectIds = sourceProjects.filter((item) => String(item.github || "").toLowerCase().includes(`github.com/${repo.name.toLowerCase()}`)).map((item) => String(item.id || ""));
    const projectNames = projectIds.map((id) => projectNameById.get(id)).filter(Boolean);
    const safeProjectIds = projectIds.map((id) => projectSafeId.get(id)).filter(Boolean);
    const dailyCounts = (Array.isArray(activity.dailyCounts) ? activity.dailyCounts : [])
      .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.date) && Number.isSafeInteger(item.count) && item.count > 0)
      .map((item) => ({ date: item.date, count: item.count }));
    const hourlyCounts = Array.isArray(activity.hourlyCounts) && activity.hourlyCounts.length === 24
      && new Set(activity.hourlyCounts.map((item) => item?.hour)).size === 24
      && activity.hourlyCounts.every((item) => Number.isInteger(item?.hour) && item.hour >= 0 && item.hour < 24
        && Number.isSafeInteger(item?.count) && item.count >= 0)
      ? activity.hourlyCounts.map(({ hour, count }) => ({ hour, count }))
      : [];
    const weekdayHourCounts = Array.isArray(activity.weekdayHourCounts) && activity.weekdayHourCounts.length === 168
      && new Set(activity.weekdayHourCounts.map((item) => `${item?.weekday}:${item?.hour}`)).size === 168
      && activity.weekdayHourCounts.every((item) => Number.isInteger(item?.weekday) && item.weekday >= 0 && item.weekday < 7
        && Number.isInteger(item?.hour) && item.hour >= 0 && item.hour < 24
        && Number.isSafeInteger(item?.count) && item.count >= 0)
      ? activity.weekdayHourCounts.map(({ weekday, hour, count }) => ({ weekday, hour, count }))
      : [];
    githubActivityItems.push({
      safeId: `githubActivity-${index + 1}`,
      fields: { repository: repo.name, projectNames: projectNames.map((name) => safeSnapshotItem("githubActivity", index, repo.name, { name }).fields.name), projectIds: safeProjectIds, commits: dailyCounts.reduce((sum, item) => sum + item.count, 0), activeDays: dailyCounts.length, complete: activity.complete === true && activity.truncated !== true },
      dailyCounts,
      hourlyCounts,
      weekdayHourCounts,
    });
  }

  const summaryItems = [];
  if (summaries.dailyBrief?.status === "ready" && summaries.dailyBrief.value) {
    const item = safeSnapshotItem("summaries", 0, "dailyBrief", { type: "dailyBrief", title: "AI 今日简报", content: summaries.dailyBrief.value });
    item.fields.content = JSON.stringify(item.fields.content);
    summaryItems.push(item);
  }
  if (summaries.weeklySummary?.status === "ready" && summaries.weeklySummary.value) {
    const item = safeSnapshotItem("summaries", 1, "weeklySummary", { type: "weeklySummary", title: "AI 每周总结", content: summaries.weeklySummary.value });
    item.fields.content = JSON.stringify(item.fields.content);
    summaryItems.push(item);
  }

  const workLogsComplete = githubActivity.workLogsComplete !== false;
  const githubComplete = githubActivity.complete !== false;
  const workLogsTruncated = githubActivity.workLogsTruncated === true;
  const completenessIssues = [
    ...(Array.isArray(githubActivity.workLogIssues) ? githubActivity.workLogIssues : []),
    ...(Array.isArray(githubActivity.issues) ? githubActivity.issues : []),
  ].filter((issue) => typeof issue === "string" && issue.trim()).slice(0, 40);
  if ((!workLogsComplete || !githubComplete || workLogsTruncated) && !completenessIssues.length) {
    completenessIssues.push("至少一个数据源未通过完整性核对。");
  }

  const safeTokenUsage = tokenUsage && tokenUsage.complete === true
    && validSnapshotDate(tokenUsage.coverageStartDate) && validSnapshotDate(tokenUsage.coverageEndDate)
    && tokenUsage.coverageStartDate <= tokenUsage.coverageEndDate && Array.isArray(tokenUsage.days)
    ? {
      coverageStartDate: tokenUsage.coverageStartDate,
      coverageEndDate: tokenUsage.coverageEndDate,
      generatedAt: typeof tokenUsage.generatedAt === "string" ? tokenUsage.generatedAt : "",
      inputAvailable: tokenUsage.fieldAvailability?.inputTokens === true,
      outputAvailable: tokenUsage.fieldAvailability?.outputTokens === true,
      cachedInputAvailable: tokenUsage.fieldAvailability?.cachedInputTokens === true,
      days: tokenUsage.days.filter((item) => item?.available === true && validSnapshotDate(item.date))
        .map((item) => ({ date: item.date, inputTokens: item.inputTokens, outputTokens: item.outputTokens, cachedInputTokens: item.cachedInputTokens })),
    }
    : null;

  return {
    schemaVersion: PUBLIC_SNAPSHOT_VERSION,
    generatedAt: now,
    activityRange: activityRange || null,
    collections: { projects, tasks, workLogs: logs, knowledge, decisions, githubActivity: githubActivityItems, summaries: summaryItems },
    completeness: {
      complete: workLogsComplete && githubComplete && !workLogsTruncated,
      workLogs: workLogsComplete,
      github: githubComplete,
      workLogsTruncated,
      githubErrors: Array.isArray(githubActivity.errors) ? githubActivity.errors.length : 0,
      issues: completenessIssues,
    },
    ...(safeTokenUsage ? { tokenUsage: safeTokenUsage } : {}),
  };
}

function allSafeItems(draft, collection) {
  return Array.isArray(draft?.collections?.[collection]) ? draft.collections[collection] : [];
}

export function snapshotDraftCounts(draft) {
  return {
    ...Object.fromEntries(Object.keys(PUBLIC_SNAPSHOT_COLLECTION_LABELS).map((key) => [key, allSafeItems(draft, key).length])),
    codexTokenDays: Array.isArray(draft?.tokenUsage?.days) ? draft.tokenUsage.days.length : 0,
  };
}

export function buildPublishableSnapshot(draft, { now = new Date().toISOString() } = {}) {
  if (!draft || draft.schemaVersion !== PUBLIC_SNAPSHOT_VERSION) throw new Error("访客快照草稿版本无效。");
  if (draft.completeness?.complete !== true || draft.completeness?.workLogs !== true
    || draft.completeness?.github !== true || draft.completeness?.workLogsTruncated === true) {
    throw new Error("快照数据源读取不完整，必须完成安全重试后才能发布。");
  }
  const allProjects = allSafeItems(draft, "projects");
  const projectIdMap = new Map(allProjects.map((item, index) => [item.safeId, `project-${String(index + 1).padStart(3, "0")}`]));
  const remapProject = (safeId) => projectIdMap.get(safeId) || "";
  const projects = allProjects.map((item, index) => ({
    id: `project-${String(index + 1).padStart(3, "0")}`,
    name: item.fields.name || "",
    description: item.fields.description || "",
    status: item.fields.status || "未分类",
    stage: item.fields.stage || "",
    next: item.fields.next || "",
    url: item.fields.url || "",
    github: item.fields.github || "",
    notes: item.fields.notes || "",
    isPinned: Boolean(item.fields.isPinned),
  }));
  const buildRows = (collection, prefix, transform) => allSafeItems(draft, collection).map((item, index) => ({
    id: `${prefix}-${String(index + 1).padStart(4, "0")}`,
    ...transform(item.fields),
  }));
  const tasks = buildRows("tasks", "task", (fields) => ({
    title: fields.title || "",
    description: fields.description || "",
    projectId: remapProject(fields.projectId),
    status: fields.status || "todo",
    priority: fields.priority || "",
    due: fields.due || "",
  }));
  const knowledge = buildRows("knowledge", "knowledge", (fields) => ({
    type: fields.type || "",
    title: fields.title || "",
    content: fields.content || "",
    summary: fields.summary || "",
    tags: Array.isArray(fields.tags) ? fields.tags : [],
    projectId: remapProject(fields.projectId),
  }));
  const decisions = buildRows("decisions", "decision", (fields) => ({
    question: fields.question || "",
    options: Array.isArray(fields.options) ? fields.options : [],
    goal: fields.goal || "",
    time: fields.time || "",
    cost: fields.cost || "",
    risk: fields.risk || "",
    recommendation: fields.recommendation || "",
    final: fields.final || "",
    reason: fields.reason || "",
    projectId: remapProject(fields.projectId),
  }));
  const workLogs = buildRows("workLogs", "work-log", (fields) => ({
    projectId: remapProject(fields.projectId),
    workDate: fields.workDate || "",
    completedItems: fields.completedItems || "",
    outcomes: fields.outcomes || "",
    nextStep: fields.nextStep || "",
  }));

  const githubActivityItems = allSafeItems(draft, "githubActivity");
  const activityCounts = new Map();
  const projectActivityCounts = new Map();
  const hourlyCounts = Array(24).fill(0);
  const hourlyComplete = githubActivityItems.length > 0 && githubActivityItems.every((item) => item.fields.complete === true && item.hourlyCounts?.length === 24);
  const weekdayHourCounts = Array(168).fill(0);
  const weekdayHourlyComplete = githubActivityItems.length > 0 && githubActivityItems.every((item) => item.fields.complete === true && item.weekdayHourCounts?.length === 168);
  for (const item of githubActivityItems) {
    for (const entry of item.dailyCounts || []) activityCounts.set(entry.date, (activityCounts.get(entry.date) || 0) + entry.count);
    for (const projectSafeId of item.fields.projectIds || []) {
      const projectId = remapProject(projectSafeId);
      if (!projectId) continue;
      for (const entry of item.dailyCounts || []) {
        const key = `${projectId}\u0000${entry.date}`;
        projectActivityCounts.set(key, (projectActivityCounts.get(key) || 0) + entry.count);
      }
    }
    if (hourlyComplete) for (const entry of item.hourlyCounts) hourlyCounts[entry.hour] += entry.count;
    if (weekdayHourlyComplete) for (const entry of item.weekdayHourCounts) weekdayHourCounts[entry.weekday * 24 + entry.hour] += entry.count;
  }
  const range = draft.activityRange || {};
  const githubDailyCounts = [...activityCounts.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([date, count]) => ({ date, count }));
  const summaries = Object.fromEntries(allSafeItems(draft, "summaries").map((item) => [item.fields.type, item.fields.content]));
  return {
    schemaVersion: PUBLIC_SNAPSHOT_VERSION,
    generatedAt: draft.generatedAt,
    activity: {
      startDate: range.startDate || "",
      endDate: range.endDate || "",
      githubDailyCounts,
      githubRepositoryCount: githubActivityItems.length,
      githubComplete: githubActivityItems.every((item) => item.fields.complete === true),
      workLogsComplete: draft.completeness?.workLogs === true && draft.completeness?.workLogsTruncated !== true,
      githubProjectDailyCounts: [...projectActivityCounts.entries()].map(([key, count]) => {
        const [projectId, date] = key.split("\u0000");
        return { projectId, date, count };
      }).sort((left, right) => left.date.localeCompare(right.date) || left.projectId.localeCompare(right.projectId)),
      githubHourlyCounts: hourlyComplete ? hourlyCounts.map((count, hour) => ({ hour, count })) : [],
      githubHourlyComplete: hourlyComplete,
      githubWeekdayHourCounts: weekdayHourlyComplete
        ? weekdayHourCounts.map((count, index) => ({ weekday: Math.floor(index / 24), hour: index % 24, count }))
        : [],
      githubWeekdayHourlyComplete: weekdayHourlyComplete,
    },
    ...(draft.tokenUsage ? { tokenUsage: draft.tokenUsage } : {}),
    projects,
    tasks,
    workLogs,
    knowledge,
    decisions,
    summaries: {
      dailyBrief: summaries.dailyBrief || "",
      weeklySummary: summaries.weeklySummary || "",
    },
    publishedAt: "",
  };
}

function exactKeys(value, keys) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key)));
}

function allowedKeys(value, required, optional = []) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value)
    && required.every((key) => Object.hasOwn(value, key))
    && Object.keys(value).every((key) => required.includes(key) || optional.includes(key)));
}

function validSnapshotDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function safeSnapshotText(value, maximum = 8_000, allowEmpty = true) {
  return typeof value === "string" && value.length <= maximum && (allowEmpty || Boolean(value.trim()))
    && !/https?:\/\/|\b(?:Bearer\s+[A-Za-z0-9._~-]{12,}|(?:gh[pousr]_[A-Za-z0-9_]{16,}|github_pat_[A-Za-z0-9_]{16,}|sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}))\b/i.test(value)
    && !/[\"']?\b(?:api[_-]?key|client[_-]?secret|secret|password|passwd|access[_-]?token|refresh[_-]?token|authorization|auth[_-]?(?:token|key|secret|credential)|user[_-]?id|session[_-]?id|token)\b[\"']?\s*[:=]\s*[\"']?[^\s\"'`,;}{]{1,}/i.test(value)
    && !/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/i.test(value)
    && !/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i.test(value)
    && !/-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:\b[A-Z]:\\|\\\\[^\s\\]+\\|\/(?:Users|home|private|Volumes|mnt)\/)/i.test(value)
    && !/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(value)
    && !/(?<!\d)(?:\+?86[-\s]?)?1[3-9]\d{9}(?!\d)/.test(value)
    && !/(?<!\d)(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}(?!\d)/.test(value)
    && !/(?<!\d)\+\d{1,3}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}(?!\d)/.test(value);
}

function safeSnapshotUrl(value, kind) {
  if (value === "") return true;
  if (typeof value !== "string" || value.length > 500) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash) return false;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.includes(":")) return false;
    if (isPrivateShareHost(host)) return false;
    if (kind === "github") return ["github.com", "www.github.com"].includes(host) && /^\/[A-Za-z0-9-]{1,39}\/[A-Za-z0-9_.-]{1,100}\/?$/.test(url.pathname);
    return !["github.com", "www.github.com"].includes(host);
  } catch { return false; }
}

export function validatePublicSnapshot(snapshot) {
  if (snapshot?.schemaVersion === 2) return validateStaticSnapshot(snapshot);
  const rootKeys = ["schemaVersion", "generatedAt", "activity", "projects", "tasks", "workLogs", "knowledge", "decisions", "summaries", "publishedAt"];
  if (!allowedKeys(snapshot, rootKeys, ["tokenUsage"]) || snapshot.schemaVersion !== PUBLIC_SNAPSHOT_VERSION
    || typeof snapshot.generatedAt !== "string" || !Number.isFinite(Date.parse(snapshot.generatedAt))
    || typeof snapshot.publishedAt !== "string" || snapshot.publishedAt.length > 40) return false;
  const activity = snapshot.activity;
  const activityKeys = ["startDate", "endDate", "githubDailyCounts", "githubRepositoryCount", "githubComplete", "workLogsComplete"];
  if (!allowedKeys(activity, activityKeys, ["githubProjectDailyCounts", "githubHourlyCounts", "githubHourlyComplete", "githubWeekdayHourCounts", "githubWeekdayHourlyComplete"])
    || !validSnapshotDate(activity.startDate) || !validSnapshotDate(activity.endDate) || activity.startDate > activity.endDate) return false;
  const daySpan = (Date.parse(`${activity.endDate}T00:00:00.000Z`) - Date.parse(`${activity.startDate}T00:00:00.000Z`)) / 86_400_000 + 1;
  if (daySpan > PUBLIC_SNAPSHOT_ACTIVITY_DAYS || !Array.isArray(activity.githubDailyCounts) || activity.githubDailyCounts.length > PUBLIC_SNAPSHOT_ACTIVITY_DAYS
    || !Number.isSafeInteger(activity.githubRepositoryCount) || activity.githubRepositoryCount < 0 || activity.githubRepositoryCount > 200
    || activity.githubComplete !== true || activity.workLogsComplete !== true) return false;
  const dates = new Set();
  for (const item of activity.githubDailyCounts) {
    if (!exactKeys(item, ["date", "count"]) || !validSnapshotDate(item.date) || item.date < activity.startDate || item.date > activity.endDate
      || dates.has(item.date) || !Number.isSafeInteger(item.count) || item.count < 0 || item.count > 1_000_000) return false;
    dates.add(item.date);
  }
  if (Object.hasOwn(activity, "githubProjectDailyCounts")) {
    if (!Array.isArray(activity.githubProjectDailyCounts) || activity.githubProjectDailyCounts.length > 100_000) return false;
    for (const item of activity.githubProjectDailyCounts) {
      if (!exactKeys(item, ["projectId", "date", "count"]) || !/^project-\d{3}$/.test(item.projectId)
        || !validSnapshotDate(item.date) || item.date < activity.startDate || item.date > activity.endDate
        || !Number.isSafeInteger(item.count) || item.count < 0 || item.count > 1_000_000) return false;
    }
  }
  if (Object.hasOwn(activity, "githubHourlyCounts")) {
    if (!Array.isArray(activity.githubHourlyCounts) || (activity.githubHourlyCounts.length !== 0 && activity.githubHourlyCounts.length !== 24)) return false;
    const hours = new Set();
    for (const item of activity.githubHourlyCounts) {
      if (!exactKeys(item, ["hour", "count"]) || !Number.isInteger(item.hour) || item.hour < 0 || item.hour > 23
        || hours.has(item.hour) || !Number.isSafeInteger(item.count) || item.count < 0 || item.count > 1_000_000) return false;
      hours.add(item.hour);
    }
  }
  if (Object.hasOwn(activity, "githubHourlyComplete") && (typeof activity.githubHourlyComplete !== "boolean"
    || activity.githubHourlyComplete && activity.githubHourlyCounts?.length !== 24)) return false;
  if (activity.githubHourlyCounts?.length === 24 && activity.githubHourlyComplete !== true) return false;
  if (Object.hasOwn(activity, "githubWeekdayHourCounts")) {
    const matrix = activity.githubWeekdayHourCounts;
    if (!Array.isArray(matrix) || (matrix.length !== 0 && matrix.length !== 168)) return false;
    const cells = new Set();
    for (const item of matrix) {
      const key = `${item?.weekday}:${item?.hour}`;
      if (!exactKeys(item, ["weekday", "hour", "count"]) || !Number.isInteger(item.weekday) || item.weekday < 0 || item.weekday > 6
        || !Number.isInteger(item.hour) || item.hour < 0 || item.hour > 23 || cells.has(key)
        || !Number.isSafeInteger(item.count) || item.count < 0 || item.count > 1_000_000) return false;
      cells.add(key);
    }
  }
  if (Object.hasOwn(activity, "githubWeekdayHourlyComplete") && (typeof activity.githubWeekdayHourlyComplete !== "boolean"
    || activity.githubWeekdayHourlyComplete && activity.githubWeekdayHourCounts?.length !== 168)) return false;
  if (activity.githubWeekdayHourCounts?.length === 168 && activity.githubWeekdayHourlyComplete !== true) return false;
  const { projects, tasks, workLogs, knowledge, decisions } = snapshot;
  if (!Array.isArray(projects) || projects.length > 200 || !Array.isArray(tasks) || tasks.length > 2_000
    || !Array.isArray(workLogs) || workLogs.length > 5_000 || !Array.isArray(knowledge) || knowledge.length > 2_000
    || !Array.isArray(decisions) || decisions.length > 2_000) return false;
  const projectIds = new Set();
  for (const item of projects) {
    if (!exactKeys(item, ["id", "name", "description", "status", "stage", "next", "url", "github", "notes", "isPinned"])
      || !/^project-\d{3}$/.test(item.id) || projectIds.has(item.id) || !safeSnapshotText(item.name, 200, false)
      || !safeSnapshotText(item.description) || !safeSnapshotText(item.status, 100) || !safeSnapshotText(item.stage, 200)
      || !safeSnapshotText(item.next, 2_000) || !safeSnapshotText(item.notes) || !safeSnapshotUrl(item.url, "website")
      || !safeSnapshotUrl(item.github, "github") || typeof item.isPinned !== "boolean") return false;
    projectIds.add(item.id);
  }
  const seen = { task: new Set(), workLog: new Set(), knowledge: new Set(), decision: new Set() };
  const checkId = (item, collection, pattern) => typeof item.id === "string" && pattern.test(item.id) && !seen[collection].has(item.id) && (seen[collection].add(item.id), true);
  for (const item of tasks) {
    if (!exactKeys(item, ["id", "title", "description", "projectId", "status", "priority", "due"]) || !checkId(item, "task", /^task-\d{4}$/)
      || !safeSnapshotText(item.title, 1_000, false) || !safeSnapshotText(item.description) || !safeSnapshotText(item.projectId, 100)
      || (item.projectId && !projectIds.has(item.projectId)) || !safeSnapshotText(item.status, 80) || !safeSnapshotText(item.priority, 80) || !safeSnapshotText(item.due, 40)) return false;
  }
  for (const item of workLogs) {
    if (!exactKeys(item, ["id", "projectId", "workDate", "completedItems", "outcomes", "nextStep"]) || !checkId(item, "workLog", /^work-log-\d{4}$/)
      || !projectIds.has(item.projectId) || !validSnapshotDate(item.workDate) || !safeSnapshotText(item.completedItems, 8_000, false)
      || !safeSnapshotText(item.outcomes) || !safeSnapshotText(item.nextStep, 4_000)) return false;
  }
  for (const item of knowledge) {
    if (!exactKeys(item, ["id", "type", "title", "content", "summary", "tags", "projectId"]) || !checkId(item, "knowledge", /^knowledge-\d{4}$/)
      || !safeSnapshotText(item.type, 100) || !safeSnapshotText(item.title, 1_000, false) || !safeSnapshotText(item.content, 20_000)
      || !safeSnapshotText(item.summary) || !Array.isArray(item.tags) || item.tags.length > 100 || !item.tags.every((tag) => safeSnapshotText(tag, 200))
      || !safeSnapshotText(item.projectId, 100) || (item.projectId && !projectIds.has(item.projectId))) return false;
  }
  for (const item of decisions) {
    if (!exactKeys(item, ["id", "question", "options", "goal", "time", "cost", "risk", "recommendation", "final", "reason", "projectId"])
      || !checkId(item, "decision", /^decision-\d{4}$/) || !safeSnapshotText(item.question, 2_000, false)
      || !Array.isArray(item.options) || item.options.length > 100 || !item.options.every((option) => safeSnapshotText(option, 2_000))
      || !safeSnapshotText(item.goal) || !safeSnapshotText(item.time, 1_000) || !safeSnapshotText(item.cost, 1_000)
      || !safeSnapshotText(item.risk, 2_000) || !safeSnapshotText(item.recommendation, 4_000) || !safeSnapshotText(item.final, 2_000)
      || !safeSnapshotText(item.reason, 4_000) || !safeSnapshotText(item.projectId, 100) || (item.projectId && !projectIds.has(item.projectId))) return false;
  }
  if (Object.hasOwn(snapshot, "tokenUsage")) {
    const tokenUsage = snapshot.tokenUsage;
    const tokenKeys = ["coverageStartDate", "coverageEndDate", "generatedAt", "inputAvailable", "outputAvailable", "cachedInputAvailable", "days"];
    if (!exactKeys(tokenUsage, tokenKeys) || !validSnapshotDate(tokenUsage.coverageStartDate) || !validSnapshotDate(tokenUsage.coverageEndDate)
      || tokenUsage.coverageStartDate > tokenUsage.coverageEndDate || !Number.isFinite(Date.parse(tokenUsage.generatedAt))
      || ![tokenUsage.inputAvailable, tokenUsage.outputAvailable, tokenUsage.cachedInputAvailable].every((value) => typeof value === "boolean")
      || !Array.isArray(tokenUsage.days) || tokenUsage.days.length > 366) return false;
    const span = (Date.parse(`${tokenUsage.coverageEndDate}T00:00:00.000Z`) - Date.parse(`${tokenUsage.coverageStartDate}T00:00:00.000Z`)) / 86_400_000 + 1;
    if (span > 366) return false;
    const seenDays = new Set();
    for (const item of tokenUsage.days) {
      if (!exactKeys(item, ["date", "inputTokens", "outputTokens", "cachedInputTokens"]) || !validSnapshotDate(item.date)
        || item.date < tokenUsage.coverageStartDate || item.date > tokenUsage.coverageEndDate || seenDays.has(item.date)
        || !["inputTokens", "outputTokens", "cachedInputTokens"].every((key) => {
          const available = key === "inputTokens" ? tokenUsage.inputAvailable : key === "outputTokens" ? tokenUsage.outputAvailable : tokenUsage.cachedInputAvailable;
          return available ? Number.isSafeInteger(item[key]) && item[key] >= 0 : item[key] === null;
        })) return false;
      seenDays.add(item.date);
    }
  }
  return exactKeys(snapshot.summaries, ["dailyBrief", "weeklySummary"])
    && safeSnapshotText(snapshot.summaries.dailyBrief, 20_000) && safeSnapshotText(snapshot.summaries.weeklySummary, 20_000);
}

export function hydratePublicSnapshot(snapshot) {
  if (!validatePublicSnapshot(snapshot)) return null;
  return {
    projects: snapshot.projects.map((item) => ({ ...item, createdAt: "", updatedAt: "" })),
    tasks: snapshot.tasks.map((item) => ({ ...item, createdAt: "", updatedAt: "" })),
    workLogs: snapshot.workLogs.map((item) => ({ ...item })),
    knowledge: snapshot.knowledge.map((item) => ({ ...item, tags: [...item.tags], createdAt: "" })),
    decisions: snapshot.decisions.map((item) => ({ ...item, options: [...item.options], createdAt: "" })),
    activities: [],
    settings: { theme: "system" },
  };
}

export function buildSnapshotActivity(snapshot, range) {
  if (!validatePublicSnapshot(snapshot) || !range?.valid || range.startDate < snapshot.activity.startDate || range.endDate > snapshot.activity.endDate) return null;
  const projectNames = new Map(snapshot.projects.map((item) => [item.id, item.name]));
  const githubByDate = new Map(snapshot.activity.githubDailyCounts.map((item) => [item.date, item.count]));
  const githubProjectsByDate = new Map();
  for (const item of snapshot.activity.githubProjectDailyCounts || []) {
    const byProject = githubProjectsByDate.get(item.date) || new Map();
    byProject.set(item.projectId, (byProject.get(item.projectId) || 0) + item.count);
    githubProjectsByDate.set(item.date, byProject);
  }
  const projectActivity = new Map(snapshot.projects.map((item) => [item.id, {
    projectId: item.id,
    projectName: item.name,
    githubCommits: 0,
    workLogs: 0,
  }]));
  const days = [];
  const workLogByDate = new Map();
  for (const item of snapshot.workLogs) {
    if (item.workDate < range.startDate || item.workDate > range.endDate) continue;
    const entry = workLogByDate.get(item.workDate) || new Map();
    const projectName = projectNames.get(item.projectId) || "未关联项目";
    entry.set(projectName, (entry.get(projectName) || 0) + 1);
    workLogByDate.set(item.workDate, entry);
    const project = projectActivity.get(item.projectId);
    if (project) project.workLogs += 1;
  }
  for (let date = range.startDate; date <= range.endDate; date = shiftDate(date, 1)) {
    const workLogProjects = [...(workLogByDate.get(date) || new Map()).entries()].map(([name, count]) => ({ name, count }));
    const githubProjectCounts = [...(githubProjectsByDate.get(date) || new Map()).entries()]
      .map(([projectId, count]) => ({ name: projectNames.get(projectId) || "", count }));
    for (const [projectId, count] of (githubProjectsByDate.get(date) || new Map()).entries()) {
      const project = projectActivity.get(projectId);
      if (project) project.githubCommits += count;
    }
    const githubCommits = githubByDate.get(date) || 0;
    const workLogs = workLogProjects.reduce((sum, item) => sum + item.count, 0);
    days.push({ date, githubCommits, workLogs, githubProjects: githubProjectCounts.map((item) => item.name).filter(Boolean), githubProjectCounts, workLogProjects, partial: (snapshot.activity.githubRepositoryCount > 0 && !snapshot.activity.githubComplete) || !snapshot.activity.workLogsComplete });
  }
  const githubCommits = days.reduce((sum, item) => sum + item.githubCommits, 0);
  const workLogs = days.reduce((sum, item) => sum + item.workLogs, 0);
  const activeDays = days.filter((item) => item.githubCommits + item.workLogs > 0).length;
  const githubComplete = snapshot.activity.githubComplete === true;
  return {
    startDate: range.startDate,
    endDate: range.endDate,
    days,
    projectActivity: [...projectActivity.values()]
      .filter((item) => item.githubCommits > 0 || item.workLogs > 0)
      .sort((left, right) => (right.githubCommits + right.workLogs) - (left.githubCommits + left.workLogs)
        || left.projectName.localeCompare(right.projectName, "zh-CN")),
    hourlyCounts: snapshot.activity.githubHourlyCounts || [],
    hourlyAvailable: snapshot.activity.githubHourlyCounts?.length === 24,
    weekdayHourCounts: snapshot.activity.githubWeekdayHourCounts || [],
    totals: { githubCommits, workLogs, activityRecords: githubCommits + workLogs, activeDays },
    coverage: {
      githubStatus: snapshot.activity.githubRepositoryCount ? "ready" : "unlinked",
      githubRequested: snapshot.activity.githubRepositoryCount,
      githubCompleteCount: githubComplete ? snapshot.activity.githubRepositoryCount : 0,
      githubIncompleteNames: [],
      githubErrors: [],
      githubComplete,
      hourlyAvailable: snapshot.activity.githubHourlyCounts?.length === 24,
      hourlyComplete: snapshot.activity.githubHourlyComplete === true,
      weekdayHourlyAvailable: snapshot.activity.githubWeekdayHourCounts?.length === 168,
      weekdayHourlyComplete: snapshot.activity.githubWeekdayHourlyComplete === true,
      workLogsStatus: "ready",
      workLogsComplete: snapshot.activity.workLogsComplete === true,
      complete: githubComplete && snapshot.activity.workLogsComplete === true,
    },
  };
}

function shiftDate(date, days) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export async function fetchPublishedSnapshot({ fetchImpl = fetch } = {}) {
  const response = await fetchImpl(`${WORKER_BASE}/api/public/snapshot`, {
    method: "GET",
    credentials: "omit",
    cache: "no-cache",
    referrerPolicy: "no-referrer",
    signal: AbortSignal.timeout(5_000),
    headers: { Accept: "application/json" },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`访客快照读取失败（HTTP ${response.status}）。`);
  const snapshot = await response.json();
  if (!validatePublicSnapshot(snapshot)) throw new Error("访客快照格式校验失败。");
  return snapshot;
}

async function withTimeout(promise, timeoutMs, message) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), timeoutMs); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function publishPublicSnapshot(snapshot, workspaceAuth, { fetchImpl = fetch } = {}) {
  if (!validatePublicSnapshot(snapshot) || !workspaceAuth?.client?.auth) throw new Error("发布资料或已验证的登录会话无效。");
  const sessionResult = await withTimeout(workspaceAuth.client.auth.getSession(), 8_000, "验证登录会话超时，请重试。");
  const accessToken = sessionResult?.data?.session?.access_token;
  if (sessionResult?.error || !accessToken) throw new Error("登录会话已失效，请重新登录后再发布。");
  const response = await fetchImpl(`${WORKER_BASE}/api/public/snapshot`, {
    method: "POST",
    credentials: "omit",
    referrerPolicy: "no-referrer",
    signal: AbortSignal.timeout(15_000),
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(snapshot),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || `访客快照发布失败（HTTP ${response.status}）。`);
  return payload;
}
