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
    hasEvidence: Boolean(projectContext.description && github.available && github.latestCommitMessage && github.committedAt),
    contextKey: JSON.stringify(context),
  };
}

export function buildProjectNextStepPrompt() {
  return [
    "你正在为一个具体软件项目制定下一步行动，不要给通用项目管理建议。",
    "先读取 Workspace Context JSON 中的 project.description、github.latestCommitMessage、github.committedAt、project.currentNextStep 和 tasks。项目简介与有效的最近 Commit 摘要及时间足以生成；tasks 仅作补充，列表为空时绝不能仅因此返回资料不足。",
    "紧扣最近 Commit 摘要所述的真实功能或修复，结合项目简介提出一条小而具体、可以验收的下一步。优先给出该功能的关键路径、边界情况或尚未覆盖行为的实际验证场景；不得把 Commit 等同于发布或完整交付。若有相关未完成任务可用于补充，没有任务时只依据简介和 Commit。",
    "suggestion 必须采用“针对[明确场景]，执行[具体动作]；验收标准是[可观察结果]”的形式，点名功能/对象；不要只写“检查/验证是否正确”。依据要简短引用真实 Commit 摘要和时间，并解释下一步如何承接该提交及项目目标；只有任务确实相关时才引用任务。不得假设 Commit 摘要未提供的实现细节。",
    "若 tasks 是空数组，任务列表为空是有效输入；优先围绕简介中的功能和最近 Commit 给出可操作的验收场景，不得建议先补任务或因此声称资料不足。如果最近 Commit 明确修改 AI 建议的上下文传递，应具体建议用“有简介和该 Commit、无关联任务”的项目生成一次建议，并检查返回非空且依据引用该 Commit；只在提交内容确实相关时使用这个场景。",
    "只有当项目简介、最近 Commit 摘要/时间及（若存在的）任务都无法支持任何具体且诚实的行动时，才返回资料不足；不得把缺少任务本身当成理由。",
    "禁止空泛建议或只要求创建任务，例如“创建一个任务”“继续推进”“进一步优化”“完善项目”；不得虚构测试结果、代码进度、已完成状态、发布状态、期限或任务。",
    "严格只返回 JSON：{\"suggestion\":\"一条可执行行动\",\"rationale\":\"基于实际简介、Commit 摘要和时间的简短依据，可补充相关任务\"}。确实没有足够有效资料时返回 {\"suggestion\":\"\",\"rationale\":\"资料不足：具体缺少或无法判断的内容\"}。",
  ].join("\n");
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
