import { isGitHubSnapshotFresh, parsePublicGitHubRepository } from "../github/public-api.js";

function cleanText(value, limit) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

export function verifiedProjectGitHubCommit(project) {
  const repository = parsePublicGitHubRepository(project?.github);
  const snapshot = project?.githubData;
  const commit = snapshot?.latestCommit;
  if (!repository || snapshot?.isPublic !== true
    || String(snapshot.repositoryName || "").toLowerCase() !== repository.fullName.toLowerCase()
    || !/^[a-f0-9]{7,40}$/i.test(commit?.sha || "")
    || !String(commit?.message || "").trim()
    || !Number.isFinite(new Date(commit?.committedAt || "").getTime())
    || !Number.isFinite(new Date(snapshot.refreshedAt || "").getTime())) return null;

  const commitUrlPrefix = `${repository.url}/commit/`;
  const commitUrl = typeof commit.url === "string" ? commit.url : "";
  const urlSha = commitUrl.startsWith(commitUrlPrefix) ? commitUrl.slice(commitUrlPrefix.length) : "";
  if (!/^[a-f0-9]{7,40}$/i.test(urlSha) || !urlSha.toLowerCase().startsWith(commit.sha.toLowerCase())) return null;

  return {
    repositoryName: repository.fullName,
    message: commit.message,
    committedAt: commit.committedAt,
    refreshedAt: snapshot.refreshedAt,
    fresh: isGitHubSnapshotFresh(snapshot),
  };
}

export function buildProjectNextStepContext({ project, tasks = [], githubCommit = null, githubFresh = false } = {}) {
  const projectContext = {
    name: cleanText(project?.name, 120),
    description: cleanText(project?.description, 1_000),
    status: cleanText(project?.status, 80),
    stage: cleanText(project?.stage, 120),
    currentNextStep: cleanText(project?.next, 500),
  };
  const taskPriority = { "高": 0, "中": 1, "低": 2 };
  const projectTaskRecords = (Array.isArray(tasks) ? tasks : []).map((task) => ({
    title: cleanText(task?.title, 180),
    status: task?.status === "done" ? "done" : "todo",
    priority: cleanText(task?.priority, 20),
    due: cleanText(task?.due, 40),
  })).filter((task) => task.title);
  const projectTasks = projectTaskRecords.sort((left, right) => Number(left.status === "done") - Number(right.status === "done")
    || (taskPriority[left.priority] ?? 1) - (taskPriority[right.priority] ?? 1)).slice(0, 20);
  const github = githubCommit && typeof githubCommit === "object" ? {
    available: true,
    repositoryName: cleanText(githubCommit.repositoryName, 120),
    latestCommitMessage: cleanText(githubCommit.message, 240),
    committedAt: cleanText(githubCommit.committedAt, 40),
    snapshotRefreshedAt: cleanText(githubCommit.refreshedAt, 40),
    snapshotFresh: githubFresh === true,
  } : { available: false };
  const missing = [];
  if (!projectContext.description) missing.push("项目简介未填写");
  if (!github.available) missing.push("没有可验证的公开 GitHub 最近提交");
  else if (!github.latestCommitMessage) missing.push("公开 GitHub 最近提交没有摘要");
  if (github.available && !github.committedAt) missing.push("公开 GitHub 最近提交没有时间");
  if (!projectTasks.length) missing.push("当前项目没有关联任务");

  const context = {
    project: projectContext,
    github,
    tasks: projectTasks,
    taskCount: Array.isArray(tasks) ? tasks.length : 0,
    missingSources: missing,
  };
  return {
    context,
    missing,
    hasEvidence: Boolean(projectContext.description && github.latestCommitMessage && github.committedAt && projectTasks.length),
    contextKey: JSON.stringify(context),
  };
}

export function parseProjectNextStepResponse(content) {
  if (typeof content !== "string" || !content.trim()) throw new Error("AI 没有返回建议内容。");
  const stripped = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI 返回内容不是有效的建议 JSON。");
  let parsed;
  try { parsed = JSON.parse(stripped.slice(start, end + 1)); }
  catch { throw new Error("AI 返回内容不是有效的建议 JSON。"); }
  const suggestion = cleanText(parsed?.suggestion, 500);
  const rationale = cleanText(parsed?.rationale, 500);
  if (!rationale) throw new Error("AI 建议缺少依据说明。");
  if (!suggestion && /^资料不足[：:]/.test(rationale)) return { suggestion: "", rationale, insufficient: true };
  if (!suggestion) throw new Error("AI 建议缺少下一步。");
  return { suggestion, rationale, insufficient: false };
}
