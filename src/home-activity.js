const DAY_MS = 86_400_000;
export const MAX_CUSTOM_ACTIVITY_DAYS = 366;

function validDateKey(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function shanghaiDateKey(value = Date.now()) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (name) => parts.find((item) => item.type === name)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function shiftDateKey(value, days) {
  if (!validDateKey(value) || !Number.isInteger(days)) return "";
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function resolveActivityRange(preset = "30d", { startDate = "", endDate = "", now = Date.now() } = {}) {
  const today = shanghaiDateKey(now);
  if (preset === "custom") {
    if (!validDateKey(startDate) || !validDateKey(endDate) || startDate > endDate) {
      return { valid: false, preset, startDate, endDate, error: "请选择有效的开始和结束日期。" };
    }
    if (endDate > today) return { valid: false, preset, startDate, endDate, error: "结束日期不能晚于今天。" };
    const days = (Date.parse(`${endDate}T00:00:00.000Z`) - Date.parse(`${startDate}T00:00:00.000Z`)) / DAY_MS + 1;
    if (days > MAX_CUSTOM_ACTIVITY_DAYS) return { valid: false, preset, startDate, endDate, error: "自定义日期范围最多 366 天。" };
    return { valid: true, preset, startDate, endDate, days };
  }

  const days = ({ "7d": 7, "30d": 30, "90d": 90 })[preset] || 30;
  return { valid: true, preset, startDate: shiftDateKey(today, 1 - days), endDate: today, days };
}

function cleanLabel(value, fallback = "未分类") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function projectStatusBreakdown(projects = []) {
  const counts = new Map();
  for (const project of Array.isArray(projects) ? projects : []) {
    const status = cleanLabel(project?.status);
    counts.set(status, (counts.get(status) || 0) + 1);
  }
  const preferred = ["进行中", "计划中", "已完成", "暂停", "待确认", "未分类"];
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => {
      const leftOrder = preferred.indexOf(left.label);
      const rightOrder = preferred.indexOf(right.label);
      if (leftOrder >= 0 || rightOrder >= 0) return (leftOrder < 0 ? 99 : leftOrder) - (rightOrder < 0 ? 99 : rightOrder);
      return right.count - left.count || left.label.localeCompare(right.label, "zh-CN");
    });
}

export function projectStageBreakdown(projects = []) {
  const counts = new Map();
  for (const project of Array.isArray(projects) ? projects : []) {
    const raw = typeof project?.stage === "string" ? project.stage.trim() : "";
    const stage = !raw || ["未填写", "尚未设置阶段"].includes(raw) ? "未分类" : raw;
    counts.set(stage, (counts.get(stage) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => {
      if (left.label === right.label) return 0;
      if (left.label === "未分类") return 1;
      if (right.label === "未分类") return -1;
      return right.count - left.count || left.label.localeCompare(right.label, "zh-CN");
    });
}

function createDay(date) {
  return {
    date,
    githubCommits: 0,
    workLogs: 0,
    githubProjects: new Set(),
    workLogProjects: new Map(),
  };
}

export function buildHomeActivity({
  startDate,
  endDate,
  projects = [],
  projectRepositories = [],
  githubResults = [],
  githubErrors = [],
  githubStatus = "ready",
  workLogs = [],
  workLogsStatus = "ready",
  workLogsComplete = true,
} = {}) {
  if (!validDateKey(startDate) || !validDateKey(endDate) || startDate > endDate) {
    throw new Error("活动日期范围无效。");
  }

  const days = [];
  const byDate = new Map();
  for (let date = startDate; date <= endDate; date = shiftDateKey(date, 1)) {
    const day = createDay(date);
    days.push(day);
    byDate.set(date, day);
  }

  const repoProjects = new Map();
  for (const entry of Array.isArray(projectRepositories) ? projectRepositories : []) {
    const fullName = typeof entry?.fullName === "string" ? entry.fullName.trim().toLocaleLowerCase() : "";
    if (!fullName || !entry.projectId || !entry.projectName) continue;
    if (!repoProjects.has(fullName)) repoProjects.set(fullName, new Map());
    repoProjects.get(fullName).set(String(entry.projectId), String(entry.projectName));
  }

  const resultsByRepo = new Map();
  for (const result of Array.isArray(githubResults) ? githubResults : []) {
    const fullName = typeof result?.fullName === "string" ? result.fullName.trim().toLocaleLowerCase() : "";
    if (fullName && !resultsByRepo.has(fullName)) resultsByRepo.set(fullName, result);
  }
  const errorsByRepo = new Map((Array.isArray(githubErrors) ? githubErrors : []).flatMap((error) => {
    const fullName = typeof error?.fullName === "string" ? error.fullName.trim().toLocaleLowerCase() : "";
    return fullName ? [[fullName, error]] : [];
  }));

  const githubKnown = githubStatus === "ready" && repoProjects.size > 0;
  const githubComplete = githubKnown
    && resultsByRepo.size === repoProjects.size
    && [...repoProjects.keys()].every((name) => {
      const result = resultsByRepo.get(name);
      return Boolean(result?.complete === true && result?.truncated !== true && !errorsByRepo.has(name));
    });
  const githubIncompleteNames = [...repoProjects.keys()].filter((name) => {
    const result = resultsByRepo.get(name);
    return !result || result.complete !== true || result.truncated === true || errorsByRepo.has(name);
  });

  for (const [fullName, result] of resultsByRepo) {
    const linkedProjects = repoProjects.get(fullName);
    if (!linkedProjects) continue;
    for (const record of Array.isArray(result?.dailyCounts) ? result.dailyCounts : []) {
      const date = typeof record?.date === "string" ? record.date : "";
      const count = Number(record?.count);
      const day = byDate.get(date);
      if (!day || !Number.isSafeInteger(count) || count <= 0) continue;
      day.githubCommits += count;
      for (const project of linkedProjects.values()) day.githubProjects.add(project);
    }
  }

  const seenLogs = new Set();
  const projectNames = new Map((Array.isArray(projects) ? projects : [])
    .filter((project) => project?.id && project?.name)
    .map((project) => [String(project.id), String(project.name)]));
  for (const entry of Array.isArray(projectRepositories) ? projectRepositories : []) {
    if (entry?.projectId && entry?.projectName) projectNames.set(String(entry.projectId), String(entry.projectName));
  }
  for (const log of Array.isArray(workLogs) ? workLogs : []) {
    const date = typeof log?.workDate === "string" ? log.workDate : "";
    const id = typeof log?.id === "string" ? log.id : "";
    const projectId = String(log?.projectId || "");
    const day = byDate.get(date);
    if (!day || !projectId || !projectNames.has(projectId)) continue;
    const identity = `${projectId}\u0000${id || date}`;
    if (seenLogs.has(identity)) continue;
    seenLogs.add(identity);
    day.workLogs += 1;
    const projectName = projectNames.get(projectId);
    day.workLogProjects.set(projectName, (day.workLogProjects.get(projectName) || 0) + 1);
  }

  const workLogsCompleteResult = workLogsStatus === "ready" && workLogsComplete === true;
  const githubCount = days.reduce((sum, day) => sum + day.githubCommits, 0);
  const workLogCount = days.reduce((sum, day) => sum + day.workLogs, 0);
  const activeDays = days.filter((day) => day.githubCommits + day.workLogs > 0).length;
  return {
    startDate,
    endDate,
    days: days.map((day) => ({
      ...day,
      githubProjects: [...day.githubProjects].sort((a, b) => a.localeCompare(b, "zh-CN")),
      workLogProjects: [...day.workLogProjects.entries()].map(([name, count]) => ({ name, count })),
      partial: !githubComplete || !workLogsCompleteResult,
    })),
    totals: { githubCommits: githubCount, workLogs: workLogCount, activityRecords: githubCount + workLogCount, activeDays },
    coverage: {
      githubStatus: repoProjects.size ? githubStatus : "unlinked",
      githubRequested: repoProjects.size,
      githubCompleteCount: [...repoProjects.keys()].filter((name) => {
        const result = resultsByRepo.get(name);
        return result?.complete === true && result?.truncated !== true && !errorsByRepo.has(name);
      }).length,
      githubIncompleteNames,
      githubErrors: [...errorsByRepo.values()],
      githubComplete,
      workLogsStatus,
      workLogsComplete: workLogsCompleteResult,
      complete: githubComplete && workLogsCompleteResult,
    },
  };
}
