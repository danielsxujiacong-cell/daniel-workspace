function cleanText(value, limit) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

export function buildProjectNextStepContext({ project, tasks = [], githubCommit = null, githubFresh = false } = {}) {
  const projectContext = {
    name: cleanText(project?.name, 120),
    description: cleanText(project?.description, 1_000),
    status: cleanText(project?.status, 80),
    stage: cleanText(project?.stage, 120),
    currentNextStep: cleanText(project?.next, 500),
  };
  const projectTasks = (Array.isArray(tasks) ? tasks : []).map((task) => ({
    title: cleanText(task?.title, 180),
    status: task?.status === "done" ? "done" : "todo",
    priority: cleanText(task?.priority, 20),
    due: cleanText(task?.due, 40),
  })).filter((task) => task.title).slice(0, 20);
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
    hasEvidence: Boolean(projectContext.description || github.latestCommitMessage || projectTasks.length),
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
  if (!suggestion || !rationale) throw new Error("AI 建议缺少下一步或依据说明。");
  return { suggestion, rationale };
}
