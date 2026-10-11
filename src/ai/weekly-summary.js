const text = (value, limit = 280) => typeof value === "string" ? value.trim().slice(0, limit) : "";
const SECTIONS = ["completed", "progress", "issues", "nextWeek"];
const isGenericNextStep = (value) => /^(?:创建(?:一个)?(?:任务|待办)|继续推进|进一步优化|持续优化|继续开发|继续完善)/i.test(value || "");

export function shanghaiDateKey(value = Date.now()) {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const fields = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}

export function getWeeklySummaryRange(value = Date.now()) {
  const today = shanghaiDateKey(value);
  const date = new Date(`${today}T00:00:00.000Z`);
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return { startDate: date.toISOString().slice(0, 10), endDate: today };
}

export function buildWeeklySummaryContext(projects = [], workLogs = [], githubActivity = [], range = getWeeklySummaryRange()) {
  const projectList = (Array.isArray(projects) ? projects : []).map((project) => ({
    name: text(project.name, 100),
    status: text(project.status, 50),
    stage: text(project.stage, 70),
    nextStep: text(project.next, 100),
  })).filter((project) => project.name);
  const projectNameById = new Map((projects || []).map((project) => [String(project.id), text(project.name, 120)]));
  const logs = (Array.isArray(workLogs) ? workLogs : [])
    .filter((log) => log?.workDate >= range.startDate && log?.workDate <= range.endDate)
    .sort((left, right) => right.workDate.localeCompare(left.workDate) || (right.updatedAt || "").localeCompare(left.updatedAt || ""))
    .slice(0, 15)
    .map((log) => ({
      project: projectNameById.get(String(log.projectId)) || "",
      date: text(log.workDate, 10),
      completedItems: text(log.completedItems, 180),
      outcomes: text(log.outcomes, 130),
      nextStep: text(log.nextStep, 100),
      evidenceCount: Array.isArray(log.evidenceLinks) ? log.evidenceLinks.length : 0,
    }))
    .filter((log) => log.project && log.date);
  const startMs = Date.parse(`${range.startDate}T00:00:00+08:00`);
  const endMs = Date.parse(`${range.endDate}T23:59:59.999+08:00`);
  const commits = (Array.isArray(githubActivity) ? githubActivity : []).flatMap((project) => [
    ...(project.commitsLast24Hours || []), ...(project.commitsDays1To7 || []),
  ].map((commit) => ({
    project: text(project.name, 120),
    message: text(commit.message, 240),
    committedAt: text(commit.committedAt, 40),
  }))).filter((commit) => {
    const timestamp = Date.parse(commit.committedAt);
    return commit.project && commit.message && Number.isFinite(timestamp) && timestamp >= startMs && timestamp <= endMs;
  }).slice(0, 10);
  const projectStateLines = projectList.map((project) =>
    `${project.name} | status=${project.status || "未设置"} | stage=${project.stage || "未设置"} | next=${project.nextStep || "未设置"}`.slice(0, 132));
  const workLogLines = logs.map((log) =>
    `${log.date} | ${log.project} | 完成=${log.completedItems} | 成果=${log.outcomes} | 下一步=${log.nextStep} | 证据链接数=${log.evidenceCount}`.slice(0, 300));
  const commitLines = commits.map((commit) => `${commit.project} | ${commit.message} | ${commit.committedAt}`.slice(0, 220));
  return {
    range: { startDate: range.startDate, endDate: range.endDate },
    facts: { projectStates: projectStateLines, workLogs: workLogLines, githubCommits: commitLines },
    references: { projects: projectList.slice(0, 40), workLogs: logs, githubCommits: commits },
  };
}

export function buildWeeklySummaryPrompt(range) {
  return [
    `生成中文本周工作总结，统计范围为 ${range.startDate} 至 ${range.endDate}（Asia/Shanghai，本周截至今日）。只根据输入的 Workspace 项目状态、真实已验证 GitHub 提交和本周 Supabase 工作记录。`,
    "只返回 JSON：{\"completed\":[{\"project\":\"项目名\",\"text\":\"本周完成成果\",\"basis\":\"工作记录日期及完成事项/成果原文短语，或 GitHub 提交摘要及 ISO 时间\"}],\"progress\":[{\"project\":\"项目名\",\"text\":\"项目推进情况\",\"basis\":\"带日期的工作记录或 GitHub 提交证据\"}],\"issues\":[{\"project\":\"项目名\",\"text\":\"已明确记录的问题\",\"basis\":\"工作记录中的原文依据或明确受阻状态\"}],\"nextWeek\":[{\"project\":\"项目名\",\"text\":\"下周可执行计划\",\"basis\":\"工作记录 nextStep 或项目已确认 nextStep 原文\"}]}。每个数组可为空，最多各 8 条。每条必须使用输入项目名。",
    "完成成果只引用本周记录或本周提交；不得把当前状态冒充本周变化。项目状态只能作为“当前状态”说明。没有明确问题时 issues 留空，不要推测。下周计划只能依据已记录 nextStep；不要新编、不要建议建立任务/待办来代替实际行动。",
    "每条 basis 必须包含来源日期和至少一个对应输入字段的逐字短语；提交依据同时包含提交摘要和 ISO 时间。evidenceCount 只是链接数量，证据链接地址没有发送给你。不要输出链接、项目 ID、本机路径、凭据或仓库 URL。没有足够资料就让对应数组为空，不要用外部知识补全。",
  ].join("\n");
}

function matchingLog(basis, project, context) {
  return context.references.workLogs.find((log) => log.project === project && basis.includes(log.date)
    && [log.completedItems, log.outcomes, log.nextStep].some((source) => source.length >= 8 && basis.includes(source)));
}

function matchingCommit(basis, project, context) {
  return context.references.githubCommits.find((commit) => commit.project === project
    && basis.includes(commit.message) && basis.includes(commit.committedAt));
}

function matchesNextStep(basis, project, context) {
  const state = context.references.projects.find((item) => item.name === project);
  return Boolean(state?.nextStep && !isGenericNextStep(state.nextStep) && basis.includes(state.nextStep));
}

function matchesBlockedStatus(basis, project, context) {
  const state = context.references.projects.find((item) => item.name === project);
  return Boolean(state?.status && /受阻|阻塞|暂停|卡住/.test(state.status) && basis.includes(state.status));
}

export function parseWeeklySummaryResponse(content, context) {
  if (typeof content !== "string") throw new Error("GLM 未返回每周总结内容。");
  const stripped = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  let parsed;
  try { parsed = JSON.parse(stripped.slice(start, end + 1)); }
  catch { throw new Error("GLM 返回格式无法识别，请重试。"); }
  const projects = new Set(context.references.projects.map((project) => project.name));
  const summary = { range: context.range };
  for (const key of SECTIONS) {
    if (!Array.isArray(parsed?.[key])) throw new Error("GLM 返回的每周总结缺少必要部分，请重试。");
    summary[key] = parsed[key].slice(0, 8).map((item) => {
      const project = text(item?.project, 120);
      const detail = text(item?.text, 320);
      const basis = text(item?.basis, 320);
      if (!projects.has(project) || !detail || !basis) return null;
      const log = matchingLog(basis, project, context);
      const commit = matchingCommit(basis, project, context);
      const nextStepMatches = matchesNextStep(basis, project, context);
      if (key === "completed" && !log && !commit) return null;
      if (key === "progress" && !log && !commit) return null;
      if (key === "issues" && !log && !matchesBlockedStatus(basis, project, context)) return null;
      if (key === "nextWeek" && !context.references.workLogs.some((entry) => entry.project === project && entry.nextStep.length >= 8 && basis.includes(entry.date) && basis.includes(entry.nextStep))
        && !nextStepMatches) return null;
      return { project, text: detail, basis };
    }).filter(Boolean);
  }
  return summary;
}

export function weeklySummaryMarkdown(summary) {
  const headings = [
    ["completed", "本周成果"], ["progress", "项目推进"], ["issues", "问题与阻塞"], ["nextWeek", "下周计划"],
  ];
  const lines = [`# 本周工作总结（${summary.range.startDate} 至 ${summary.range.endDate}）`];
  for (const [key, heading] of headings) {
    lines.push("", `## ${heading}`);
    if (!summary[key]?.length) {
      lines.push("- 暂无可核实记录");
      continue;
    }
    for (const item of summary[key]) {
      lines.push(`- **${item.project}**：${item.text}`, `  依据：${item.basis}`);
    }
  }
  return lines.join("\n");
}
