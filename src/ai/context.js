const priorityRank = { 高: 0, 中: 1, 低: 2 };

function byRecent(left, right) {
  return (right.createdAt || "").localeCompare(left.createdAt || "");
}

function projectRecord(project) {
  return {
    id: project.id,
    name: project.name,
    status: project.status,
    stage: project.stage || "",
    next: project.next || "",
    description: project.description || "",
  };
}

function taskRecord(task, projects) {
  return {
    id: task.id,
    title: task.title,
    priority: task.priority || "中",
    status: task.status,
    due: task.due || "",
    project: projects.find((project) => project.id === task.projectId)?.name || "未关联项目",
  };
}

function knowledgeRecord(item, projects) {
  return {
    id: item.id,
    title: item.title,
    type: item.type,
    summary: item.summary || "",
    content: (item.content || "").slice(0, 240),
    tags: Array.isArray(item.tags) ? item.tags : [],
    project: projects.find((project) => project.id === item.projectId)?.name || "未关联项目",
    createdAt: item.createdAt || "",
  };
}

function decisionRecord(item, projects) {
  return {
    id: item.id,
    question: item.question,
    goal: item.goal || "",
    options: Array.isArray(item.options) ? item.options : [],
    time: item.time || "",
    cost: item.cost || "",
    risk: item.risk || "",
    recommendation: item.recommendation || "",
    final: item.final || "",
    reason: item.reason || "",
    project: projects.find((project) => project.id === item.projectId)?.name || "未关联项目",
    createdAt: item.createdAt || "",
  };
}

function activityRecord(activity, projects) {
  return {
    title: activity.title,
    project: projects.find((project) => project.id === activity.projectId)?.name || "",
    createdAt: activity.createdAt || "",
  };
}

export function buildAssistantContext({ data, currentPage, projectId, taskFilter = "all" }) {
  const projects = data.projects || [];
  const tasks = data.tasks || [];
  const knowledge = data.knowledge || [];
  const decisions = data.decisions || [];
  const activities = data.activities || [];
  const projectById = projects.find((project) => project.id === projectId);
  const projectTodos = projectById
    ? tasks.filter((task) => task.projectId === projectById.id).map((task) => taskRecord(task, projects))
    : [];
  const projectMaterials = projectById
    ? knowledge.filter((item) => item.projectId === projectById.id).map((item) => knowledgeRecord(item, projects))
    : [];
  const projectActivities = projectById
    ? activities.filter((item) => item.projectId === projectById.id).slice(0, 5).map((item) => activityRecord(item, projects))
    : [];
  const projectDecisions = projectById
    ? decisions.filter((item) => item.projectId === projectById.id).sort(byRecent).map((item) => decisionRecord(item, projects))
    : [];

  const currentProject = projectById ? projectRecord(projectById) : null;

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
        projects: projects.slice(0, 5).map(projectRecord),
        todoTasks: todoTasks.slice(0, 6).map((task) => taskRecord(task, projects)),
        recentKnowledge: [...knowledge].sort(byRecent).slice(0, 4).map((item) => knowledgeRecord(item, projects)),
        recentDecisions: [...decisions].sort(byRecent).slice(0, 4).map((item) => decisionRecord(item, projects)),
        recentActivities: [...activities].sort(byRecent).slice(0, 5).map((item) => activityRecord(item, projects)),
      },
    };
  } else if (currentPage === "project") {
    relevantContext = {
      project: {
        todos: projectTodos,
        relatedMaterials: projectMaterials,
        recentActivity: projectActivities,
        decisions: projectDecisions,
      },
    };
  } else if (currentPage === "projects") {
    relevantContext = { projects: projects.map(projectRecord) };
  } else if (currentPage === "knowledge") {
    relevantContext = { knowledge: [...knowledge].sort(byRecent).map((item) => knowledgeRecord(item, projects)) };
  } else if (currentPage === "decisions") {
    relevantContext = { decisions: [...decisions].sort(byRecent).map((item) => decisionRecord(item, projects)) };
  } else if (currentPage === "tasks") {
    const visibleTasks = taskFilter === "todo" ? tasks.filter((task) => task.status !== "done")
      : taskFilter === "done" ? tasks.filter((task) => task.status === "done") : tasks;
    relevantContext = {
      taskFilter,
      tasks: [...visibleTasks].sort((left, right) => (priorityRank[left.priority] ?? 1) - (priorityRank[right.priority] ?? 1))
        .map((task) => taskRecord(task, projects)),
    };
  }

  return { currentProject, relevantContext };
}
