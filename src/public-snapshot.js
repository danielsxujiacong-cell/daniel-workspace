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
  { reason: "疑似 Token 或密钥", pattern: /\b(?:Bearer\s+[A-Za-z0-9._~-]{12,}|(?:gh[pousr]_[A-Za-z0-9_]{16,}|github_pat_[A-Za-z0-9_]{16,}|sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}))\b/gi, replacement: "[密钥已隐藏]" },
  { reason: "本机路径", pattern: /(?:\b[A-Z]:\\(?:[^\s<>:"|?*]+\\)*[^\s<>:"|?*]*|\\\\[^\s\\]+\\[^\s]+|\/(?:Users|home|private|Volumes|mnt)\/[^\s]+)/gi, replacement: "[本机路径已隐藏]" },
  { reason: "邮箱地址", pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, replacement: "[邮箱已隐藏]" },
  { reason: "电话联系方式", pattern: /(?<!\d)(?:\+?86[-\s]?)?1[3-9]\d{9}(?!\d)/g, replacement: "[联系方式已隐藏]" },
  { reason: "仓库地址（仅核验后的项目字段可保留）", pattern: /https?:\/\/(?:www\.)?github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+[^\s]*/gi, replacement: "[仓库地址已隐藏]" },
  { reason: "外部链接（仅独立项目网址可保留）", pattern: /https?:\/\/[^\s<>"')\]]+/gi, replacement: "[外部链接已隐藏]" },
  { reason: "私钥", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/gi, replacement: "[私钥已隐藏]" },
];

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
    if (!allowGitHub && ["github.com", "www.github.com"].includes(host)) return "";
    return url.href;
  } catch { return ""; }
}

function scrubValue(value, fieldName, findings, depth = 0) {
  if (depth > 5) return null;
  if (typeof value === "string") {
    let result = normalizedText(value, fieldName === "content" ? 20_000 : 8_000);
    for (const item of SECRET_PATTERNS) {
      item.pattern.lastIndex = 0;
      if (item.pattern.test(result)) {
        findings.push({ field: fieldName, reason: item.reason });
        item.pattern.lastIndex = 0;
        result = result.replace(item.pattern, item.replacement);
      }
    }
    return result;
  }
  if (Array.isArray(value)) return value.slice(0, 100).map((item, index) => scrubValue(item, `${fieldName}[${index + 1}]`, findings, depth + 1));
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).slice(0, 100).map(([key, item]) => [key.slice(0, 80), scrubValue(item, `${fieldName}.${key}`, findings, depth + 1)]));
  }
  return null;
}

function reviewedItem(collection, index, sourceId, fields, findings = []) {
  const safeFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (key === "url" || key === "github") {
      safeFields[key] = safePublicUrl(value, { allowGitHub: key === "github" });
      if (value && !safeFields[key]) findings.push({ field: key, reason: "未通过公开 HTTPS 地址校验，已隐藏" });
      continue;
    }
    safeFields[key] = scrubValue(value, key, findings);
  }
  return {
    reviewId: `${collection}-${index + 1}`,
    sourceId: String(sourceId || ""),
    collection,
    label: PUBLIC_SNAPSHOT_COLLECTION_LABELS[collection] || collection,
    fields: safeFields,
    findings: uniqueFindings(findings),
    include: false,
    sensitiveAcknowledged: false,
  };
}

function uniqueFindings(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.field}|${item.reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function publicRepoSnapshot(repo) {
  const name = typeof repo?.repositoryName === "string" ? repo.repositoryName : typeof repo?.fullName === "string" ? repo.fullName : "";
  if (repo?.isPublic !== true || !/^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9_.-]{1,100}$/.test(name)) return null;
  return { name, url: `https://github.com/${name}`, isPublic: true };
}

export function createSnapshotReviewDraft({ data = {}, workLogs = [], publicRepositories = [], githubActivity = {}, summaries = {}, now = new Date().toISOString(), activityRange = null } = {}) {
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
    const findings = [];
    if (project.path) findings.push({ field: "path", reason: "本机路径字段不会进入快照" });
    if (project.github && !verifiedRepo) findings.push({ field: "github", reason: "仓库未核验为公开，地址与仓库内容均已隐藏" });
    return reviewedItem("projects", index, project.id, fields, findings);
  });

  const projectReviewId = new Map(projects.map((item) => [item.sourceId, item.reviewId]));
  const tasks = (Array.isArray(data.tasks) ? data.tasks : []).map((item, index) => reviewedItem("tasks", index, item.id, {
    title: item.title,
    description: item.description,
    projectId: projectReviewId.get(String(item.projectId || "")) || "",
    status: item.status,
    priority: item.priority,
    due: item.due,
  }));
  const knowledge = (Array.isArray(data.knowledge) ? data.knowledge : []).map((item, index) => reviewedItem("knowledge", index, item.id, {
    type: item.type,
    title: item.title,
    content: item.content,
    summary: item.summary,
    tags: item.tags,
    projectId: projectReviewId.get(String(item.projectId || "")) || "",
  }));
  const decisions = (Array.isArray(data.decisions) ? data.decisions : []).map((item, index) => reviewedItem("decisions", index, item.id, {
    question: item.question,
    options: item.options,
    goal: item.goal,
    time: item.time,
    cost: item.cost,
    risk: item.risk,
    recommendation: item.recommendation,
    final: item.final,
    reason: item.reason,
    projectId: projectReviewId.get(String(item.projectId || "")) || "",
  }));
  const logs = (Array.isArray(workLogs) ? workLogs : []).map((item, index) => {
    const findings = [];
    if (Array.isArray(item.evidenceLinks) && item.evidenceLinks.length) findings.push({ field: "evidenceLinks", reason: `${item.evidenceLinks.length} 个证据链接不会进入公开快照` });
    return reviewedItem("workLogs", index, item.id, {
      projectId: projectReviewId.get(String(item.projectId || "")) || "",
      projectName: projectNameById.get(String(item.projectId || "")) || "未关联项目",
      workDate: item.workDate,
      completedItems: item.completedItems,
      outcomes: item.outcomes,
      nextStep: item.nextStep,
      evidenceLinkCount: Array.isArray(item.evidenceLinks) ? item.evidenceLinks.length : 0,
    }, findings);
  });

  const githubActivityItems = [];
  const byName = new Map((Array.isArray(githubActivity.repositories) ? githubActivity.repositories : [])
    .map((item) => [String(item.fullName || "").toLowerCase(), item]));
  for (const [index, repo] of [...publicRepos.values()].entries()) {
    const activity = byName.get(repo.name.toLowerCase());
    if (!activity) continue;
    const projectIds = sourceProjects.filter((item) => String(item.github || "").toLowerCase().includes(`github.com/${repo.name.toLowerCase()}`)).map((item) => String(item.id || ""));
    const projectNames = projectIds.map((id) => projectNameById.get(id)).filter(Boolean);
    const dailyCounts = (Array.isArray(activity.dailyCounts) ? activity.dailyCounts : [])
      .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.date) && Number.isSafeInteger(item.count) && item.count > 0)
      .map((item) => ({ date: item.date, count: item.count }));
    githubActivityItems.push({
      reviewId: `githubActivity-${index + 1}`,
      collection: "githubActivity",
      label: PUBLIC_SNAPSHOT_COLLECTION_LABELS.githubActivity,
      sourceName: repo.name,
      sourceProjectIds: projectIds,
      fields: { repository: repo.name, projectNames, commits: dailyCounts.reduce((sum, item) => sum + item.count, 0), activeDays: dailyCounts.length, complete: activity.complete === true && activity.truncated !== true },
      dailyCounts,
      findings: [],
      include: false,
      sensitiveAcknowledged: false,
    });
  }

  const summaryItems = [];
  if (summaries.dailyBrief?.status === "ready" && summaries.dailyBrief.value) {
    summaryItems.push(reviewedItem("summaries", 0, "dailyBrief", { type: "dailyBrief", title: "AI 今日简报", content: JSON.stringify(summaries.dailyBrief.value) }));
  }
  if (summaries.weeklySummary?.status === "ready" && summaries.weeklySummary.value) {
    summaryItems.push(reviewedItem("summaries", 1, "weeklySummary", { type: "weeklySummary", title: "AI 每周总结", content: JSON.stringify(summaries.weeklySummary.value) }));
  }
  for (const item of summaryItems) item.label = PUBLIC_SNAPSHOT_COLLECTION_LABELS.summaries;

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
  };
}

function selectedItems(draft, collection) {
  return (draft?.collections?.[collection] || []).filter((item) => item.include && (!item.findings?.length || item.sensitiveAcknowledged));
}

export function selectedSnapshotCounts(draft) {
  return Object.fromEntries(Object.keys(PUBLIC_SNAPSHOT_COLLECTION_LABELS).map((key) => [key, selectedItems(draft, key).length]));
}

export function buildPublishableSnapshot(draft, { now = new Date().toISOString() } = {}) {
  if (!draft || draft.schemaVersion !== PUBLIC_SNAPSHOT_VERSION) throw new Error("访客快照草稿版本无效。");
  if (draft.completeness?.complete === false || draft.completeness?.workLogs === false
    || draft.completeness?.github === false || draft.completeness?.workLogsTruncated === true) {
    throw new Error("快照数据源读取不完整，必须完成安全重试后才能发布。");
  }
  const collections = draft.collections || {};
  const selectedProjects = selectedItems(draft, "projects");
  const projectIdMap = new Map(selectedProjects.map((item, index) => [item.reviewId, `project-${String(index + 1).padStart(3, "0")}`]));
  const remapProject = (reviewId) => projectIdMap.get(reviewId) || "";
  const projects = selectedProjects.map((item, index) => ({
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
  const buildRows = (collection, prefix, transform) => selectedItems(draft, collection).map((item, index) => ({
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

  const selectedActivity = selectedItems(draft, "githubActivity").filter((item) =>
    item.sourceProjectIds.some((sourceId) => selectedProjects.some((project) => project.sourceId === sourceId)));
  const activityCounts = new Map();
  for (const item of selectedActivity) {
    for (const entry of item.dailyCounts || []) activityCounts.set(entry.date, (activityCounts.get(entry.date) || 0) + entry.count);
  }
  const range = draft.activityRange || {};
  const githubDailyCounts = [...activityCounts.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([date, count]) => ({ date, count }));
  const summaries = Object.fromEntries(selectedItems(draft, "summaries").map((item) => [item.fields.type, item.fields.content]));
  return {
    schemaVersion: PUBLIC_SNAPSHOT_VERSION,
    generatedAt: draft.generatedAt,
    activity: {
      startDate: range.startDate || "",
      endDate: range.endDate || "",
      githubDailyCounts,
      githubRepositoryCount: selectedActivity.length,
      githubComplete: selectedActivity.every((item) => item.fields.complete === true),
      workLogsComplete: draft.completeness?.workLogs === true && draft.completeness?.workLogsTruncated !== true,
    },
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

function validSnapshotDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function safeSnapshotText(value, maximum = 8_000, allowEmpty = true) {
  return typeof value === "string" && value.length <= maximum && (allowEmpty || Boolean(value.trim()))
    && !/https?:\/\/|\b(?:Bearer\s+[A-Za-z0-9._~-]{12,}|(?:gh[pousr]_[A-Za-z0-9_]{16,}|github_pat_[A-Za-z0-9_]{16,}|sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}))\b/i.test(value)
    && !/-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:\b[A-Z]:\\|\\\\[^\s\\]+\\|\/(?:Users|home|private|Volumes|mnt)\/)/i.test(value)
    && !/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(value)
    && !/(?<!\d)(?:\+?86[-\s]?)?1[3-9]\d{9}(?!\d)/.test(value);
}

function safeSnapshotUrl(value, kind) {
  if (value === "") return true;
  if (typeof value !== "string" || value.length > 500) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash) return false;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.includes(":")) return false;
    if (kind === "github") return ["github.com", "www.github.com"].includes(host) && /^\/[A-Za-z0-9-]{1,39}\/[A-Za-z0-9_.-]{1,100}\/?$/.test(url.pathname);
    return !["github.com", "www.github.com"].includes(host);
  } catch { return false; }
}

export function validatePublicSnapshot(snapshot) {
  const rootKeys = ["schemaVersion", "generatedAt", "activity", "projects", "tasks", "workLogs", "knowledge", "decisions", "summaries", "publishedAt"];
  if (!exactKeys(snapshot, rootKeys) || snapshot.schemaVersion !== PUBLIC_SNAPSHOT_VERSION
    || typeof snapshot.generatedAt !== "string" || !Number.isFinite(Date.parse(snapshot.generatedAt))
    || typeof snapshot.publishedAt !== "string" || snapshot.publishedAt.length > 40) return false;
  const activity = snapshot.activity;
  if (!exactKeys(activity, ["startDate", "endDate", "githubDailyCounts", "githubRepositoryCount", "githubComplete", "workLogsComplete"])
    || !validSnapshotDate(activity.startDate) || !validSnapshotDate(activity.endDate) || activity.startDate > activity.endDate) return false;
  const daySpan = (Date.parse(`${activity.endDate}T00:00:00.000Z`) - Date.parse(`${activity.startDate}T00:00:00.000Z`)) / 86_400_000 + 1;
  if (daySpan > PUBLIC_SNAPSHOT_ACTIVITY_DAYS || !Array.isArray(activity.githubDailyCounts) || activity.githubDailyCounts.length > PUBLIC_SNAPSHOT_ACTIVITY_DAYS
    || !Number.isSafeInteger(activity.githubRepositoryCount) || activity.githubRepositoryCount < 0 || activity.githubRepositoryCount > 200
    || typeof activity.githubComplete !== "boolean" || typeof activity.workLogsComplete !== "boolean") return false;
  const dates = new Set();
  for (const item of activity.githubDailyCounts) {
    if (!exactKeys(item, ["date", "count"]) || !validSnapshotDate(item.date) || item.date < activity.startDate || item.date > activity.endDate
      || dates.has(item.date) || !Number.isSafeInteger(item.count) || item.count < 0 || item.count > 1_000_000) return false;
    dates.add(item.date);
  }
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
  const days = [];
  const workLogByDate = new Map();
  for (const item of snapshot.workLogs) {
    if (item.workDate < range.startDate || item.workDate > range.endDate) continue;
    const entry = workLogByDate.get(item.workDate) || new Map();
    const projectName = projectNames.get(item.projectId) || "未关联项目";
    entry.set(projectName, (entry.get(projectName) || 0) + 1);
    workLogByDate.set(item.workDate, entry);
  }
  for (let date = range.startDate; date <= range.endDate; date = shiftDate(date, 1)) {
    const workLogProjects = [...(workLogByDate.get(date) || new Map()).entries()].map(([name, count]) => ({ name, count }));
    const githubCommits = githubByDate.get(date) || 0;
    const workLogs = workLogProjects.reduce((sum, item) => sum + item.count, 0);
    days.push({ date, githubCommits, workLogs, githubProjects: [], workLogProjects, partial: (snapshot.activity.githubRepositoryCount > 0 && !snapshot.activity.githubComplete) || !snapshot.activity.workLogsComplete });
  }
  const githubCommits = days.reduce((sum, item) => sum + item.githubCommits, 0);
  const workLogs = days.reduce((sum, item) => sum + item.workLogs, 0);
  const activeDays = days.filter((item) => item.githubCommits + item.workLogs > 0).length;
  const githubComplete = snapshot.activity.githubRepositoryCount === 0 || snapshot.activity.githubComplete === true;
  return {
    startDate: range.startDate,
    endDate: range.endDate,
    days,
    totals: { githubCommits, workLogs, activityRecords: githubCommits + workLogs, activeDays },
    coverage: {
      githubStatus: snapshot.activity.githubRepositoryCount ? "ready" : "unlinked",
      githubRequested: snapshot.activity.githubRepositoryCount,
      githubCompleteCount: githubComplete ? snapshot.activity.githubRepositoryCount : 0,
      githubIncompleteNames: [],
      githubErrors: [],
      githubComplete,
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

export async function publishPublicSnapshot(snapshot, workspaceAuth, { fetchImpl = fetch } = {}) {
  if (!validatePublicSnapshot(snapshot) || !workspaceAuth?.client?.auth) throw new Error("发布资料或已验证的登录会话无效。");
  const sessionResult = await workspaceAuth.client.auth.getSession();
  const accessToken = sessionResult?.data?.session?.access_token;
  if (sessionResult?.error || !accessToken) throw new Error("登录会话已失效，请重新登录后再发布。");
  const response = await fetchImpl(`${WORKER_BASE}/api/public/snapshot`, {
    method: "POST",
    credentials: "omit",
    referrerPolicy: "no-referrer",
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(snapshot),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || `访客快照发布失败（HTTP ${response.status}）。`);
  return payload;
}
