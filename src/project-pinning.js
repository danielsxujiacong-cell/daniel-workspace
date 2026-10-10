export const MIN_HOME_PROJECT_PINS = 3;
export const MAX_HOME_PROJECT_PINS = 5;

export function countPinnedProjects(projects = []) {
  return projects.filter((project) => project?.isPinned === true).length;
}

export function getHomePinnedProjects(projects = []) {
  const pinned = projects
    .filter((project) => project?.isPinned === true)
    .sort((left, right) => String(left.name || "").localeCompare(String(right.name || ""), "zh-CN"));
  return pinned.length < MIN_HOME_PROJECT_PINS ? [] : pinned.slice(0, MAX_HOME_PROJECT_PINS);
}

export function toggleProjectPin(projects = [], projectId) {
  const project = projects.find((item) => item.id === projectId);
  if (!project) return { projects, changed: false, reason: "missing" };

  const isPinned = project.isPinned !== true;
  if (isPinned && countPinnedProjects(projects) >= MAX_HOME_PROJECT_PINS) {
    return { projects, changed: false, reason: "limit" };
  }

  return {
    projects: projects.map((item) => item.id === projectId ? { ...item, isPinned } : item),
    changed: true,
    isPinned,
  };
}
