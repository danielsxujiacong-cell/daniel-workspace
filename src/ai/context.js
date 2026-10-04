const priorityRank = { 高: 0, 中: 1, 低: 2 };

function byRecent(left, right) {
  return (right.createdAt || "").localeCompare(left.createdAt || "");
}

function shortText(value, limit = 500) {
  return typeof value === "string" ? value.slice(0, limit) : "";
}

function githubRepositoryKey(value) {
  const match = String(value || "").match(/^https?:\/\/github\.com\/([^/?#]+\/[^/?#]+)/i);
  return match?.[1].replace(/\.git$/i, "").toLowerCase() || "";
}

function localProjectRecord(localProject) {
  if (!localProject) return null;
  return {
    name: shortText(localProject.name, 120),
    hasGit: localProject.hasGit === true,
    branch: shortText(localProject.branch, 120),
    clean: typeof localProject.clean === "boolean" ? localProject.clean : null,
    ahead: Number.isFinite(localProject.ahead) ? localProject.ahead : null,
    behind: Number.isFinite(localProject.behind) ? localProject.behind : null,
    lastLocalCommit: localProject.lastLocalCommit ? {
      message: shortText(localProject.lastLocalCommit.message, 240),
      committedAt: shortText(localProject.lastLocalCommit.committedAt, 40),
    } : null,
    documents: {
      readme: localProject.documents?.readme === true,
      handoff: localProject.documents?.handoff === true,
      todo: localProject.documents?.todo === true,
      projectContext: localProject.documents?.projectContext === true,
    },
    modifiedAt: shortText(localProject.modifiedAt, 40),
  };
}

function projectRecord(project, localProject = null) {
  return {
    name: shortText(project.name, 120),
    status: shortText(project.status, 80),
    stage: shortText(project.stage, 120),
    next: shortText(project.next, 500),
    description: shortText(project.description, 800),
    localData: localProjectRecord(localProject),
    githubData: project.githubData ? {
      repositoryName: shortText(project.githubData.repositoryName, 120),
      defaultBranch: shortText(project.githubData.defaultBranch, 120),
      updatedAt: shortText(project.githubData.updatedAt, 40),
      latestCommit: project.githubData.latestCommit ? {
        message: shortText(project.githubData.latestCommit.message, 240),
        committedAt: shortText(project.githubData.latestCommit.committedAt, 40),
      } : null,
      refreshedAt: shortText(project.githubData.refreshedAt, 40),
    } : null,
  };
}

function taskRecord(task, projects) {
  return {
    title: shortText(task.title, 240),
    priority: shortText(task.priority || "中", 20),
    status: shortText(task.status, 20),
    due: shortText(task.due, 40),
    project: shortText(projects.find((project) => project.id === task.projectId)?.name || "未关联项目", 120),
  };
}

function knowledgeRecord(item, projects) {
  return {
    title: shortText(item.title, 200),
    type: shortText(item.type, 40),
    summary: shortText(item.summary, 400),
    content: shortText(item.content, 500),
    tags: Array.isArray(item.tags) ? item.tags.slice(0, 8).map((tag) => shortText(tag, 60)) : [],
    project: shortText(projects.find((project) => project.id === item.projectId)?.name || "未关联项目", 120),
    createdAt: shortText(item.createdAt, 40),
  };
}

function decisionRecord(item, projects) {
  return {
    question: shortText(item.question, 300),
    goal: shortText(item.goal, 400),
    options: Array.isArray(item.options) ? item.options.slice(0, 5).map((option) => shortText(option, 240)) : [],
    time: shortText(item.time, 160),
    cost: shortText(item.cost, 160),
    risk: shortText(item.risk, 240),
    recommendation: shortText(item.recommendation, 400),
    final: shortText(item.final, 400),
    reason: shortText(item.reason, 400),
    project: shortText(projects.find((project) => project.id === item.projectId)?.name || "未关联项目", 120),
    createdAt: shortText(item.createdAt, 40),
  };
}

function activityRecord(activity, projects) {
  return {
    title: shortText(activity.title, 180),
    project: shortText(projects.find((project) => project.id === activity.projectId)?.name || "", 120),
    createdAt: shortText(activity.createdAt, 40),
  };
}

function localMatch(project, localProjects) {
  return localProjects.find((item) => {
    const repository = githubRepositoryKey(project.github);
    return (repository && githubRepositoryKey(item.githubRepository) === repository)
      || (project.name.toLowerCase() === item.name?.toLowerCase());
  }) || null;
}

export function buildAssistantContext({
  data,
  currentPage,
  projectId,
  taskFilter = "all",
  localProject = null,
  localProjects = [],
  dashboardModel = null,
  localChanges = [],
  comparisonFirstScan = false,
  selectedContent = "",
  companionStatus = "unavailable",
  companionScannedAt = "",
}) {
  const projects = data.projects || [];
  const tasks = data.tasks || [];
  const knowledge = data.knowledge || [];
  const decisions = data.decisions || [];
  const activities = data.activities || [];
  const storedProject = projects.find((project) => project.id === projectId);
  const projectById = storedProject || (localProject ? { id: localProject.id, name: localProject.name, status: "本地项目" } : null);
  const projectTodos = projectById
    ? tasks.filter((task) => task.projectId === projectById.id).map((task) => taskRecord(task, projects)).slice(0, 20)
    : [];
  const projectMaterials = projectById
    ? knowledge.filter((item) => item.projectId === projectById.id).sort(byRecent).map((item) => knowledgeRecord(item, projects)).slice(0, 12)
    : [];
  const projectActivities = projectById
    ? activities.filter((item) => item.projectId === projectById.id).slice(0, 5).map((item) => activityRecord(item, projects))
    : [];
  const projectDecisions = projectById
    ? decisions.filter((item) => item.projectId === projectById.id).sort(byRecent).map((item) => decisionRecord(item, projects)).slice(0, 10)
    : [];
  const currentProject = projectById ? projectRecord(projectById, localProject) : null;
  let relevantContext = {};

  if (currentPage === "home") {
    const todoTasks = tasks.filter((task) => task.status !== "done")
      .sort((left, right) => (priorityRank[left.priority] ?? 1) - (priorityRank[right.priority] ?? 1));
    relevantContext = {
      dashboard: {
        counts: {
          projects: projects.length,
          activeProjects: projects.filter((project) => project.status === "进行中").length,
          todoTasks: todoTasks.length,
          completedTasks: tasks.length - todoTasks.length,
          knowledge: knowledge.length,
          decisions: decisions.length,
        },
        projects: projects.slice(0, 6).map((project) => projectRecord(project, localMatch(project, localProjects))),
        todoTasks: todoTasks.slice(0, 8).map((task) => taskRecord(task, projects)),
        recentKnowledge: [...knowledge].sort(byRecent).slice(0, 4).map((item) => knowledgeRecord(item, projects)),
        recentDecisions: [...decisions].sort(byRecent).slice(0, 4).map((item) => decisionRecord(item, projects)),
        recentActivities: [...activities].sort(byRecent).slice(0, 5).map((item) => activityRecord(item, projects)),
        localProjects: localProjects.slice(0, 12).map((item) => localProjectRecord(item)),
        localHealth: dashboardModel?.health || null,
        localReminders: (dashboardModel?.alerts || []).slice(0, 5).map(({ projectName, kind, text }) => ({ projectName: shortText(projectName, 120), kind, text: shortText(text, 300) })),
        todayContinue: dashboardModel?.todayContinue ? {
          projectName: shortText(dashboardModel.todayContinue.projectName, 120),
          workspaceStatus: shortText(dashboardModel.todayContinue.workspaceStatus, 120),
          gitStatus: shortText(dashboardModel.todayContinue.gitStatus, 100),
          remoteStatus: shortText(dashboardModel.todayContinue.remoteStatus, 100),
          lastWork: shortText(dashboardModel.todayContinue.lastWork, 300),
          nextStep: shortText(dashboardModel.todayContinue.nextStep, 300),
          priorityTask: dashboardModel.todayContinue.priorityTask ? taskRecord(dashboardModel.todayContinue.priorityTask, projects) : null,
          githubData: dashboardModel.todayContinue.githubData ? {
            repositoryName: shortText(dashboardModel.todayContinue.githubData.repositoryName, 120),
            updatedAt: shortText(dashboardModel.todayContinue.githubData.updatedAt, 40),
            latestCommit: dashboardModel.todayContinue.githubData.latestCommit ? {
              message: shortText(dashboardModel.todayContinue.githubData.latestCommit.message, 240),
              committedAt: shortText(dashboardModel.todayContinue.githubData.latestCommit.committedAt, 40),
            } : null,
          } : null,
          missingDocuments: (dashboardModel.todayContinue.missingDocuments || []).slice(0, 5),
          localProject: localProjectRecord(dashboardModel.todayContinue.localProject),
        } : null,
        recentlyActiveProjects: (dashboardModel?.recentProjects || []).slice(0, 4).map(({ item, project }) => projectRecord(project || { name: item.name, status: "本地项目" }, item)),
        changesSinceLastScan: localChanges.slice(0, 8).map(({ projectName, text, kind }) => ({ projectName: shortText(projectName, 120), text: shortText(text, 240), kind })),
        comparisonFirstScan,
      },
    };
  } else if (currentPage === "project") {
    relevantContext = { project: { todos: projectTodos, relatedMaterials: projectMaterials, recentActivity: projectActivities, decisions: projectDecisions } };
  } else if (currentPage === "projects") {
    relevantContext = { projects: projects.slice(0, 30).map((project) => projectRecord(project, localMatch(project, localProjects))) };
  } else if (currentPage === "knowledge") {
    relevantContext = { knowledge: [...knowledge].sort(byRecent).slice(0, 15).map((item) => knowledgeRecord(item, projects)) };
  } else if (currentPage === "decisions") {
    relevantContext = { decisions: [...decisions].sort(byRecent).slice(0, 15).map((item) => decisionRecord(item, projects)) };
  } else if (currentPage === "tasks") {
    const visibleTasks = taskFilter === "todo" ? tasks.filter((task) => task.status !== "done")
      : taskFilter === "done" ? tasks.filter((task) => task.status === "done") : tasks;
    relevantContext = {
      taskFilter,
      tasks: [...visibleTasks].sort((left, right) => (priorityRank[left.priority] ?? 1) - (priorityRank[right.priority] ?? 1))
        .slice(0, 30).map((task) => taskRecord(task, projects)),
    };
  }

  if (["tasks", "knowledge", "decisions"].includes(currentPage)) {
    relevantContext.projects = projects.slice(0, 10).map((project) => projectRecord(project, localMatch(project, localProjects)));
  }
  relevantContext.companion = {
    status: shortText(companionStatus, 24),
    projectCount: localProjects.length,
    scannedAt: shortText(companionScannedAt, 40),
    mayBeStale: companionStatus !== "ready",
  };

  const selected = shortText(selectedContent.trim(), 1_200);
  if (selected) relevantContext.selectedContent = selected;
  return { currentProject, relevantContext };
}
