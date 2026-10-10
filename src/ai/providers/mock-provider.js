const nextIntent = /下一步|优先|建议|做什么|next/i;
const decisionIntent = /决定|选择|决策|整理/i;
const recentChangeIntent = /最近.{0,8}(变化|更新|改动|提交|commit)|变化|仓库|github|commit|提交记录/i;
const issueIntent = /问题|风险|阻塞|异常|缺少|有什么不对|哪里需要|现状怎么样|状态如何|issues?/i;

function taskSummary(task) {
  return `「${task.title}」（${task.priority}优先级，${task.project}）`;
}

function summarizeDecision(decision) {
  return `问题：${decision.question}\n目标：${decision.goal || "未记录"}\n方案：${decision.options.join("；") || "未记录"}\n建议：${decision.recommendation || "未记录"}\n最终决定：${decision.final || "待定"}\n原因：${decision.reason || "未记录"}`;
}

function projectIssueReply(project) {
  const local = project.localData;
  const issues = [];
  if (!local) {
    issues.push("本机扫描状态尚未关联到这个工作台项目。");
  } else if (!local.hasGit) {
    issues.push("本地目录没有 Git 仓库，无法判断提交与远端差异。");
  } else {
    if (local.clean === false) issues.push("工作区有未提交修改，建议先查看变更内容。");
    if (local.gitError) issues.push(`Git 状态读取不完整：${local.gitError}。`);
    if (local.originMain && local.ahead > 0) issues.push(`本地领先 origin/main ${local.ahead} 个 commit，尚未同步到该本地远端引用。`);
    if (local.originMain && local.behind > 0) issues.push(`本地落后 origin/main ${local.behind} 个 commit；比较依据是本地缓存的远端引用。`);
    if (!local.originMain) issues.push("没有本地 origin/main 引用，因此暂时无法比较领先或落后。");
  }

  const docs = local?.documents || {};
  if (local && !docs.readme) issues.push("缺少 README 文档。");
  if (local && !docs.handoff && !docs.projectStatus && !docs.todo) issues.push("未发现 HANDOFF、PROJECT_STATUS 或 TODO 文档。");

  const openTodos = (project.todos || []).filter((task) => task.status !== "done");
  if (openTodos.length) issues.push(`工作台 TODO 有 ${openTodos.length} 项未完成，优先项：${openTodos.slice(0, 2).map((task) => task.title).join("、")}。`);

  const github = project.githubData;
  const githubNote = github
    ? `GitHub 快照：${github.repositoryName || project.name}，默认分支 ${github.defaultBranch || "未知"}，仓库更新时间 ${github.updatedAt || "未知"}${github.latestCommit?.message ? `；最新远端提交「${github.latestCommit.message}」` : ""}。`
    : project.github ? "尚无已缓存的 GitHub 仓库快照；可在 Projects 页面手动刷新公开仓库数据。" : "当前工作台项目没有关联 GitHub 地址。";
  const commitNote = local?.lastLocalCommit
    ? `最近本地 commit：${local.lastLocalCommit.message || "无提交说明"}（${local.lastLocalCommit.sha.slice(0, 12)}）。`
    : local?.hasGit ? "尚未读取到本地 commit。" : "";
  const statusNote = local
    ? `本地 Git：${local.clean === true ? "clean" : local.clean === false ? "有未提交修改" : "状态未知"}；分支 ${local.branch || "未知"}；${local.ahead == null || local.behind == null ? "origin/main 不可比较" : `领先 ${local.ahead} / 落后 ${local.behind}`}。`
    : "";

  return `「${project.name}」当前检查：\n${issues.length ? issues.map((item) => `• ${item}`).join("\n") : "• 没有发现未提交修改、远端差异或关键文档缺失。"}\n${statusNote}${commitNote ? `\n${commitNote}` : ""}\n${githubNote}\n文档检查只确认文件是否存在，不读取 README、HANDOFF 或 TODO 正文。`;
}

export function createMockReply({ message = "", currentPage = "home", currentProject = null, relevantContext = {} } = {}) {
  const dashboard = relevantContext.dashboard;
  const project = currentProject ? { ...(relevantContext.project || {}), ...currentProject } : relevantContext.project;

  if (currentPage === "project") {
    if (!project) return "当前没有打开的项目。请先进入 Projects 选择一个项目，我就能读取它的进度和资料。";
    const openTodos = (project.todos || []).filter((task) => task.status !== "done");
    const materialNames = (project.relatedMaterials || []).slice(0, 3).map((item) => item.title);
    if (issueIntent.test(message)) return projectIssueReply(project);
    if (recentChangeIntent.test(message) && !decisionIntent.test(message)) {
      const github = project.githubData;
      if (!github) {
        const latestActivity = project.recentActivity?.[0];
        return `「${project.name}」还没有可用的 GitHub 快照。${latestActivity ? `本地最近活动：${latestActivity.title}。` : ""}可在 Projects 页面刷新公开仓库数据。`;
      }
      const latest = github.latestCommit;
      return `「${project.name}」的 GitHub 仓库是 ${github.repositoryName || project.name}（${github.defaultBranch || "默认分支未知"}）。最近更新时间：${github.updatedAt || "未知"}。${latest ? `最近一次 commit：${latest.message || "无提交说明"}${latest.sha ? `（${latest.sha}）` : ""}，时间：${latest.committedAt || "未知"}。` : "仓库目前没有可读取的 commit。"}${github.pagesUrl ? `\nGitHub Pages${github.pagesUrlEstimated ? " 默认地址" : ""}：${github.pagesUrl}` : ""}`;
    }
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
    const local = dashboard.todayContinue;
    const health = dashboard.localHealth;
    const healthSummary = health
      ? `本地扫描 ${health.total} 个项目：Clean ${health.clean}，未提交修改 ${health.dirty}，领先 ${health.ahead}，落后 ${health.behind}；缺 README ${health.missingReadme}、HANDOFF ${health.missingHandoff}、TODO ${health.missingTodo}，超过 ${health.staleDays} 天未更新 ${health.stale}。`
      : "当前没有可用的本机扫描数据。";
    if (nextIntent.test(message)) {
      if (local) {
        if (local.source === "cloud") {
          const nextStep = local.priorityTask
            ? `优先完成「${local.priorityTask.title}」（${local.priorityTask.priority}优先级${local.priorityTask.due ? `，${local.priorityTask.due}到期` : ""}）。`
            : `下一步：${local.nextStep}。`;
          return `根据当前账号的云端资料，建议继续「${local.projectName}」（${local.workspaceStatus}）。${local.lastWork}。${nextStep}`;
        }
        const github = local.githubData;
        return `根据本地 Git、项目修改时间、GitHub 快照、工作台待办和文档存在状态，今天建议继续「${local.projectName}」。\n最近进展：${local.lastWork}。\n当前状态：${local.workspaceStatus}；${local.gitStatus}；${local.remoteStatus}。\n下一步：${local.nextStep}。${local.priorityTask ? `\n关联待办：${local.priorityTask.title}（${local.priorityTask.priority}优先级${local.priorityTask.due ? `，${local.priorityTask.due}到期` : ""}）。` : ""}${local.missingDocuments?.length ? `\n缺少项目记录：${local.missingDocuments.join("、")}。` : ""}${github ? `\nGitHub：${github.repositoryName || local.projectName}，更新时间 ${github.updatedAt || "未知"}${github.latestCommit?.message ? `，最近 commit「${github.latestCommit.message}」` : ""}。` : ""}\n${healthSummary}`;
      }
      return `Dashboard 里有 ${counts.activeProjects} 个进行中的工作台项目、${counts.todoTasks} 项待办。${healthSummary}建议先处理${firstTask ? taskSummary(firstTask) : "启动本地 Companion 后查看今日继续建议"}。`;
    }
    if (issueIntent.test(message)) {
      const reminders = dashboard.localReminders || [];
      return `${healthSummary}${reminders.length ? `\n今天需要处理：\n${reminders.map((item) => `• ${item.projectName}：${item.text}`).join("\n")}` : "\n当前扫描没有生成需要处理的提醒。"}`;
    }
    if (recentChangeIntent.test(message)) {
      const changes = dashboard.changesSinceLastScan || [];
      if (dashboard.comparisonFirstScan) return "本次扫描已建立对比基线；下次扫描时才能判断新 commit、状态变化或同步情况。";
      return changes.length
        ? `自上次扫描后发现 ${changes.length} 项变化：\n${changes.map((item) => `• ${item.projectName}：${item.text}`).join("\n")}`
        : "自上次扫描后暂无新的项目变化。";
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
    return `Dashboard 概况：${healthSummary}${local ? `\n今日继续：${local.projectName} · ${local.nextStep}` : ""}${dashboard.changesSinceLastScan?.length ? `\n自上次扫描：${dashboard.changesSinceLastScan.slice(0, 3).map((item) => `${item.projectName} ${item.text}`).join("；")}` : ""}${firstTask ? `\n工作台待办：${firstTask.title}（${firstTask.priority}优先级）。` : ""}${recentKnowledge ? `\n最近资料：${recentKnowledge.title}。` : ""}${recentDecision ? `\n最近决策：${recentDecision.question} · ${recentDecision.final || "待定"}。` : ""}${recentActivity ? `\n最近活动：${recentActivity.title}` : ""}`;
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
