export const STALE_PROJECT_DAYS = 30;
const dayMs = 24 * 60 * 60 * 1000;

function identityHash(value) {
  let hash = 14695981039346656037n;
  for (const character of String(value || "").toLowerCase()) {
    hash ^= BigInt(character.codePointAt(0));
    hash = (hash * 1099511628211n) & 0xffffffffffffffffn;
  }
  return hash.toString(36);
}

function numeric(value) {
  if (value === null || value === undefined || value === "") return null;
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function filePresent(documents, key) {
  return Boolean(documents?.[key]);
}

export function makeLocalScanBaseline(items, scannedAt = new Date().toISOString()) {
  return {
    version: 1,
    scannedAt,
    items: (Array.isArray(items) ? items : []).map((item) => ({
      key: identityHash(item.id || item.path || item.name),
      hasGit: item.hasGit === true,
      branch: item.branch || "",
      head: item.head || "",
      originMain: item.originMain || "",
      clean: typeof item.clean === "boolean" ? item.clean : null,
      ahead: numeric(item.ahead),
      behind: numeric(item.behind),
      modifiedAt: item.modifiedAt || "",
      documents: {
        readme: filePresent(item.documents, "readme"),
        handoff: filePresent(item.documents, "handoff"),
        todo: filePresent(item.documents, "todo"),
      },
    })),
  };
}

export function compareLocalProjects(items, previous, scannedAt = new Date().toISOString()) {
  const current = makeLocalScanBaseline(items, scannedAt);
  if (!previous?.items) return { current, changes: [], firstScan: true };

  const priorByKey = new Map(previous.items.map((item) => [item.key, item]));
  const changes = [];
  for (const project of items || []) {
    const key = identityHash(project.id || project.path || project.name);
    const prior = priorByKey.get(key);
    if (!prior) {
      changes.push({ projectId: project.id, projectName: project.name, text: "新发现本地项目", kind: "new" });
      continue;
    }

    const next = current.items.find((item) => item.key === key);
    const headChanged = prior.head && next.head && prior.head !== next.head;
    if (headChanged) {
      changes.push({ projectId: project.id, projectName: project.name, text: `出现新 commit · ${project.lastLocalCommit?.message || next.head.slice(0, 8)}`, kind: "commit" });
    }

    const synchronized = (prior.ahead > 0 || prior.behind > 0)
      && next.ahead === 0 && next.behind === 0
      && next.head && next.head === next.originMain;
    if (synchronized) {
      changes.push({ projectId: project.id, projectName: project.name, text: "本地与 origin/main 已同步", kind: "sync" });
    }
    const gitStateChanged = prior.clean !== next.clean || prior.branch !== next.branch || prior.ahead !== next.ahead || prior.behind !== next.behind;
    if (!headChanged && !gitStateChanged && prior.modifiedAt && next.modifiedAt && prior.modifiedAt !== next.modifiedAt) {
      changes.push({ projectId: project.id, projectName: project.name, text: "本地文件最近修改时间有变化", kind: "status" });
    }
    if (prior.clean !== next.clean && next.clean !== null) {
      changes.push({
        projectId: project.id,
        projectName: project.name,
        text: next.clean ? "工作区状态变为 Clean" : "从 Clean 变为有未提交修改",
        kind: "status",
      });
    }
    if (prior.branch !== next.branch && next.branch) {
      changes.push({ projectId: project.id, projectName: project.name, text: `分支切换到 ${next.branch}`, kind: "status" });
    }
    if (prior.ahead !== next.ahead && next.ahead !== null) {
      changes.push({ projectId: project.id, projectName: project.name, text: `领先 origin/main 数量变为 ${next.ahead}`, kind: "status" });
    }
    if (prior.behind !== next.behind && next.behind !== null) {
      changes.push({ projectId: project.id, projectName: project.name, text: `落后 origin/main 数量变为 ${next.behind}`, kind: "status" });
    }

    for (const keyName of ["readme", "handoff", "todo"]) {
      if (prior.documents?.[keyName] !== next.documents[keyName]) {
        const label = { readme: "README", handoff: "HANDOFF", todo: "TODO" }[keyName];
        changes.push({
          projectId: project.id,
          projectName: project.name,
          text: next.documents[keyName] ? `新增 ${label} 文档` : `${label} 文档已不在扫描结果中`,
          kind: "document",
        });
      }
    }
  }

  const order = { commit: 0, sync: 1, new: 2, status: 3, document: 4 };
  changes.sort((left, right) => (order[left.kind] ?? 9) - (order[right.kind] ?? 9));
  return { current, changes, firstScan: false };
}

function timestamp(value) {
  const parsed = new Date(value || "").getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function latestTimestamp(...values) {
  return Math.max(0, ...values.map(timestamp));
}

function localActivityTime(item, workspaceProject) {
  return latestTimestamp(
    item?.modifiedAt,
    item?.lastLocalCommit?.committedAt,
    workspaceProject?.githubData?.updatedAt,
  );
}

function daysOld(value, now) {
  const time = timestamp(value);
  return time ? Math.floor(Math.max(0, now - time) / dayMs) : null;
}

function taskPriority(task) {
  return ({ 高: 3, 中: 2, 低: 1 })[task?.priority] ?? 2;
}

function taskPriorityLabel(task) {
  return ["高", "中", "低"].includes(task?.priority) ? task.priority : "中";
}

function taskUrgency(task) {
  const due = String(task?.due || "");
  return due === "今天" ? 4 : due === "明天" ? 2 : due ? 1 : 0;
}

function documentGaps(project) {
  const documents = project?.documents || {};
  return [
    !documents.readme && "README",
    !documents.handoff && "HANDOFF",
    !documents.todo && "TODO",
  ].filter(Boolean);
}

const documentTaskIssues = [
  { key: "readme", issueType: "missing_readme", label: "README" },
  { key: "handoff", issueType: "missing_handoff", label: "HANDOFF" },
  { key: "todo", issueType: "missing_todo", label: "TODO" },
  { key: "projectStatus", issueType: "missing_project_status", label: "PROJECT_STATUS" },
];

function documentIssueForTask(task, localProject) {
  const name = String(localProject?.name || "").trim();
  if (!name) return null;
  return documentTaskIssues.find((issue) => {
    const sourceKey = `ai-suggestion:${identityHash(`${name}|${issue.issueType}`)}`;
    return task.sourceKey === sourceKey
      || task.id === sourceKey
      || task.title === `补齐 ${name} 的 ${issue.label}`;
  }) || null;
}

function resolvedDocumentTaskIssue(task, localProject) {
  const issue = documentIssueForTask(task, localProject);
  return issue && filePresent(localProject?.documents, issue.key) ? issue : null;
}

function compareTasks(left, right) {
  const priority = taskPriority(right) - taskPriority(left);
  if (priority) return priority;
  const urgency = taskUrgency(right) - taskUrgency(left);
  if (urgency) return urgency;
  return latestTimestamp(right.updatedAt, right.createdAt) - latestTimestamp(left.updatedAt, left.createdAt);
}

export function buildLocalDashboardModel({ items = [], tasks = [], projectForLocal = () => null, now = Date.now() } = {}) {
  const workspaceFor = new Map();
  const tasksFor = new Map();
  const projectKey = (project) => project?.id || "";
  for (const item of items) {
    const workspace = projectForLocal(item);
    if (workspace) workspaceFor.set(item.id, workspace);
  }
  for (const task of tasks) {
    if (task.status === "done" || !task.projectId) continue;
    const list = tasksFor.get(task.projectId) || [];
    list.push(task);
    tasksFor.set(task.projectId, list);
  }

  const linkedActivity = (item) => localActivityTime(item, workspaceFor.get(item.id));
  const recentProjects = [...items]
    .map((item) => ({ item, project: workspaceFor.get(item.id) || null, activityAt: linkedActivity(item) }))
    .sort((left, right) => right.activityAt - left.activityAt)
    .slice(0, 4);

  const scored = items.map((item) => {
    const project = workspaceFor.get(item.id) || null;
    const linkedTasks = project ? (tasksFor.get(projectKey(project)) || []) : [];
    const documentSuggestionTasks = tasks.filter((task) => task.status !== "done" && documentIssueForTask(task, item));
    const projectTasks = [...new Map([...linkedTasks, ...documentSuggestionTasks].map((task) => [task.id, task])).values()];
    const resolvedTasks = projectTasks.flatMap((task) => {
      const issue = resolvedDocumentTaskIssue(task, item);
      return issue ? [{ id: task.id, title: task.title, documentLabel: issue.label }] : [];
    });
    const actionableTasks = projectTasks.filter((task) => !resolvedDocumentTaskIssue(task, item));
    const firstTask = [...actionableTasks].sort(compareTasks)[0] || null;
    const gaps = documentGaps(item);
    const activityAt = linkedActivity(item);
    const age = activityAt ? (now - activityAt) / dayMs : 90;
    const freshness = age <= 1 ? 10 : age <= 7 ? 7 : age <= 30 ? 3 : 0;
    const score = (project?.status === "进行中" ? 10 : 0)
      + (firstTask ? taskPriority(firstTask) * 5 + taskUrgency(firstTask) * 2 : 0)
      + (item.hasGit && item.clean === false ? 15 : 0)
      + (Number(item.behind) > 0 ? 14 : 0)
      + (Number(item.ahead) > 0 ? 6 : 0)
      + Math.min(gaps.length, 3)
      + freshness;
    return { item, project, projectTasks, firstTask, gaps, activityAt, score, resolvedTasks };
  }).sort((left, right) => right.score - left.score || right.activityAt - left.activityAt);

  const today = scored[0] || null;
  const resolvedTasks = scored.flatMap(({ item: scannedProject, resolvedTasks: projectResolvedTasks }) =>
    projectResolvedTasks.map((task) => ({ ...task, projectName: scannedProject.name })),
  );
  const item = today?.item;
  const project = today?.project;
  const workText = item?.lastLocalCommit?.message
    ? `最近本地 commit：${item.lastLocalCommit.message}`
    : project?.githubData?.latestCommit?.message
      ? `GitHub 最近 commit：${project.githubData.latestCommit.message}`
      : item?.modifiedAt
        ? `本地文件最近修改于 ${new Date(item.modifiedAt).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
        : "尚无可用的提交或修改时间";
  const gitStatus = !item?.hasGit ? "没有 Git 仓库"
    : item.clean === true ? "Clean"
      : item.clean === false ? "有未提交修改"
        : "Git 状态未知";
  const remoteStatus = item?.ahead == null || item?.behind == null
    ? "origin/main 不可比较"
    : `领先 ${item.ahead} · 落后 ${item.behind}`;
  const workspaceStatus = project ? `${project.status}${project.stage ? ` · ${project.stage}` : ""}` : "尚未关联工作台项目";
  const priorityTask = today?.firstTask || null;
  let nextStep = priorityTask
    ? `处理「${taskPriorityLabel(priorityTask)}」优先级待办「${priorityTask.title}」${priorityTask.due === "今天" ? "（今天到期）" : ""}`
    : Number(item?.behind) > 0
      ? "先查看与 origin/main 的差异，再手动决定同步方式"
      : item?.clean === false
        ? "先查看未提交修改，确认需要保留的内容"
        : Number(item?.ahead) > 0
          ? "检查本地领先的 commit，确认后再自行同步"
          : today?.gaps?.length
            ? `补齐缺失的 ${today.gaps.join("、")} 项目记录`
            : project?.next || "查看最近进度，确定一个可完成的小步骤";

  const health = {
    total: items.length,
    clean: items.filter((entry) => entry.hasGit && entry.clean === true).length,
    dirty: items.filter((entry) => entry.hasGit && entry.clean === false).length,
    ahead: items.filter((entry) => entry.hasGit && Number(entry.ahead) > 0).length,
    behind: items.filter((entry) => entry.hasGit && Number(entry.behind) > 0).length,
    missingReadme: items.filter((entry) => !entry.documents?.readme).length,
    missingHandoff: items.filter((entry) => !entry.documents?.handoff).length,
    missingTodo: items.filter((entry) => !entry.documents?.todo).length,
    staleDays: STALE_PROJECT_DAYS,
    stale: items.filter((entry) => {
      const activity = localActivityTime(entry, workspaceFor.get(entry.id));
      return activity > 0 && now - activity > STALE_PROJECT_DAYS * dayMs;
    }).length,
  };

  const alerts = [];
  for (const entry of items) {
    const findings = [];
    if (entry.hasGit && entry.clean === false) findings.push({ kind: "dirty", text: "有未提交修改", priority: 0 });
    if (entry.hasGit && Number(entry.behind) > 0) findings.push({ kind: "behind", text: `落后 origin/main ${entry.behind} 个 commit`, priority: 1 });
    if (entry.hasGit && Number(entry.ahead) > 0) findings.push({ kind: "ahead", text: `领先 origin/main ${entry.ahead} 个 commit`, priority: 2 });
    if (!entry.hasGit) findings.push({ kind: "no-git", text: "目录没有 Git 仓库", priority: 2 });
    if (!entry.documents?.readme) findings.push({ kind: "readme", text: "缺少 README", priority: 3 });
    if (!entry.documents?.handoff) findings.push({ kind: "handoff", text: "缺少 HANDOFF", priority: 4 });
    if (!entry.documents?.todo) findings.push({ kind: "todo", text: "缺少 TODO", priority: 5 });
    const age = daysOld(localActivityTime(entry, workspaceFor.get(entry.id)), now);
    if (age !== null && age > STALE_PROJECT_DAYS) findings.push({ kind: "stale", text: `超过 ${STALE_PROJECT_DAYS} 天未更新`, priority: 6 });
    if (findings.length) {
      findings.sort((left, right) => left.priority - right.priority);
      alerts.push({
        projectId: entry.id,
        projectName: entry.name,
        kind: findings[0].kind,
        text: `${findings.slice(0, 2).map((finding) => finding.text).join(" · ")}${findings.length > 2 ? ` · 另有 ${findings.length - 2} 项` : ""}`,
        priority: findings[0].priority,
      });
    }
  }
  alerts.sort((left, right) => left.priority - right.priority || left.projectName.localeCompare(right.projectName, "zh-CN"));

  return {
    health,
    alerts: alerts.slice(0, 5),
    recentProjects,
    todayContinue: today ? {
      source: "local",
      projectId: project?.id || null,
      localProjectId: item.id,
      projectName: project?.name || item.name,
      workspaceStatus,
      gitStatus,
      remoteStatus,
      lastWork: workText,
      nextStep,
      priorityTask: priorityTask ? { title: priorityTask.title, priority: taskPriorityLabel(priorityTask), due: priorityTask.due || "" } : null,
      resolvedTasks,
      localProject: item,
      githubData: project?.githubData || null,
      missingDocuments: today.gaps,
      modifiedAt: item.modifiedAt || "",
    } : null,
  };
}

export function buildCloudDashboardModel({ projects = [], tasks = [] } = {}) {
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const openTasks = tasks.filter((task) => task.status !== "done");
  const selectedTask = [...openTasks].sort(compareTasks)[0] || null;
  const selectedProject = selectedTask
    ? projectById.get(selectedTask.projectId) || null
    : [...projects].sort((left, right) => {
      const active = Number(right.status === "进行中") - Number(left.status === "进行中");
      return active || latestTimestamp(right.updatedAt, right.createdAt) - latestTimestamp(left.updatedAt, left.createdAt);
    })[0] || null;

  if (!selectedTask && !selectedProject) return { source: "cloud", todayContinue: null };

  const projectName = selectedProject?.name || (selectedTask ? "未关联项目待办" : "云端项目");
  const priorityTask = selectedTask ? {
    id: selectedTask.id,
    title: selectedTask.title,
    priority: taskPriorityLabel(selectedTask),
    due: selectedTask.due || "",
  } : null;
  const lastWork = selectedTask
    ? `云端待办：${selectedTask.title}`
    : selectedProject.description || selectedProject.next || `云端项目状态：${selectedProject.status || "未设置"}`;
  const nextStep = selectedTask
    ? `处理「${taskPriorityLabel(selectedTask)}」优先级待办「${selectedTask.title}」${selectedTask.due === "今天" ? "（今天到期）" : ""}`
    : selectedProject.next || "查看云端项目资料，确定一个可完成的小步骤";

  return {
    source: "cloud",
    todayContinue: {
      source: "cloud",
      projectId: selectedProject?.id || null,
      taskId: selectedTask?.id || null,
      projectName,
      workspaceStatus: selectedProject?.status || (selectedTask ? "云端待办" : "云端项目"),
      gitStatus: "本机扫描不可用",
      remoteStatus: "Git 状态未读取",
      lastWork,
      nextStep,
      priorityTask,
      localProject: null,
      githubData: selectedProject?.githubData || null,
      missingDocuments: [],
      modifiedAt: "",
      updatedAt: selectedTask?.updatedAt || selectedProject?.updatedAt || "",
    },
  };
}
