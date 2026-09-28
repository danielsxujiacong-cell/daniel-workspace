const nextIntent = /下一步|优先|建议|做什么|next/i;
const decisionIntent = /决定|选择|决策|整理/i;

function taskSummary(task) {
  return `「${task.title}」（${task.priority}优先级，${task.project}）`;
}

function summarizeDecision(decision) {
  return `问题：${decision.question}\n目标：${decision.goal || "未记录"}\n方案：${decision.options.join("；") || "未记录"}\n建议：${decision.recommendation || "未记录"}\n最终决定：${decision.final || "待定"}\n原因：${decision.reason || "未记录"}`;
}

export function createMockReply({ message = "", currentPage = "home", currentProject = null, relevantContext = {} } = {}) {
  const dashboard = relevantContext.dashboard;
  const project = currentProject ? { ...(relevantContext.project || {}), ...currentProject } : relevantContext.project;

  if (currentPage === "project") {
    if (!project) return "当前没有打开的项目。请先进入 Projects 选择一个项目，我就能读取它的进度和资料。";
    const openTodos = (project.todos || []).filter((task) => task.status !== "done");
    const materialNames = (project.relatedMaterials || []).slice(0, 3).map((item) => item.title);
    if (nextIntent.test(message)) {
      return `「${project.name}」当前在${project.stage || "阶段未设置"}阶段，状态为${project.status}。项目记录的下一步：${project.next || "尚未填写"}。${openTodos[0] ? `优先待办是${taskSummary(openTodos[0])}。` : "当前没有未完成任务。"}`;
    }
    if (decisionIntent.test(message) && project.decisions?.length) {
      return `「${project.name}」最近的决策：\n${summarizeDecision(project.decisions[0])}`;
    }
    return `「${project.name}」目前处于${project.status} · ${project.stage || "阶段未设置"}。${project.description ? `\n项目目标：${project.description}` : ""}\n下一步：${project.next || "尚未填写"}\nTODO：${openTodos.length ? openTodos.map((task) => `${task.title}（${task.priority}）`).join("；") : "当前没有未完成任务"}\n相关资料：${materialNames.length ? materialNames.join("、") : "暂无"}`;
  }

  if (currentPage === "home") {
    if (!dashboard) return "Dashboard 当前还没有可用数据。添加一个项目或任务后，我可以根据工作区现状建议下一步。";
    const counts = dashboard.counts;
    const firstTask = dashboard.todoTasks[0];
    if (nextIntent.test(message)) {
      return `Dashboard 里有 ${counts.activeProjects} 个进行中的项目、${counts.todoTasks} 项待办。建议先处理${firstTask ? taskSummary(firstTask) : "最近活跃项目的下一步"}。${firstTask ? `\n打开任务「${firstTask.title}」后就可以推进「${firstTask.project}」。` : "\n当前没有未完成任务，可以检查最近决策和项目下一步。"}`;
    }
    if (/资料|知识|收件箱|knowledge|inbox/i.test(message)) {
      const records = dashboard.recentKnowledge || [];
      return records.length
        ? `Dashboard 最近资料共显示 ${records.length} 条：\n${records.map((item, index) => `${index + 1}. ${item.title} — ${item.summary || item.content}`).join("\n")}`
        : "Dashboard 暂无最近资料。可以去 Knowledge 添加文本、笔记或链接。";
    }
    if (decisionIntent.test(message)) {
      const decisions = dashboard.recentDecisions || [];
      return decisions.length
        ? `Dashboard 最近记录了 ${decisions.length} 条决策。最近一条：\n${summarizeDecision(decisions[0])}\n关联项目：${decisions[0].project}`
        : "Dashboard 目前没有历史决策。创建一条决策后，我可以帮你整理目标和取舍。";
    }
    const recentProject = dashboard.projects[0];
    const recentActivity = dashboard.recentActivities[0];
    const recentKnowledge = dashboard.recentKnowledge[0];
    const recentDecision = dashboard.recentDecisions[0];
    return `Dashboard 概况：${counts.projects} 个项目（进行中 ${counts.activeProjects} 个）、${counts.todoTasks} 项待办、${counts.knowledge} 条资料、${counts.decisions} 条决策。${recentProject ? `\n最近项目：${recentProject.name}，当前阶段${recentProject.stage || "未设置"}。` : ""}${firstTask ? `\n优先待办：${firstTask.title}（${firstTask.priority}优先级）。` : ""}${recentKnowledge ? `\n最近资料：${recentKnowledge.title}。` : ""}${recentDecision ? `\n最近决策：${recentDecision.question} · ${recentDecision.final || "待定"}。` : ""}${recentActivity ? `\n最近活动：${recentActivity.title}` : ""}`;
  }

  if (currentPage === "project" || project) {
    return "当前没有匹配到项目上下文。你可以从 Projects 页面打开项目后再问我。";
  }

  if (currentPage === "knowledge") {
    const records = relevantContext.knowledge || [];
    if (!records.length) return "Knowledge / Inbox 目前没有资料。可以先添加文本、笔记或链接，我会根据标题、摘要、标签和关联项目整理。";
    const tags = [...new Set(records.flatMap((item) => item.tags || []))].slice(0, 8);
    return `当前收件箱有 ${records.length} 条资料。最近内容：\n${records.slice(0, 4).map((item, index) => `${index + 1}. ${item.title} — ${item.summary || item.content || "暂无摘要"}（${item.project}）`).join("\n")}\n常用标签：${tags.length ? tags.join("、") : "尚无标签"}`;
  }

  if (currentPage === "decisions" || decisionIntent.test(message)) {
    const decisions = relevantContext.decisions || [];
    if (!decisions.length) return "当前决策列表没有记录。创建决策后，我可以按目标、方案、成本、风险和最终原因帮你整理。";
    return decisions.length === 1 || /最近|整理|决定|决策/.test(message)
      ? `根据当前决策记录整理如下：\n${summarizeDecision(decisions[0])}\n关联项目：${decisions[0].project}`
      : `当前有 ${decisions.length} 条决策，最近一条是「${decisions[0].question}」，最终选择：${decisions[0].final || "待定"}。`;
  }

  if (currentPage === "tasks") {
    const tasks = relevantContext.tasks || [];
    const openTasks = tasks.filter((task) => task.status !== "done");
    const completeCount = tasks.length - openTasks.length;
    if (!tasks.length) return "当前筛选下没有任务。切换状态筛选或新建任务后，我可以帮你安排优先级。";
    const firstTask = openTasks[0];
    return `当前任务视图有 ${openTasks.length} 项待办、${completeCount} 项已完成。${firstTask ? `\n按优先级建议先处理${taskSummary(firstTask)}，到期提示：${firstTask.due || "未设置"}。` : "\n当前视图里的任务已全部完成。"}任务状态筛选为「${relevantContext.taskFilter || "all"}」。`;
  }

  if (currentPage === "projects") {
    const projects = relevantContext.projects || [];
    if (!projects.length) return "目前还没有项目。创建一个项目后，我可以根据它的阶段和下一步帮你梳理。";
    return `项目列表共有 ${projects.length} 个项目：\n${projects.slice(0, 5).map((item) => `${item.name}：${item.status} · ${item.stage || "阶段未设置"}；下一步：${item.next || "未填写"}`).join("\n")}`;
  }

  return "我会根据当前页面提供的本地数据来回答。可以问我项目进度、资料摘要、决策取舍或任务优先级。";
}

export async function mockProviderChat(request) {
  return {
    message: { role: "assistant", content: createMockReply(request) },
    provider: "mock",
  };
}
