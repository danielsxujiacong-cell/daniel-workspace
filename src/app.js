if (globalThis.DANIEL_WORKSPACE_AUTHENTICATED !== true) {
  throw new Error("Workspace requires a validated Supabase session.");
}

let workspaceAuth = globalThis.DANIEL_WORKSPACE_AUTH;
if (!workspaceAuth?.client || !workspaceAuth.userId) throw new Error("Workspace cloud sync requires a validated user session.");

const {
  loadCloudCache,
  loadCloudMigrationState,
  loadData,
  loadLocalScanBaseline,
  loadLocalScanCache,
  saveCloudCache,
  saveCloudMigrationState,
  saveData,
  saveLocalScanBaseline,
  saveLocalScanCache,
} = await import("./store.js");
const { buildAssistantContext } = await import("./ai/context.js");
const { chat: chatWithAI, getAIStatus, getAIErrorMessage } = await import("./ai/service.js?v=3.4.2");
const { buildProjectNextStepContext, buildProjectNextStepPrompt, parseProjectNextStepResponse, verifiedProjectGitHubCommit } = await import("./ai/project-next-step.js?v=3.3.2");
const { buildDailyBriefContext, buildDailyBriefPrompt, parseDailyBriefResponse } = await import("./ai/daily-brief.js?v=3.4.0");
const { buildActionSuggestion, formatCodexTask, parseStructuredSuggestion } = await import("./suggestions.js");
const { fetchPublicGitHubRepository, GITHUB_CACHE_TTL_MS, isGitHubSnapshotFresh, parsePublicGitHubRepository } = await import("./github/public-api.js?v=3.2");
const { buildCloudDashboardModel, buildLocalDashboardModel, compareLocalProjects, taskPriorityLabel } = await import("./dashboard.js");
const {
  countPinnedProjects,
  getHomePinnedProjects,
  MAX_HOME_PROJECT_PINS,
  MIN_HOME_PROJECT_PINS,
  toggleProjectPin: nextProjectPinState,
} = await import("./project-pinning.js");
const {
  countLocalMigrationCandidates,
  hasCloudRecords,
  hasLocalMigrationCandidates,
  insertCloudProjects,
  loadCloudWorkspace,
  migrateLocalWorkspace,
  preserveDeviceOnlyData,
  saveCloudChanges,
  setCloudProjectPinned,
} = await import("./cloud/sync.js");
const { APP_VERSION } = await import("./version.js");

const app = document.querySelector("#app");
let legacyData = loadData();
let cloudCache = loadCloudCache(workspaceAuth.userId);
let db = cloudCache?.data || legacyData;
const legacyCandidateCounts = countLocalMigrationCandidates(legacyData);
const legacyCandidateTotal = Object.values(legacyCandidateCounts).reduce((sum, count) => sum + count, 0);
let cloudBaseline = cloudCache?.baseline || null;
let cloudCacheActive = Boolean(cloudCache);
let cloudSyncEnabled = false;
let cloudSyncRunning = false;
let cloudSyncRequested = false;
let cloudSyncTimer = null;
let cloudInitializationRunning = false;
let workspaceDataRevision = 0;
let migrationState = loadCloudMigrationState(workspaceAuth.userId);
let scanCache = loadLocalScanCache();
const localScanEndpoint = getLocalScanEndpoint();
let workspaceActive = true;
let activeLocalScanController = null;
const ui = {
  page: "home",
  projectId: null,
  projectFilter: "all",
  projectPinningAvailable: typeof cloudCache?.projectPinningAvailable === "boolean" ? cloudCache.projectPinningAvailable : null,
  projectPinUpdatingId: null,
  localProjectId: null,
  localProjects: scanCache.inventory,
  localProjectsSource: scanCache.inventory ? "cache" : null,
  localProjectsStatus: localScanEndpoint ? "loading" : "unavailable",
  localScanAttemptAt: "",
  localScanCacheSaved: true,
  localProjectSyncStatus: "idle",
  localProjectSyncError: "",
  localComparison: null,
  taskFilter: "all",
  query: "",
  searchOpen: false,
  modal: null,
  confirmation: null,
  dashboardSuggestion: null,
  dashboardSuggestionKey: "",
  dashboardSuggestionStatus: "idle",
  dailyBrief: null,
  dailyBriefStatus: "idle",
  projectNextStep: null,
  createdSuggestionKeys: [],
  codex: null,
  assistantOpen: false,
  chatBusy: false,
  githubRefreshing: false,
  githubRefreshStatus: {},
  githubRefreshAttemptAt: {},
  cloud: {
    status: navigator.onLine === false ? "offline" : "loading",
    lastSyncedAt: cloudCache?.lastSyncedAt || "",
    migrationAvailable: false,
    migrationDismissed: false,
    localDataUnmerged: cloudCache && !migrationState.completed ? legacyCandidateTotal : 0,
    error: "",
  },
  chat: [{ role: "assistant", text: "你好，我是 Daniel Workspace Assistant。可以问我当前页面的数据、进展和下一步。" }],
};

const colorScheme = window.matchMedia("(prefers-color-scheme: light)");

function getLocalScanEndpoint() {
  const hostname = window.location.hostname.toLowerCase();
  if (hostname === "localhost" || hostname === "127.0.0.1") return "/api/local-projects";
  if (hostname === "danielsxujiacong-cell.github.io" && /^\/daniel-workspace(?:\/|$)/.test(window.location.pathname)) {
    return "http://127.0.0.1:4174/api/local-projects";
  }
  return null;
}

function applyTheme() {
  const preference = db.settings?.theme || "system";
  document.documentElement.dataset.theme = preference === "system" ? (colorScheme.matches ? "light" : "dark") : preference;
}

applyTheme();
colorScheme.addEventListener?.("change", () => {
  if (db.settings?.theme === "system") applyTheme();
});

const iconShapes = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  folder: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/><path d="M3 10h18"/>',
  inbox: '<path d="M4 4h16l2 11h-6l-2 3h-4l-2-3H2z"/><path d="M2 15h6l2 3h4l2-3h6"/>',
  bulb: '<path d="M9 18h6M10 22h4"/><path d="M8.5 14.5a7 7 0 1 1 7 0c-.8.6-1.3 1.3-1.5 2.5h-4c-.2-1.2-.7-1.9-1.5-2.5Z"/>',
  checkSquare: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="m7.5 12 3 3 6-6"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back: '<path d="m15 18-6-6 6-6"/><path d="M20 12H9"/>',
  external: '<path d="M13 5h6v6M19 5l-9 9"/><path d="M18 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  sparkle: '<path d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  edit: '<path d="m14 5 5 5"/><path d="m4 20 4.3-.8L19 8.5a2.1 2.1 0 0 0-3-3L5.3 16.2 4 20Z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 13h11l1-13M9 7V4h6v3"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  send: '<path d="m21 3-7.5 18-3.5-7-7-3.5z"/><path d="M21 3 10 14"/>',
  document: '<path d="M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.1 0l2.5-2.5a5 5 0 0 0-7.1-7.1L11 4.9"/><path d="M14 11a5 5 0 0 0-7.1 0l-2.5 2.5a5 5 0 0 0 7.1 7.1l1.5-1.5"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  reset: '<path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
  moon: '<path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  tag: '<path d="M20 13 13 20 4 11V4h7z"/><circle cx="8" cy="8" r="1"/>',
  sparkleSmall: '<path d="m12 3 1.3 5.7L19 10l-5.7 1.3L12 17l-1.3-5.7L4 10l5.7-1.3z"/>',
};

function icon(name, className = "icon") {
  return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconShapes[name] || iconShapes.document}</svg>`;
}

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function uid(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
}

function projectById(id) { return db.projects.find((project) => project.id === id); }
function projectTitle(id) { return projectById(id)?.name || "未关联项目"; }
function localProjectById(id) { return ui.localProjects?.items?.find((project) => project.id === id) || null; }
function openTasks() { return db.tasks.filter((task) => task.status !== "done"); }
function taskMatchesFilter(task, filter) { return filter === "all" || (filter === "done" ? task.status === "done" : task.status !== "done"); }
function priorityClass(priority = "低") { return priority === "高" ? "high" : priority === "中" ? "medium" : "low"; }
function statusClass(status = "") { return status === "进行中" ? "active" : status === "暂停" ? "paused" : "planned"; }
function initials(title = "?") { return [...title.trim()].slice(0, 2).join("") || "?"; }

function githubKey(value) {
  const repository = parsePublicGitHubRepository(value);
  return repository?.fullName?.toLowerCase() || "";
}

function comparablePath(value) {
  return String(value || "").replaceAll("/", "\\").replace(/\\+$/, "").toLowerCase();
}

function normalizedName(value) {
  return String(value || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function workspaceProjectForLocal(localProject) {
  const remoteKey = githubKey(localProject?.githubRepository);
  if (remoteKey) {
    const remoteMatch = db.projects.find((project) => githubKey(project.github) === remoteKey);
    if (remoteMatch) return remoteMatch;
  }
  const pathKey = comparablePath(localProject?.path);
  if (pathKey) {
    const pathMatch = db.projects.find((project) => comparablePath(project.path) === pathKey);
    if (pathMatch) return pathMatch;
  }
  const localName = normalizedName(localProject?.name);
  if (localName) return db.projects.find((project) => normalizedName(project.name) === localName) || null;
  return null;
}

function cloudProjectMatchesLocal(project, cloudProjects) {
  const repository = githubKey(project?.githubRepository || project?.github);
  const name = normalizedName(project?.name);
  return (cloudProjects || []).some((item) => (repository && githubKey(item.github) === repository)
    || (name && normalizedName(item.name) === name));
}

function localProjectForWorkspace(project) {
  if (!project || !ui.localProjects?.items) return null;
  const remoteKey = githubKey(project.github);
  if (remoteKey) {
    const remoteMatch = ui.localProjects.items.find((item) => githubKey(item.githubRepository) === remoteKey);
    if (remoteMatch) return remoteMatch;
  }
  const pathKey = comparablePath(project.path);
  if (pathKey) {
    const pathMatch = ui.localProjects.items.find((item) => comparablePath(item.path) === pathKey);
    if (pathMatch) return pathMatch;
  }
  const nameKey = normalizedName(project.name);
  return nameKey ? ui.localProjects.items.find((item) => normalizedName(item.name) === nameKey) || null : null;
}

function localProgressForWorkspace(project) {
  const local = localProjectForWorkspace(project);
  if (!local?.hasGit) return null;
  return {
    project: local,
    committedAt: local.lastLocalCommit?.committedAt || "",
    branch: local.branch || "",
    clean: typeof local.clean === "boolean" ? local.clean : null,
    scannedAt: ui.localProjects?.scannedAt || "",
  };
}

function timeAgo(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "刚刚";
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days} 天前` : date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

function timeAgoIfKnown(iso) {
  return iso && !Number.isNaN(new Date(iso).getTime()) ? timeAgo(iso) : "时间未知";
}

function formattedTimestamp(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "尚未获取";
  return date.toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function githubStatus(project) {
  const requestStatus = ui.githubRefreshStatus[project.id];
  if (requestStatus === "loading") return "正在刷新";
  if (requestStatus === "unavailable") return "暂不可公开读取";
  if (requestStatus === "error") return "请求失败 · 保留已有数据";
  if (!parsePublicGitHubRepository(project.github)) return "未配置公开仓库";
  return project.githubData?.refreshedAt ? "GitHub 已连接" : "尚未刷新";
}

function formattedDate() {
  return new Date().toLocaleDateString("zh-CN", { weekday: "short", month: "long", day: "numeric" });
}

function persist() {
  if (!workspaceActive) return;
  workspaceDataRevision += 1;
  if (cloudCacheActive) {
    const saved = saveCloudCache(workspaceAuth.userId, db, cloudBaseline, ui.cloud.lastSyncedAt, ui.projectPinningAvailable);
    if (!saved) ui.cloud.error = "浏览器未能保存云端缓存";
  } else {
    saveData(db);
  }
  if (cloudSyncEnabled) scheduleCloudSync();
}

function currentCloudData() {
  return { projects: db.projects, tasks: db.tasks, knowledge: db.knowledge, decisions: db.decisions };
}

function activateCloudWorkspace(remote, localState, mergePending = false) {
  const records = mergePending
    ? mergePendingCloudChanges(remote.data, localState, cloudBaseline)
    : remote.data;
  db = preserveDeviceOnlyData(records, localState);
  cloudBaseline = remote.baseline;
  ui.projectPinningAvailable = remote.projectPinningAvailable === true;
  cloudCacheActive = true;
  cloudSyncEnabled = true;
  ui.cloud.lastSyncedAt = new Date().toISOString();
  ui.cloud.status = "synced";
  ui.cloud.error = "";
  ui.cloud.migrationAvailable = false;
  const saved = saveCloudCache(workspaceAuth.userId, db, cloudBaseline, ui.cloud.lastSyncedAt, ui.projectPinningAvailable);
  if (!saved) ui.cloud.error = "云端可用，但浏览器未能保存离线缓存";
}

async function initializeCloudSync() {
  if (!workspaceActive || cloudInitializationRunning) return;
  if (navigator.onLine === false) {
    ui.cloud.status = "offline";
    render();
    return;
  }

  cloudInitializationRunning = true;
  ui.cloud.status = "loading";
  ui.cloud.error = "";
  render();
  try {
    const remote = await loadCloudWorkspace(workspaceAuth.client, workspaceAuth.userId, () => workspaceActive);
    if (!workspaceActive) return;

    if (cloudCacheActive && cloudBaseline) {
      // A fresh authenticated read is authoritative. Never replay stale cache on reconnect.
      activateCloudWorkspace(remote, db);
      return;
    }

    migrationState = loadCloudMigrationState(workspaceAuth.userId);
    if (migrationState.approved && !migrationState.completed) {
      ui.cloud.status = "migrating";
      render();
      let migrated;
      let revision;
      do {
        revision = workspaceDataRevision;
        migrated = await migrateLocalWorkspace(workspaceAuth.client, workspaceAuth.userId, db, () => workspaceActive);
        if (!workspaceActive) return;
      } while (workspaceDataRevision !== revision);
      migrationState = { approved: true, completed: true };
      saveCloudMigrationState(workspaceAuth.userId, migrationState);
      activateCloudWorkspace(migrated, db);
      ui.cloud.localDataUnmerged = 0;
      return;
    }

    if (!migrationState.completed && !hasCloudRecords(remote.data) && hasLocalMigrationCandidates(db)) {
      ui.cloud.status = "migration";
      ui.cloud.migrationAvailable = true;
      ui.cloud.localDataUnmerged = 0;
      return;
    }

    const unmergedCount = hasCloudRecords(remote.data)
      ? Object.values(countLocalMigrationCandidates(db)).reduce((sum, count) => sum + count, 0)
      : 0;
    activateCloudWorkspace(remote, db);
    ui.cloud.localDataUnmerged = unmergedCount;
    if (unmergedCount) {
      saveCloudCache(workspaceAuth.userId, db, cloudBaseline, ui.cloud.lastSyncedAt, ui.projectPinningAvailable);
    }
  } catch (error) {
    if (!workspaceActive) return;
    cloudSyncRequested = false;
    ui.cloud.status = navigator.onLine === false ? "offline" : "error";
    ui.cloud.error = typeof error?.message === "string" ? error.message : "云端连接失败";
  } finally {
    cloudInitializationRunning = false;
    if (workspaceActive) render();
  }
}

function scheduleCloudSync() {
  clearTimeout(cloudSyncTimer);
  cloudSyncTimer = setTimeout(() => {
    cloudSyncTimer = null;
    if (cloudSyncRunning) {
      cloudSyncRequested = true;
      return;
    }
    void syncCloudNow();
  }, 350);
}

async function syncCloudNow() {
  if (!workspaceActive || !cloudSyncEnabled) return;
  if (navigator.onLine === false) {
    ui.cloud.status = "offline";
    render();
    return;
  }
  if (cloudSyncRunning) {
    cloudSyncRequested = true;
    return;
  }

  cloudSyncRunning = true;
  try {
    do {
      cloudSyncRequested = false;
      ui.cloud.status = "syncing";
      render();
      const revision = workspaceDataRevision;
      const nextBaseline = await saveCloudChanges(workspaceAuth.client, workspaceAuth.userId, currentCloudData(), cloudBaseline, () => workspaceActive);
      if (!workspaceActive) return;
      cloudBaseline = nextBaseline;
      ui.cloud.lastSyncedAt = new Date().toISOString();
      ui.cloud.status = "synced";
      ui.cloud.error = "";
      saveCloudCache(workspaceAuth.userId, db, cloudBaseline, ui.cloud.lastSyncedAt, ui.projectPinningAvailable);
      if (workspaceDataRevision !== revision) cloudSyncRequested = true;
    } while (cloudSyncRequested && workspaceActive);
  } catch (error) {
    if (!workspaceActive) return;
    cloudSyncRequested = false;
    ui.cloud.status = navigator.onLine === false ? "offline" : "error";
    ui.cloud.error = typeof error?.message === "string" ? error.message : "云端保存失败";
    saveCloudCache(workspaceAuth.userId, db, cloudBaseline, ui.cloud.lastSyncedAt, ui.projectPinningAvailable);
  } finally {
    cloudSyncRunning = false;
    if (workspaceActive) render();
    if (cloudSyncRequested && workspaceActive) void syncCloudNow();
  }
}

async function migrateLegacyData() {
  if (!workspaceActive || !ui.cloud.migrationAvailable) return;
  const approved = saveCloudMigrationState(workspaceAuth.userId, { approved: true, completed: false });
  if (!approved) {
    ui.cloud.status = "error";
    ui.cloud.error = "浏览器未能保存迁移确认，请检查本机存储空间后重试";
    render();
    return;
  }

  ui.cloud.status = "migrating";
  ui.cloud.error = "";
  render();
  try {
    let migrated;
    let revision;
    do {
      revision = workspaceDataRevision;
      migrated = await migrateLocalWorkspace(workspaceAuth.client, workspaceAuth.userId, db, () => workspaceActive);
      if (!workspaceActive) return;
    } while (workspaceDataRevision !== revision);
    migrationState = { approved: true, completed: true };
    saveCloudMigrationState(workspaceAuth.userId, migrationState);
    activateCloudWorkspace(migrated, db);
    ui.cloud.localDataUnmerged = 0;
    toast("本机真实资料已安全迁移到云端；演示资料和旧本地副本仍保留在此设备");
  } catch (error) {
    if (!workspaceActive) return;
    ui.cloud.status = navigator.onLine === false ? "offline" : "error";
    ui.cloud.error = typeof error?.message === "string" ? error.message : "迁移失败，本机资料仍保留";
  }
  render();
}

function deferLegacyMigration() {
  ui.cloud.migrationDismissed = true;
  render();
}

window.addEventListener("online", () => {
  if (workspaceActive) void initializeCloudSync();
});

window.addEventListener("offline", () => {
  if (!workspaceActive) return;
  ui.cloud.status = "offline";
  render();
});

export function clearPrivateWorkspace() {
  if (!workspaceActive) return;
  workspaceActive = false;
  cloudSyncEnabled = false;
  cloudCacheActive = false;
  cloudBaseline = null;
  cloudCache = null;
  legacyData = { version: 1, settings: {}, projects: [], tasks: [], knowledge: [], decisions: [], activities: [] };
  workspaceAuth = null;
  migrationState = null;
  clearTimeout(cloudSyncTimer);
  cloudSyncTimer = null;
  activeLocalScanController?.abort();
  activeLocalScanController = null;
  db = { version: 1, settings: { theme: "system" }, projects: [], tasks: [], knowledge: [], decisions: [], activities: [] };
  scanCache = { inventory: null, readable: true };
  ui.localProjects = null;
  ui.localProjectsSource = null;
  ui.localProjectsStatus = "unavailable";
  ui.localComparison = null;
  ui.localScanAttemptAt = "";
  ui.dashboardSuggestion = null;
  ui.dashboardSuggestionKey = "";
  ui.dashboardSuggestionStatus = "idle";
  ui.projectNextStep = null;
  ui.createdSuggestionKeys = [];
  ui.codex = null;
  ui.chat = [];
  ui.modal = null;
  ui.confirmation = null;
  ui.assistantOpen = false;
  ui.query = "";
  ui.cloud.migrationAvailable = false;
  ui.cloud.lastSyncedAt = "";
  ui.cloud.localDataUnmerged = 0;
  app.replaceChildren();
}

function logActivity(type, title, projectId = null) {
  db.activities.unshift({ id: uid("activity"), type, title, projectId, createdAt: new Date().toISOString() });
  db.activities = db.activities.slice(0, 80);
}

function go(page, projectId = null, push = true) {
  ui.page = page;
  ui.projectId = projectId;
  ui.localProjectId = null;
  ui.searchOpen = false;
  if (push) history.pushState({ page, projectId }, "", page === "project" ? `#project/${encodeURIComponent(projectId)}` : `#${page}`);
  render();
}

function goLocalProject(localProjectId, push = true) {
  const localProject = localProjectById(localProjectId);
  const linked = localProject && workspaceProjectForLocal(localProject);
  if (linked) {
    go("project", linked.id, push);
    return;
  }
  ui.page = "local-project";
  ui.projectId = null;
  ui.localProjectId = localProjectId;
  ui.searchOpen = false;
  if (push) history.pushState({ page: "local-project", localProjectId }, "", `#local-project/${encodeURIComponent(localProjectId)}`);
  render();
}

window.addEventListener("popstate", () => {
  const localMatch = location.hash.match(/^#local-project\/(.+)$/);
  if (localMatch) { goLocalProject(decodeURIComponent(localMatch[1]), false); return; }
  const match = location.hash.match(/^#project\/(.+)$/);
  if (match) go("project", decodeURIComponent(match[1]), false);
  else {
    const page = ["home", "projects", "knowledge", "decisions", "tasks"].includes(location.hash.slice(1)) ? location.hash.slice(1) : "home";
    go(page, null, false);
  }
});

function statusPill(status) {
  return `<span class="status-pill ${statusClass(status)}">${esc(status)}</span>`;
}

function taskRow(task, compact = false) {
  const project = projectById(task.projectId);
  const description = task.description ? `<div class="task-description">${esc(task.description)}</div>` : "";
  const source = task.sourceKey?.startsWith("ai-suggestion:") ? `<span class="tag task-source">AI Suggestion</span>` : "";
  return `<div class="task-row ${task.status === "done" ? "is-done" : ""}">
    <button class="check-button ${task.status === "done" ? "checked" : ""}" data-action="toggle-task" data-id="${esc(task.id)}" aria-label="${task.status === "done" ? "重新打开" : "完成"}任务">${task.status === "done" ? icon("checkSquare") : ""}</button>
    <div class="task-text">${esc(task.title)}${description}${!compact ? `<div class="task-sub">${esc(project?.name || "无关联项目")}${task.due ? ` · ${esc(task.due)}` : ""} ${source}</div>` : ""}</div>
    <span class="priority ${priorityClass(task.priority)}">${esc(task.priority || "低")}优先级</span>
    ${compact ? "" : `<button class="icon-button" data-action="edit-task" data-id="${esc(task.id)}" aria-label="编辑任务">${icon("edit")}</button><button class="icon-button" data-action="delete-task" data-id="${esc(task.id)}" aria-label="删除任务">${icon("trash")}</button>`}
  </div>`;
}

function projectRow(project) {
  const count = db.tasks.filter((task) => task.projectId === project.id && task.status !== "done").length;
  const meta = project.githubData?.updatedAt
    ? `GitHub 更新 · ${timeAgo(project.githubData.updatedAt)} · ${count} 个待办`
    : `${project.stage || "尚未设置阶段"} · ${count} 个待办`;
  return `<div class="project-row" data-action="view-project" data-id="${esc(project.id)}" tabindex="0" role="button" aria-label="打开项目 ${esc(project.name)}">
    <div class="project-glyph">${esc(initials(project.name))}</div>
    <div class="project-main"><div class="project-name">${esc(project.name)}</div><div class="project-meta">${esc(meta)}</div></div>
    <div class="project-trailing">${statusPill(project.status)}${icon("chevron")}</div>
  </div>`;
}

function recordIcon(type) {
  if (type === "链接") return icon("link");
  if (type === "decision") return icon("bulb");
  if (type === "task") return icon("checkSquare");
  if (type === "project") return icon("folder");
  return icon("document");
}

function knowledgeRow(item, compact = false) {
  return `<div class="knowledge-row">
    <div class="record-icon">${recordIcon(item.type)}</div>
    <div class="record-copy"><div class="record-title">${esc(item.title)}</div>
      <div class="record-meta">${esc(item.summary || item.content.slice(0, 92))}${item.content.length > 92 && !item.summary ? "…" : ""}</div>
      <div class="tag-row">${compact ? `<span class="tag">${esc(projectTitle(item.projectId))}</span>` : item.tags.map((tag) => `<span class="tag">#${esc(tag)}</span>`).join("")}</div>
    </div>
    ${compact ? "" : `<div class="record-actions"><button class="icon-button" data-action="edit-knowledge" data-id="${esc(item.id)}" aria-label="编辑资料">${icon("edit")}</button><button class="icon-button" data-action="delete-knowledge" data-id="${esc(item.id)}" aria-label="删除资料">${icon("trash")}</button></div>`}
  </div>`;
}

function decisionRow(decision, compact = false) {
  return `<div class="decision-row ${compact ? "clickable" : ""}" ${compact ? `data-action="view-decision" data-id="${esc(decision.id)}" tabindex="0" role="button"` : ""}>
    <div class="record-icon decision">${icon("bulb")}</div>
    <div class="record-copy decision-copy"><div class="record-title">${esc(decision.question)}</div><div class="decision-answer">${decision.final ? `已决定：${esc(decision.final)}` : "尚未做最终决定"}</div><div class="record-meta">${esc(projectTitle(decision.projectId))} · ${timeAgo(decision.createdAt)}</div></div>
    ${compact ? icon("chevron") : `<div class="record-actions"><button class="icon-button" data-action="edit-decision" data-id="${esc(decision.id)}" aria-label="编辑决策">${icon("edit")}</button></div>`}
  </div>`;
}

function activityRow(activity) {
  return `<div class="activity-row"><span class="activity-dot"></span><div class="record-copy"><div class="record-title">${esc(activity.title)}</div><div class="record-meta">${esc(projectTitle(activity.projectId))}</div></div><time class="activity-time">${timeAgo(activity.createdAt)}</time></div>`;
}

function sectionTitle(title, trailing = "") {
  return `<div class="section-title"><h2>${title}</h2>${trailing}</div>`;
}

function localAheadBehind(project) {
  if (!project?.hasGit) return "无 Git";
  if (project.ahead == null || project.behind == null) return "origin/main 不可比较";
  return `领先 ${project.ahead} · 落后 ${project.behind}`;
}

function localGitLabel(project) {
  if (!project?.hasGit) return "无 Git";
  if (project.clean == null) return project.gitError || "Git 状态未知";
  return project.clean ? "Clean" : "有未提交修改";
}

function localDashboardModel() {
  const currentScan = ui.localProjectsStatus === "ready";
  if (!currentScan || !Array.isArray(ui.localProjects?.items)) return null;
  return buildLocalDashboardModel({
    items: ui.localProjects.items,
    tasks: db.tasks,
    projectForLocal: workspaceProjectForLocal,
  });
}

function cloudDashboardModel() {
  if (!cloudCacheActive && ui.cloud.status !== "synced") return buildCloudDashboardModel({});
  return buildCloudDashboardModel({ projects: db.projects, tasks: db.tasks });
}

function cloudSuggestionForDashboard(today) {
  const task = today.priorityTask;
  const priority = task?.priority || "中";
  const sourceKey = `cloud-dashboard:${today.taskId || today.projectId || "unlinked-task"}`;
  return {
    source: "cloud",
    projectId: today.projectId || null,
    projectName: today.projectName,
    issueType: task ? "cloud_priority_task" : "cloud_project_next_step",
    severity: task ? ({ 高: "high", 中: "medium", 低: "low" })[priority] || "medium" : "low",
    title: today.projectName,
    finding: task ? `云端待办：${task.title}` : "当前没有待办任务",
    reason: task
      ? `云端 Tasks 将此项标为「${priority}」优先级${task.due ? `，期限为${task.due}` : ""}；建议按当前任务优先级顺序处理。`
      : "当前账号没有待办任务，建议从云端项目资料继续推进。",
    suggestedAction: today.nextStep,
    allowedActions: ["open_project", "open_tasks"],
    taskId: today.taskId || null,
    sourceKey,
    suggestionKey: `${sourceKey}|${today.updatedAt || ""}`,
  };
}

function requestDashboardSuggestion(candidate, localProject) {
  if (!candidate || candidate.suggestionKey === ui.dashboardSuggestionKey || !workspaceActive || ["loading", "syncing", "migrating"].includes(ui.cloud.status)) return;
  ui.dashboardSuggestionKey = candidate.suggestionKey;
  ui.dashboardSuggestion = candidate;
  ui.dashboardSuggestionStatus = "generating";
  if (getAIStatus().mode !== "real") {
    ui.dashboardSuggestionStatus = "mock";
    return;
  }
  const isCloudSuggestion = candidate.source === "cloud";
  const cloudContext = isCloudSuggestion ? buildAssistantContext({
      data: db,
      currentPage: "home",
      projectId: candidate.projectId,
      localProjects: [],
      dashboardModel: cloudDashboardModel(),
      companionStatus: ui.localProjectsStatus,
    }).relevantContext : null;
  if (cloudContext) delete cloudContext.companion;
  const request = {
    message: isCloudSuggestion
      ? `根据当前账号的云端 Projects、Tasks、Knowledge、Decisions，为首页推荐生成简短建议。严格返回 JSON：{"issueType":"${candidate.issueType}","severity":"low|medium|high","title":"项目或待办名称","reason":"依据云端资料的原因","suggestedAction":"下一步建议"}。issueType 必须保持 ${candidate.issueType}。只根据提供的云端资料判断；尊重任务优先级和期限，不得把低优先级任务描述为最高优先级。不要推断 Companion、本机文件、Git 分支、clean 状态、ahead/behind 或 commit。不要提出本机写文件或执行命令。`
      : `根据单个本地扫描问题，生成简短的 Workspace 建议。严格返回 JSON：{"issueType":"${candidate.issueType}","severity":"low|medium|high","title":"项目名","reason":"为什么发现此问题","suggestedAction":"下一步建议"}。issueType 必须保持 ${candidate.issueType}。不要提出写文件、执行命令、删除、commit 或 push；不要输出路径、URL、仓库地址或 Git hash。`,
    currentPage: "home",
    currentProject: candidate.projectId ? { id: candidate.projectId, name: candidate.projectName } : null,
    relevantContext: isCloudSuggestion ? {
      ...cloudContext,
      dashboardSuggestion: {
        source: "cloud",
        candidate: {
          projectName: candidate.projectName,
          issueType: candidate.issueType,
          finding: candidate.finding,
          reason: candidate.reason,
          severity: candidate.severity,
          suggestedAction: candidate.suggestedAction,
        },
      },
    } : {
      source: "bounded_workspace_health_summary",
      candidate: {
        projectName: candidate.projectName,
        issueType: candidate.issueType,
        finding: candidate.finding,
        reason: candidate.reason,
        severity: candidate.severity,
        git: { hasGit: Boolean(localProject?.hasGit), clean: localProject?.clean ?? null, ahead: localProject?.ahead ?? null, behind: localProject?.behind ?? null },
        documents: {
          readme: Boolean(localProject?.documents?.readme),
          handoff: Boolean(localProject?.documents?.handoff),
          todo: Boolean(localProject?.documents?.todo),
          projectStatus: Boolean(localProject?.documents?.projectStatus),
        },
        allowedActions: candidate.allowedActions,
      },
    },
    history: [],
  };
  void chatWithAI(request).then((result) => {
    if (!workspaceActive || ui.dashboardSuggestionKey !== candidate.suggestionKey) return;
    if (result.provider !== "real") {
      ui.dashboardSuggestionStatus = "mock";
      render();
      return;
    }
    const structured = parseStructuredSuggestion(result.message.content, candidate);
    if (structured) {
      ui.dashboardSuggestion = {
        ...structured,
        severity: candidate.severity,
        finding: candidate.finding,
        reason: candidate.reason,
        suggestedAction: candidate.suggestedAction,
        provider: "real",
      };
      ui.dashboardSuggestionStatus = "ready";
    } else {
      ui.dashboardSuggestion = { ...candidate, error: "GLM 建议格式无效；保留本机扫描结论。" };
      ui.dashboardSuggestionStatus = "error";
    }
    render();
  }).catch((error) => {
    if (!workspaceActive || ui.dashboardSuggestionKey !== candidate.suggestionKey) return;
    ui.dashboardSuggestion = { ...candidate, error: getAIErrorMessage(error) };
    ui.dashboardSuggestionStatus = "error";
    render();
  });
}

function suggestionTaskExists(suggestion) {
  return db.tasks.some((task) => task.sourceKey === suggestion?.sourceKey || task.id === suggestion?.taskId);
}

function createSuggestionTask(suggestion) {
  if (!workspaceActive || !suggestion || suggestionTaskExists(suggestion)) {
    render();
    toast("已在 Tasks 中");
    return;
  }
  const documentLabel = ({ missing_readme: "README", missing_handoff: "HANDOFF", missing_todo: "TODO", missing_project_status: "PROJECT_STATUS" })[suggestion.issueType];
  const item = {
    id: suggestion.taskId,
    sourceKey: suggestion.sourceKey,
    title: documentLabel ? `补齐 ${suggestion.projectName} 的 ${documentLabel}` : `处理 ${suggestion.projectName}：${suggestion.finding}`,
    description: `AI 在 Workspace 健康检查中发现「${suggestion.projectName}」：${suggestion.finding}。建议：${suggestion.suggestedAction}`,
    projectId: suggestion.projectId || "",
    status: "todo",
    priority: ({ high: "高", medium: "中", low: "低" })[suggestion.severity] || "中",
    due: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.tasks.unshift(item);
  ui.createdSuggestionKeys.push(suggestion.sourceKey);
  logActivity("task-added", `创建 AI 建议任务「${item.title}」`, item.projectId || null);
  persist();
  render();
  toast("AI 建议任务已创建并排入云端同步");
}

function codexTaskFor(suggestion) {
  const project = localProjectById(suggestion?.localProjectId);
  return project ? { project, text: formatCodexTask(project, suggestion) } : null;
}

function openCodexConfirmation(suggestion) {
  const prepared = codexTaskFor(suggestion);
  if (!prepared?.text || !suggestion.allowedActions.includes("send_to_codex")) {
    toast("此建议没有可安全交给 Codex 的文档动作");
    return;
  }
  ui.confirmation = {
    kind: "codex",
    title: "准备交给 Codex",
    confirmLabel: "确认交给 Codex",
    suggestion,
    project: prepared.project,
    taskText: prepared.text,
    runnerStatus: "checking",
  };
  render();
  document.querySelector("[data-action=accept-confirm]")?.focus({ preventScroll: true });
  void probeActionRunner(suggestion.sourceKey);
}

async function probeActionRunner(sourceKey) {
  try {
    const result = await runnerRequest("/health");
    if (ui.confirmation?.kind !== "codex" || ui.confirmation.suggestion.sourceKey !== sourceKey) return;
    ui.confirmation.runnerStatus = result.codexAvailable ? "ready" : "cli_missing";
  } catch {
    if (ui.confirmation?.kind !== "codex" || ui.confirmation.suggestion.sourceKey !== sourceKey) return;
    ui.confirmation.runnerStatus = "offline";
  }
  render();
}

async function runnerRequest(path, method = "GET", body = null) {
  const response = await fetch(`http://127.0.0.1:4175${path}`, {
    method,
    mode: "cors",
    credentials: "omit",
    cache: "no-store",
    referrerPolicy: "no-referrer",
    signal: AbortSignal.timeout(8_000),
    headers: body ? { "Content-Type": "application/json", Accept: "application/json" } : { Accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  let result;
  try { result = await response.json(); } catch { result = {}; }
  if (!response.ok) {
    const error = new Error(result.error || `Action Runner returned HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return result;
}

function showCodexFallback(suggestion, taskText, reason) {
  ui.codex = {
    sourceKey: suggestion.sourceKey,
    projectName: suggestion.projectName,
    localProjectId: suggestion.localProjectId,
    taskText,
    status: "fallback",
    dialog: "fallback",
    message: reason || "已准备好，粘贴到 Codex 即可。",
  };
  render();
}

async function startCodexAction(suggestion, taskText) {
  ui.codex = { sourceKey: suggestion.sourceKey, projectName: suggestion.projectName, localProjectId: suggestion.localProjectId, taskText, status: "starting", dialog: "" };
  render();
  try {
    const job = await runnerRequest("/actions/codex", "POST", {
      projectId: suggestion.localProjectId,
      actionType: "send_to_codex",
      task: { issueType: suggestion.issueType },
    });
    if (!workspaceActive) return;
    ui.codex.jobId = job.jobId;
    ui.codex.status = job.status || "queued";
    render();
    void pollCodexJob(job.jobId, 0);
  } catch (error) {
    if (!workspaceActive) return;
    const reason = error.status === 403
      ? "Action Runner 拒绝了不在 D:\\_Codex project 项目清单中的路径；没有执行或写入。"
      : error.status === 409
        ? "扫描状态已变化或目标文档已存在；没有覆盖文件。"
        : error.message === "Failed to fetch" || error instanceof TypeError
          ? "本机 Action Runner 未连接；已生成复制到 Codex 的安全 Task。"
          : "Action Runner 没有启动 Codex；原项目没有改动。";
    showCodexFallback(suggestion, taskText, reason);
  }
}

async function pollCodexJob(jobId, attempt) {
  if (!workspaceActive || !ui.codex || ui.codex.jobId !== jobId) return;
  try {
    const job = await runnerRequest(`/jobs/${encodeURIComponent(jobId)}`);
    if (!workspaceActive || ui.codex.jobId !== jobId) return;
    ui.codex.status = job.status;
    ui.codex.message = job.message || "";
    if (job.status === "queued" || job.status === "running") {
      render();
      if (attempt < 250) setTimeout(() => void pollCodexJob(jobId, attempt + 1), 1_200);
      else { ui.codex.status = "connection_error"; ui.codex.message = "Codex 仍在处理；可以稍后重新查看状态。"; render(); }
      return;
    }
    if (job.status === "awaiting_confirmation") {
      ui.codex = { ...ui.codex, ...job, status: "awaiting_confirmation", dialog: "preview" };
      render();
      return;
    }
    if (job.status === "failed") {
      showCodexFallback(
        { sourceKey: ui.codex.sourceKey, projectName: ui.codex.projectName, localProjectId: ui.codex.localProjectId },
        ui.codex.taskText,
        job.message || "Codex 没有生成可用草稿；原项目没有改动。",
      );
      return;
    }
    if (job.status === "complete") {
      ui.codex = { ...ui.codex, ...job, status: "complete", dialog: "complete" };
      render();
    }
  } catch {
    if (!workspaceActive || ui.codex.jobId !== jobId) return;
    ui.codex.status = "connection_error";
    ui.codex.message = "暂时无法读取 Action Runner 状态；Codex 生成草稿时没有写入原项目。";
    render();
  }
}

async function applyCodexDocument() {
  const job = ui.codex;
  if (!job?.jobId || job.status !== "awaiting_confirmation") return;
  job.status = "applying";
  render();
  try {
    await runnerRequest("/actions/apply", "POST", { jobId: job.jobId });
    if (!workspaceActive) return;
    job.status = "complete";
    job.dialog = "complete";
    job.message = "Codex 已完成；仅创建了确认过的文档。";
    render();
    void refreshLocalProjects();
  } catch (error) {
    if (!workspaceActive) return;
    if (error.status) {
      void pollCodexJob(job.jobId, 0);
      return;
    }
    job.status = "awaiting_confirmation";
    job.message = "写入结果暂不可确认。重新检查 Action Runner 状态后再试。";
    render();
  }
}

async function copyCodexTask() {
  const task = ui.confirmation?.taskText || ui.codex?.taskText || "";
  if (!task) return;
  try {
    await navigator.clipboard.writeText(task);
    toast("完整 Codex Task 已复制");
  } catch {
    const textarea = document.querySelector("#codex-task-text");
    if (textarea) { textarea.focus(); textarea.select(); }
    toast("请在任务框中全选并复制");
  }
}

function suggestionForDashboard(today) {
  if (!today) return null;
  const candidate = today.source === "cloud"
    ? cloudSuggestionForDashboard(today)
    : today.localProject
      ? buildActionSuggestion(today.localProject, today.projectId ? projectById(today.projectId) : null)
      : null;
  if (!candidate) return null;
  if (ui.dashboardSuggestionKey !== candidate.suggestionKey) ui.dashboardSuggestion = candidate;
  requestDashboardSuggestion(candidate, today.localProject || null);
  return ui.dashboardSuggestionKey === candidate.suggestionKey && ui.dashboardSuggestion
    ? ui.dashboardSuggestion
    : candidate;
}

function renderCodexStatus(suggestion) {
  const job = ui.codex;
  if (!job || job.sourceKey !== suggestion?.sourceKey) return "";
  if (["starting", "queued", "running", "applying"].includes(job.status)) {
    const text = job.status === "applying" ? "正在创建确认过的文档…" : "Codex 正在只读沙箱中生成文档草稿…";
    return `<div class="runner-status" role="status" aria-live="polite">${esc(text)}</div>`;
  }
  if (job.status === "awaiting_confirmation") {
    return `<div class="runner-status" role="status">Codex 已生成 ${esc(job.fileName || "文档")} 草稿 · 等待确认写入</div>`;
  }
  if (job.status === "complete") {
    return `<div class="runner-status runner-success" role="status">✅ Codex 已完成 · ${esc(job.fileName || "文档")} · +${Number(job.additions) || 0} / -${Number(job.deletions) || 0}</div>`;
  }
  if (job.status === "fallback") {
    return `<div class="runner-status" role="status">${esc(job.message || "已准备好，粘贴到 Codex 即可")}</div>`;
  }
  if (job.status === "connection_error") {
    return `<div class="runner-status" role="status">${esc(job.message || "Action Runner 状态暂不可用")}</div>`;
  }
  return "";
}

function localScanStatusMessage() {
  const lastSuccess = ui.localProjects?.scannedAt ? formattedTimestamp(ui.localProjects.scannedAt) : "无";
  const lastAttempt = ui.localScanAttemptAt ? formattedTimestamp(ui.localScanAttemptAt) : "尚未尝试";
  if (ui.localProjectsStatus === "ready") {
    return `Companion 在线 · 本次扫描成功 · ${formattedTimestamp(ui.localProjects.scannedAt)}${ui.localScanCacheSaved ? "" : " · 离线缓存未能保存"}`;
  }
  if (ui.localProjectsStatus === "loading") {
    return ui.localProjects
      ? `正在检测 Companion · 暂时显示上次成功扫描，数据可能不是最新 · 上次成功 ${lastSuccess}`
      : "正在连接 Companion · 首页和工作台内容保持可用";
  }
  if (ui.localProjects) {
    return `Companion 离线或不可达 · 显示上次成功扫描，数据可能不是最新 · 上次成功 ${lastSuccess} · 本次尝试 ${lastAttempt}`;
  }
  return `Companion 离线 · 本次扫描失败 · ${lastAttempt} · 暂无成功扫描缓存`;
}

function renderDashboardHealth(model) {
  const statusClass = ui.localProjectsStatus === "ready" ? "online" : ui.localProjectsStatus === "loading" ? "checking" : "offline";
  if (!model) {
    const scanControl = ui.localProjectsStatus === "loading"
      ? `<button class="button quiet small" data-action="refresh-local-projects" disabled>${icon("reset")} 正在检测</button>`
      : ui.localProjectsStatus === "ready"
        ? `<button class="button quiet small" data-action="refresh-local-projects">${icon("reset")} 重新扫描</button>`
        : "";
    const notice = ui.localProjectsStatus === "loading"
      ? "正在检查本机 Companion；当前首页建议仍来自云端资料。"
      : "本机扫描不可用 · 云端 Projects、Tasks 与 AI 建议仍可使用；Git 和文件健康指标暂不显示。";
    const noticeTitle = ui.localProjectsStatus === "loading" ? "正在检测本机 Companion" : "本机扫描不可用";
    return `<section class="card dashboard-health grid-span-12"><div class="card-header"><h2>工作区健康状态</h2>${scanControl}</div><div class="companion-status ${statusClass}" role="status" aria-live="polite">${esc(localScanStatusMessage())}</div><div class="local-companion-notice"><strong>${noticeTitle}</strong><p>${esc(notice)}</p></div></section>`;
  }
  const health = model.health;
  const metrics = [
    ["本地项目", health.total, "扫描范围内"],
    ["Clean", health.clean, "Git 工作区"],
    ["未提交修改", health.dirty, "Git 工作区"],
    ["领先 origin/main", health.ahead, "有本地 commit"],
    ["落后 origin/main", health.behind, "需查看差异"],
    ["缺 README", health.missingReadme, "文档文件"],
    ["缺 HANDOFF", health.missingHandoff, "文档文件"],
    ["缺 TODO", health.missingTodo, "文档文件"],
    [`超过 ${health.staleDays} 天未更新`, health.stale, "按本地 / GitHub 时间"],
  ];
  return `<section class="card dashboard-health grid-span-12"><div class="card-header"><div><h2>工作区健康状态</h2><p>${health.total} 个本地项目 · 数据扫描于 ${esc(formattedTimestamp(ui.localProjects.scannedAt))}</p></div><button class="button quiet small" data-action="refresh-local-projects" ${ui.localProjectsStatus === "loading" ? "disabled" : ""}>${icon("reset")} 重新扫描</button></div><div class="companion-status ${statusClass}" role="status" aria-live="polite">${esc(localScanStatusMessage())}</div><div class="dashboard-health-grid">${metrics.map(([label, value, note]) => `<div class="health-metric ${value > 0 && ["未提交修改", "落后 origin/main", "缺 README", "缺 HANDOFF", "缺 TODO", `超过 ${health.staleDays} 天未更新`].includes(label) ? "needs-attention" : ""}"><strong>${value}</strong><span>${esc(label)}</span><small>${esc(note)}</small></div>`).join("")}</div><div class="dashboard-data-note">ahead / behind 依据本机缓存的 origin/main；扫描不会 fetch 或修改 Git。</div></section>`;
}

function renderDashboardAlerts(model) {
  const status = ui.localProjectsStatus === "loading"
    ? "正在读取扫描提醒…"
    : ["error", "unavailable"].includes(ui.localProjectsStatus)
      ? "本机扫描提醒不可用；云端 Tasks 和 Projects 仍可查看。"
      : "启动 Companion 后显示真实项目提醒。";
  if (!model) return `<section class="card card-pad grid-span-6"><div class="card-header"><h2>今天需要处理</h2></div><div class="empty-state">${esc(status)}</div></section>`;
  const alerts = model.alerts;
  return `<section class="card card-pad grid-span-6"><div class="card-header"><h2>今天需要处理</h2><span class="minor">显示最多 5 条</span></div>${alerts.length ? `<div class="dashboard-alert-list">${alerts.map((item) => `<div class="dashboard-alert"><span class="alert-mark"></span><div class="dashboard-alert-copy"><strong>${esc(item.projectName)}</strong><span>${esc(item.text)}</span></div><button class="button quiet small" data-action="view-local-project" data-id="${esc(item.projectId)}">查看项目 ${icon("chevron")}</button></div>`).join("")}</div>` : `<div class="local-clear">暂无需要处理的扫描提醒。</div>`}</section>`;
}

function renderDashboardChanges() {
  const comparison = ui.localComparison;
  if (ui.localProjectsStatus !== "ready" || !ui.localProjects) {
    const message = ui.localProjectsStatus === "loading" ? "扫描完成后会与上次记录比较。" : "当前没有本机扫描数据。";
    return `<section class="card card-pad grid-span-6"><div class="card-header"><h2>自上次打开后</h2></div><div class="empty-state">${esc(message)}</div></section>`;
  }
  if (!comparison) return `<section class="card card-pad grid-span-6"><div class="card-header"><h2>自上次打开后</h2></div><div class="local-clear">本次扫描尚未建立比较结果。</div></section>`;
  if (comparison.firstScan) {
    return `<section class="card card-pad grid-span-6"><div class="card-header"><h2>自上次打开后</h2></div><div class="local-clear">首次扫描已建立轻量对比基线；下次扫描后会显示 commit、状态和同步变化。</div></section>`;
  }
  const changes = comparison.changes || [];
  const footer = comparison.previousScannedAt ? `上次扫描 ${formattedTimestamp(comparison.previousScannedAt)}` : "基于上次扫描基线";
  return `<section class="card card-pad grid-span-6"><div class="card-header"><h2>自上次打开后</h2><span class="minor">${esc(footer)}</span></div>${changes.length ? `<div class="dashboard-change-list">${changes.slice(0, 5).map((item) => `<div class="dashboard-change"><span class="change-mark ${esc(item.kind)}"></span><div class="dashboard-alert-copy"><strong>${esc(item.projectName)}</strong><span>${esc(item.text)}</span></div><button class="button quiet small" data-action="view-local-project" data-id="${esc(item.projectId)}">查看项目 ${icon("chevron")}</button></div>`).join("")}</div>` : `<div class="local-clear">暂无新的项目变化。</div>`}${comparison.storageWarning ? `<div class="dashboard-data-note">${esc(comparison.storageWarning)}</div>` : ""}</section>`;
}

function renderDashboardRecent(model) {
  if (!model) return `<section class="card card-pad grid-span-12"><div class="card-header"><h2>最近活跃项目</h2></div><div class="empty-state">本机扫描未连接；无法计算最近活跃排序。</div></section>`;
  const projects = model.recentProjects;
  return `<section class="card card-pad grid-span-12">${sectionTitle("最近活跃项目", `<span class="minor">按本地修改、Git commit、GitHub 更新时间综合排序</span>`)}${projects.length ? `<div class="dashboard-recent-grid">${projects.map(({ item, project, activityAt }) => `<button class="dashboard-recent-project" data-action="view-local-project" data-id="${esc(item.id)}"><span class="project-glyph">${esc(initials(item.name))}</span><span class="dashboard-recent-copy"><strong>${esc(item.name)}</strong><span>${esc(item.lastLocalCommit?.message || project?.githubData?.latestCommit?.message || "暂无 commit 摘要")}</span></span><span class="dashboard-recent-time">${activityAt ? timeAgo(new Date(activityAt).toISOString()) : "时间未知"}</span>${icon("chevron")}</button>`).join("")}</div>` : `<div class="empty-state">扫描中没有项目记录。</div>`}</section>`;
}

function cloudWorkspaceAvailable() {
  return cloudCacheActive || ["synced", "syncing"].includes(ui.cloud.status);
}

function dashboardUnavailableMessage() {
  if (ui.cloud.status === "loading") return "Supabase 正在读取当前账号资料。";
  if (ui.cloud.status === "migration") return "Supabase 中暂时没有项目和任务；本机旧资料尚未迁移。";
  if (ui.cloud.status === "error" || ui.cloud.status === "offline") return "当前没有可用的云端缓存；本机草稿不会计入首页。";
  return "Supabase 资料尚未载入。";
}

function dashboardStatCard(label, value, page, filter, description) {
  return `<button class="dashboard-stat-card" data-action="dashboard-stat" data-target-page="${page}" data-filter="${filter}" aria-label="${esc(`${label}：${value}，${description}`)}"><span class="dashboard-stat-label">${esc(label)}</span><strong>${value}</strong><span class="dashboard-stat-link">${esc(description)} ${icon("chevron")}</span></button>`;
}

function renderDashboardGitHubActivity(project) {
  const repository = parsePublicGitHubRepository(project.github);
  const requestStatus = ui.githubRefreshStatus[project.id];
  const snapshot = project.githubData;
  if (!repository) {
    return `<div class="dashboard-github-activity unavailable"><small>GitHub 动态</small><span>私有/本地暂不可读</span></div>`;
  }

  const latest = snapshot?.latestCommit;
  const commitUrl = safeExternal(latest?.url || "");
  const commitDate = latest?.committedAt && !Number.isNaN(new Date(latest.committedAt).getTime())
    ? `<time class="dashboard-github-time" datetime="${esc(latest.committedAt)}" title="${esc(formattedTimestamp(latest.committedAt))}">${esc(timeAgoIfKnown(latest.committedAt))}</time>`
    : `<span class="dashboard-github-time">时间未知</span>`;
  const recentCount = Number.isInteger(snapshot?.recentSevenDayCommitCount) && snapshot.recentSevenDayCommitCount >= 0
    ? `近 7 天 ${snapshot.recentSevenDayCommitCount} 次提交`
    : "近 7 天待更新";
  const commitContent = snapshot
    ? `<span class="dashboard-github-summary">${esc(latest?.message || "暂无提交记录")}</span><div class="dashboard-github-meta">${commitDate}${commitUrl ? `<a class="dashboard-project-link" href="${esc(commitUrl)}" target="_blank" rel="noopener noreferrer">查看 Commit ${icon("external")}</a>` : ""}</div><small class="dashboard-github-count">${esc(recentCount)}</small>`
    : `<span class="dashboard-github-status">${requestStatus === "loading" ? "正在读取…" : requestStatus === "unavailable" ? "仓库暂不可读" : requestStatus === "error" ? "读取失败" : "等待读取"}</span>`;
  const refreshNotice = requestStatus === "loading" && snapshot
    ? "刷新中 · 显示缓存"
    : requestStatus === "unavailable" && snapshot
      ? "暂不可读 · 显示缓存"
      : requestStatus === "error" && snapshot
        ? "读取失败 · 显示缓存"
        : "";
  return `<div class="dashboard-github-activity" aria-live="polite"><small class="dashboard-github-heading">最近提交 · ${esc(repository.fullName)}</small>${commitContent}${refreshNotice ? `<small class="dashboard-github-notice">${esc(refreshNotice)}</small>` : ""}</div>`;
}

function renderDashboardFocusProjects(projects, tasks, dataAvailable) {
  const pinnedCount = countPinnedProjects(projects);
  const pinned = dataAvailable && ui.projectPinningAvailable === true ? getHomePinnedProjects(projects) : [];
  const cards = pinned.map((project) => {
    const localProgress = localProgressForWorkspace(project);
    const projectTasks = tasks.filter((task) => task.projectId === project.id);
    const done = projectTasks.filter((task) => task.status === "done").length;
    const stage = typeof project.stage === "string" ? project.stage.trim() : "";
    const next = typeof project.next === "string" ? project.next.trim() : "";
    const hasStage = stage && stage !== "未填写";
    const hasNext = next && next !== "未填写";
    const github = safeExternal(project.github);
    const website = safeExternal(project.url);
    const pending = ui.projectPinUpdatingId === project.id;
    const links = (url, label) => url
      ? `<a class="dashboard-project-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ${icon("external")}</a>`
      : `<span class="dashboard-project-link unavailable">${esc(label)} 未填写</span>`;
    const localCommit = localProgress?.project.lastLocalCommit;
    const localFreshness = ui.localProjectsStatus === "ready" ? `扫描于 ${formattedTimestamp(localProgress?.scannedAt)}` : `缓存于 ${formattedTimestamp(localProgress?.scannedAt)} · 可能过期`;
    const localState = localProgress ? `本机 Companion · ${localProgress.project.branch || "分支未知"} · ${localProgress.project.clean === true ? "Clean" : localProgress.project.clean === false ? "有未提交修改" : "状态未知"} · ${localFreshness}` : "";
    const localActivity = localProgress ? `<div class="dashboard-github-activity"><small class="dashboard-github-heading">本机最近 Commit · ${esc(localProgress.project.hasGit ? localProgress.project.name : "")}</small><span>${esc(localCommit?.message || "暂无 commit 摘要")}</span><small>${esc(localCommit?.committedAt ? formattedTimestamp(localCommit.committedAt) : "提交时间未知")} · ${esc(localState)}</small></div>` : "";
    return `<article class="dashboard-focus-card"><div class="dashboard-focus-top"><span class="project-glyph">${esc(initials(project.name))}</span>${statusPill(project.status)}</div><button class="dashboard-focus-name" data-action="view-project" data-id="${esc(project.id)}">${esc(project.name)}</button>${hasStage ? `<div class="dashboard-project-detail"><small>当前阶段</small><span>${esc(stage)}</span></div>` : ""}${hasNext ? `<div class="dashboard-project-detail"><small>下一步</small><span>${esc(next)}</span></div>` : ""}${projectTasks.length ? `<div class="dashboard-progress-meta">关联任务完成 ${done}/${projectTasks.length}</div>` : ""}${renderDashboardGitHubActivity(project)}${localActivity}<div class="dashboard-project-links">${links(github, "GitHub")}${links(website, "线上网站")}</div><div class="dashboard-focus-actions"><button class="button quiet small" data-action="view-project" data-id="${esc(project.id)}">打开项目</button><button class="button quiet small" data-action="toggle-project-pin" data-id="${esc(project.id)}" ${pending ? "disabled aria-busy=\"true\"" : ""}>${pending ? "保存中…" : "取消置顶"}</button></div></article>`;
  }).join("");
  const empty = !dataAvailable
    ? dashboardUnavailableMessage()
    : ui.projectPinningAvailable === false
      ? "首页置顶尚未启用。执行 supabase/v3.1-b-project-pinning.sql 后即可选择项目。"
      : ui.projectPinningAvailable !== true
        ? "连接云端后才能检查置顶状态。"
        : pinnedCount < MIN_HOME_PROJECT_PINS
          ? pinnedCount ? `已置顶 ${pinnedCount} 个项目；再置顶 ${MIN_HOME_PROJECT_PINS - pinnedCount} 个后，首页会显示项目卡片。` : "还没有置顶项目。请在 Projects 中手动选择 3–5 个项目。"
          : "当前没有可显示的置顶项目。";
  return `<section class="card card-pad dashboard-focus-section grid-span-12"><div class="section-title"><div><h2>首页置顶项目</h2><p class="minor">仅显示手动置顶项目 · ${pinnedCount}/${MAX_HOME_PROJECT_PINS} · GitHub 数据缓存 1 小时</p></div><div class="heading-actions"><button class="button quiet small" data-action="refresh-home-github" ${ui.githubRefreshing || !pinned.length ? "disabled aria-busy=\"true\"" : ""}>${icon("reset")} 刷新动态</button><button class="button quiet small" data-action="dashboard-stat" data-target-page="projects" data-filter="all">在 Projects 管理 ${icon("arrow")}</button></div></div>${cards ? `<div class="dashboard-focus-grid">${cards}</div>` : `<div class="empty-state">${esc(empty)}${dataAvailable ? `<br><br><button class="button quiet small" data-action="dashboard-stat" data-target-page="projects" data-filter="all">查看 Projects ${icon("arrow")}</button>` : ""}</div>`}</section>`;
}

function renderDashboardSections(model, dataAvailable) {
  const taskRows = model.priorityTasks.length
    ? model.priorityTasks.map((task) => `<button class="dashboard-alert cloud-task-row" data-action="dashboard-stat" data-target-page="tasks" data-filter="todo"><span class="alert-mark"></span><span class="dashboard-alert-copy"><strong>${esc(task.title)}</strong><span>${esc(projectTitle(task.projectId))} · ${esc(taskPriorityLabel(task))}${task.due ? ` · ${esc(task.due)}` : ""}</span></span>${icon("chevron")}</button>`).join("")
    : `<div class="empty-state">${dataAvailable ? "当前没有未完成任务。" : esc(dashboardUnavailableMessage())}</div>`;
  return `<section class="card card-pad grid-span-12"><div class="card-header"><h2>优先待办</h2><button class="button quiet small" data-action="dashboard-stat" data-target-page="tasks" data-filter="todo">全部未完成任务 ${icon("arrow")}</button></div><div class="dashboard-alert-list">${taskRows}</div></section>`;
}

async function generateDailyBrief() {
  if (ui.dailyBriefStatus === "loading") return;
  if (!workspaceActive || !cloudWorkspaceAvailable()) {
    ui.dailyBrief = null;
    ui.dailyBriefStatus = "unavailable";
    render();
    return;
  }
  if (getAIStatus().mode !== "real") {
    ui.dailyBrief = null;
    ui.dailyBriefStatus = "unavailable";
    render();
    return;
  }
  let projects = getHomePinnedProjects(db.projects).slice(0, 5);
  ui.dailyBriefStatus = "loading";
  ui.dailyBrief = null;
  render();
  try {
    const publicProjectIds = projects.filter((project) => parsePublicGitHubRepository(project.github)).map((project) => project.id);
    if (publicProjectIds.length) await refreshGitHubData(publicProjectIds, { force: true, silent: true });
    if (!workspaceActive) return;
    projects = getHomePinnedProjects(db.projects).slice(0, 5);
    const localProgressByProject = ui.localProjectsStatus === "ready"
      ? Object.fromEntries(projects.map((project) => {
        const progress = localProgressForWorkspace(project);
        return progress ? [project.id, progress] : null;
      }).filter(Boolean))
      : {};
    const context = buildDailyBriefContext(projects, { localProgressByProject });
    const result = await chatWithAI({
      message: buildDailyBriefPrompt(),
      currentPage: "home-daily-brief",
      currentProject: null,
      relevantContext: { dailyBriefProjects: context },
      history: [],
    });
    if (!workspaceActive) return;
    if (result.provider !== "real") throw new Error("真实 GLM 服务不可用；未使用 Mock 简报，请检查 AI 配置后重试。");
    ui.dailyBrief = parseDailyBriefResponse(result.message.content, projects, context);
    ui.dailyBriefStatus = "ready";
  } catch (error) {
    ui.dailyBrief = { error: error?.message || getAIErrorMessage(error) };
    ui.dailyBriefStatus = "error";
  }
  render();
}

function renderDailyBrief() {
  const brief = ui.dailyBrief;
  const status = ui.dailyBriefStatus;
  const sections = [
    ["最近完成了什么", brief?.completed],
    ["今天推荐做的事", brief?.recommendations],
    ["需要关注的问题", brief?.watch],
  ];
  const content = status === "loading" ? `<p class="daily-brief-message" role="status">正在刷新提交并请求 GLM 整理置顶项目资料…</p>`
    : status === "error" ? `<p class="daily-brief-message error" role="alert">${esc(brief?.error || "简报生成失败，请重试。")}</p>`
      : status === "unavailable" ? `<p class="daily-brief-message" role="status">${esc(!cloudWorkspaceAvailable() ? dashboardUnavailableMessage() : "GLM 服务未配置为真实 API；为避免 Mock 内容，本次未生成简报。")}</p>`
        : status === "ready" ? sections.map(([title, items]) => `<section class="daily-brief-part"><h3>${title}</h3>${items?.length ? `<ul>${items.map((item) => `<li><strong>${esc(item.project)}</strong> · ${esc(item.text)}<small>依据：${esc(item.basis)}</small></li>`).join("")}</ul>` : `<p class="daily-brief-empty">资料不足，暂无法确认。</p>`}</section>`).join("")
    : `<p class="daily-brief-message">仅在点击后，依据最多 5 个置顶项目的可验证提交、状态和已确认下一步生成；Companion 在线时还会附带本机分支、提交时间与工作区状态元数据，不发送私有提交说明或代码。</p>`;
  const localSource = ui.localProjectsStatus === "ready" ? ` · 本机 Companion 元数据已刷新 ${formattedTimestamp(ui.localProjects?.scannedAt)}` : "";
  return `<section class="card card-pad daily-brief grid-span-12"><div class="card-header"><div><h2>AI 今日简报</h2><p class="minor">真实 GitHub 提交 · 项目状态 · 已确认下一步${esc(localSource)}</p></div><button class="button primary small" data-action="generate-daily-brief" ${status === "loading" ? "disabled aria-busy=\"true\"" : ""}>${status === "loading" ? "生成中…" : status === "ready" ? "重新生成" : "生成简报"}</button></div><div class="daily-brief-content">${content}</div></section>`;
}

function renderDashboardSuggestion(today, suggestion) {
  if (!today || !suggestion) return "";
  if (today.projectId && !db.projects.some((project) => project.id === today.projectId && project.isPinned === true)) return "";
  const status = ui.dashboardSuggestionStatus === "generating" ? "GLM 正在整理"
    : ui.dashboardSuggestionStatus === "ready" ? "GLM-4-Flash"
      : ui.dashboardSuggestionStatus === "error" ? "暂用云端记录"
        : getAIStatus().mode === "real" ? "GLM 建议" : "云端资料建议";
  const action = today.projectId
    ? `<button class="button quiet small" data-action="view-project" data-id="${esc(today.projectId)}">打开项目 ${icon("chevron")}</button>`
    : `<button class="button quiet small" data-action="dashboard-stat" data-target-page="tasks" data-filter="todo">查看未完成任务 ${icon("chevron")}</button>`;
  return `<section class="card dashboard-ai-suggestion grid-span-12"><div class="dashboard-ai-heading"><span>${icon("sparkle")} AI 下一步建议</span><span class="tag">${esc(status)}</span></div><strong>${esc(suggestion.projectName)}</strong><p>${esc(suggestion.suggestedAction)}</p>${suggestion.error ? `<small class="suggestion-error">${esc(suggestion.error)}</small>` : ""}<div class="dashboard-ai-footer"><span>${esc(suggestion.reason)}</span>${action}</div></section>`;
}

function renderDashboard() {
  const cloudModel = cloudDashboardModel();
  const dataAvailable = cloudWorkspaceAvailable();
  const projects = dataAvailable ? db.projects : [];
  const tasks = dataAvailable ? db.tasks : [];
  const today = cloudModel.todayContinue;
  const suggestion = suggestionForDashboard(today);
  const localStatus = ui.localProjectsStatus === "ready" ? `Companion 在线 · ${ui.localProjects.items.length} 个本地项目` : ui.localProjectsStatus === "loading" ? (ui.localProjects ? `检测中 · 缓存 ${ui.localProjects.items.length} 个项目` : "正在连接") : ui.localProjects ? `Companion 离线 · 缓存 ${ui.localProjects.items.length} 个项目` : "Companion 离线";
  const counts = cloudModel.counts;
  const values = dataAvailable ? counts : { projects: "—", activeProjects: "—", openTasks: "—", doneTasks: "—" };
  const stats = `<div class="dashboard-stat-row">${dashboardStatCard("全部项目", values.projects, "projects", "all", "查看所有项目")}${dashboardStatCard("进行中", values.activeProjects, "projects", "active", "查看进行中项目")}${dashboardStatCard("未完成任务", values.openTasks, "tasks", "todo", "查看未完成任务")}${dashboardStatCard("已完成任务", values.doneTasks, "tasks", "done", "查看已完成任务")}</div>`;
  return `<div class="dashboard-home"><div class="page-heading"><div><div class="eyebrow">${formattedDate()} · ${dataAvailable ? "当前账号资料" : "Supabase 云端资料"}</div><h1>今天继续什么？</h1><p>先看正在推进的项目，再确认今天要完成的任务。</p></div><div class="heading-actions"><button class="button primary" data-action="open-create-task">${icon("plus")} 新建任务</button></div></div>
    ${stats}<div class="dashboard-grid">${renderDashboardFocusProjects(projects, tasks, dataAvailable)}${renderDailyBrief()}${renderDashboardSections(cloudModel, dataAvailable)}${renderDashboardSuggestion(today, suggestion)}</div>
    <div class="companion-secondary-status" role="status">本机 Companion：${esc(localStatus)}${ui.localProjectsStatus === "ready" ? ` · <button class="text-button" data-action="refresh-local-projects">重新扫描</button>` : ""} · 仅增强本机 Git 与文件状态。</div></div>`;
}

function renderProjects() {
  const cloudProjects = cloudWorkspaceAvailable() ? [...db.projects] : [];
  const projects = cloudProjects.filter((project) => ui.projectFilter !== "active" || project.status === "进行中")
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
  const pinnedProjectCount = countPinnedProjects(cloudProjects);
  const configured = cloudProjects.filter((project) => parsePublicGitHubRepository(project.github));
  const hasRequestFailure = configured.some((project) => ui.githubRefreshStatus[project.id] === "error");
  const hasUnavailableRepository = configured.some((project) => ui.githubRefreshStatus[project.id] === "unavailable");
  const connectedCount = configured.filter((project) => project.githubData?.refreshedAt).length;
  const connectionLabel = hasRequestFailure ? "GitHub 请求失败" : hasUnavailableRepository ? "部分仓库暂不可读取" : !configured.length ? "GitHub 未配置" : connectedCount ? "GitHub 已连接" : "GitHub 待刷新";
  const localProjects = ui.localProjects?.items || [];
  const scanLabel = ui.localProjectsStatus === "ready" ? `${localProjects.length} 个项目 · 在线` : ui.localProjectsStatus === "loading" ? (ui.localProjects ? `检测中 · 缓存 ${localProjects.length} 个` : "正在连接") : ui.localProjects ? `${localProjects.length} 个项目 · 可能过期` : "Companion 离线";
  const canSyncLocalProjects = ui.localProjectsStatus === "ready" && ui.localProjectsSource === "live" && ui.cloud.status === "synced" && !cloudSyncRunning && !cloudSyncTimer;
  const syncDisabled = !canSyncLocalProjects || ui.localProjectSyncStatus === "syncing";
  const syncLabel = ui.localProjectSyncStatus === "syncing" ? "正在同步…" : "同步本地项目";
  const localSection = `<section class="local-project-section"><div class="section-title"><div><h2>本地项目</h2><p class="local-section-note">只读扫描指定的本地项目根目录；不会修改项目文件或联网刷新 Git。</p></div><div class="heading-actions"><span class="github-overview-status">${esc(scanLabel)}</span><button class="button primary small" data-action="preview-local-project-sync" ${syncDisabled ? "disabled" : ""} title="${canSyncLocalProjects ? "" : "需等待本机实时扫描和云端同步完成"}">${icon("arrow")} ${syncLabel}</button><button class="button small" data-action="refresh-local-projects" ${ui.localProjectsStatus === "loading" ? "disabled aria-busy=\"true\"" : ""}>${icon("reset")} 重新扫描</button></div></div>${ui.localProjectSyncError ? `<p class="cloud-notice-error" role="status">同步失败：${esc(ui.localProjectSyncError)}。恢复云端连接后可重试。</p>` : ""}${localProjects.length ? `<div class="local-project-list">${localProjects.map((item) => {
    const linked = workspaceProjectForLocal(item);
    const repository = safeExternal(item.githubRepository || "");
    const gitLabel = localGitLabel(item);
    const gitClass = !item.hasGit || item.clean === false ? "warning" : item.clean === true ? "ok" : "";
    return `<article class="card local-project-row"><div class="local-project-main"><h3>${esc(item.name)}</h3><code>${esc(item.path)}</code><span class="local-project-link">${linked ? `工作台项目：${esc(linked.name)}` : repository ? `<a href="${esc(repository)}" target="_blank" rel="noreferrer">${esc(repository.replace("https://github.com/", ""))}</a>` : "未关联工作台项目"}</span></div><div class="local-project-meta"><span class="local-state ${gitClass}">${esc(gitLabel)}</span><span>分支 ${esc(item.branch || (item.hasGit ? "未知" : "—"))}</span><span>${esc(localAheadBehind(item))}</span></div><button class="button small" data-action="view-local-project" data-id="${esc(item.id)}">查看状态 ${icon("chevron")}</button></article>`;
  }).join("")}</div>` : ui.localProjects ? `<div class="card empty-state">扫描目录中没有发现本地项目。</div>` : `<div class="card local-companion-notice"><strong>${ui.localProjectsStatus === "loading" ? "正在读取本地项目" : "尚未连接本地 Companion"}</strong><p>请确认开机 Companion 已启动，或在本机项目目录运行 <code>python local_companion.py</code>，然后重新扫描。GitHub Pages 通过允许的跨源请求尝试访问本机 127.0.0.1:4174。</p></div>`}</section>`;
  return `<div class="page-heading"><div><div class="eyebrow">工作空间</div><h1>Projects</h1><p>云端保存项目基础资料；本机 Git 状态由当前设备的 Companion 提供。</p></div><div class="heading-actions"><span class="github-overview-status">${esc(connectionLabel)}</span><button class="button" data-action="refresh-github" ${ui.githubRefreshing ? "disabled aria-busy=\"true\"" : ""}>${icon("reset")} 刷新 GitHub 数据</button><button class="button primary" data-action="open-create-project">${icon("plus")} 新建项目</button></div></div>
    <div class="section-title cloud-project-heading"><div><h2>云端项目资料</h2><p>项目资料随账号同步；首页建议置顶 3–5 个项目，最多 5 个。</p></div><span class="project-pin-count">首页置顶 ${pinnedProjectCount}/${MAX_HOME_PROJECT_PINS}</span></div>
    ${ui.projectPinningAvailable === false ? `<p class="cloud-notice-error project-pin-notice" role="status">跨设备置顶尚未启用。请先在 Supabase 执行 <code>supabase/v3.1-b-project-pinning.sql</code>。</p>` : ""}
    <div class="toolbar"><div class="filter-list">${[["all", "全部项目"], ["active", "进行中"]].map(([filter, label]) => `<button class="filter-button ${ui.projectFilter === filter ? "active" : ""}" data-action="filter-projects" data-filter="${filter}">${label}${filter === "active" && cloudWorkspaceAvailable() ? ` · ${cloudProjects.filter((project) => project.status === "进行中").length}` : ""}</button>`).join("")}</div><span class="muted">${cloudWorkspaceAvailable() ? `${projects.length} 个项目` : esc(dashboardUnavailableMessage())}</span></div>
    ${projects.length ? `<div class="project-cards">${projects.map((project) => {
      const tasks = db.tasks.filter((item) => item.projectId === project.id);
      const done = tasks.filter((item) => item.status === "done").length;
      const recentUpdate = project.githubData?.updatedAt ? `最近更新 ${timeAgo(project.githubData.updatedAt)}` : "";
      const pending = ui.projectPinUpdatingId === project.id;
      const pinDisabled = ui.projectPinningAvailable !== true || !["synced", "error", "offline"].includes(ui.cloud.status) || cloudSyncRunning || Boolean(cloudSyncTimer) || Boolean(ui.projectPinUpdatingId) || (!project.isPinned && pinnedProjectCount >= MAX_HOME_PROJECT_PINS);
      const pinTitle = ui.projectPinningAvailable === false ? "先执行置顶字段增量 SQL" : pinnedProjectCount >= MAX_HOME_PROJECT_PINS && !project.isPinned ? "最多置顶 5 个项目" : "置顶状态会同步到当前账号的其他设备";
      const taskProgress = tasks.length ? `关联任务完成 ${done}/${tasks.length}` : "进度未填写";
      return `<article class="card project-card"><div class="project-card-top"><div class="project-glyph">${esc(initials(project.name))}</div><div class="project-main"><button class="project-card-title" data-action="view-project" data-id="${esc(project.id)}">${esc(project.name)}</button><div class="project-meta">当前阶段：${esc(project.stage || "未填写")}</div></div>${statusPill(project.status)}</div><p>${esc(project.description || "还没有项目简介。")}</p><div class="project-card-bottom"><span>下一步：${esc(project.next || "未填写")}</span><span>${esc(taskProgress)}</span></div><div class="project-card-github"><span>${esc(githubStatus(project))}</span>${recentUpdate ? `<span>${esc(recentUpdate)}</span>` : ""}</div><div class="project-card-actions"><button class="button quiet small" data-action="view-project" data-id="${esc(project.id)}">打开项目</button><button class="button quiet small project-pin-toggle" data-action="toggle-project-pin" data-id="${esc(project.id)}" aria-pressed="${project.isPinned === true}" title="${esc(pinTitle)}" ${pinDisabled ? "disabled" : ""}>${pending ? "保存中…" : project.isPinned === true ? "取消置顶" : "置顶到首页"}</button></div></article>`;
    }).join("")}</div>` : `<div class="card empty-state"><strong>${cloudWorkspaceAvailable() ? ui.projectFilter === "active" ? "没有进行中的项目" : "还没有项目" : "Supabase 资料不可用"}</strong>${cloudWorkspaceAvailable() ? "创建第一个项目来整理任务与资料。" : esc(dashboardUnavailableMessage())}${ui.projectFilter === "all" ? `<br><br><button class="button primary" data-action="open-create-project">${icon("plus")} 新建项目</button>` : ""}</div>`}${ui.projectFilter === "all" ? localSection : ""}`;
}

function safeExternal(url) {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
  } catch { return ""; }
}

function renderGitHubDetails(project) {
  const data = project.githubData;
  const parsedUrl = parsePublicGitHubRepository(project.github);
  const repositoryUrl = data?.repositoryUrl || parsedUrl?.url || "";
  const commit = data?.latestCommit;
  const commitLabel = commit?.message || "暂无提交记录";
  const commitMarkup = commit?.url
    ? `<a class="github-data-link" href="${esc(commit.url)}" target="_blank" rel="noreferrer">${esc(commitLabel)}${commit.sha ? ` · ${esc(commit.sha)}` : ""}</a>`
    : esc(commitLabel);
  const repoMarkup = repositoryUrl
    ? `<a class="github-data-link" href="${esc(repositoryUrl)}" target="_blank" rel="noreferrer">${esc(data?.repositoryName || parsedUrl?.fullName || repositoryUrl)}</a>`
    : "未配置公开仓库";
  const pagesMarkup = data?.pagesUrl
    ? `<a class="github-data-link" href="${esc(data.pagesUrl)}" target="_blank" rel="noreferrer">${esc(data.pagesUrl)}</a>${data.pagesUrlEstimated ? ` <span class="minor">默认地址</span>` : ""}`
    : data?.refreshedAt ? "未启用" : "尚未获取";
  const value = (label, content) => `<div class="github-data-cell"><div class="meta-label">${label}</div><div class="github-data-value">${content}</div></div>`;
  return `<section class="card github-info-card"><div class="github-info-head"><div><h3>GitHub 仓库信息</h3><p>仅读取公开仓库；数据保存在本地浏览器。</p></div><span class="github-status">${esc(githubStatus(project))}</span></div><div class="github-data-grid">
    ${value("仓库名称", repoMarkup)}
    ${value("默认分支", esc(data?.defaultBranch || "尚未获取"))}
    ${value("最近更新时间", esc(data?.updatedAt ? formattedTimestamp(data.updatedAt) : "尚未获取"))}
    ${value("最近一次 commit", commitMarkup)}
    ${value("最近 commit 时间", esc(commit?.committedAt ? formattedTimestamp(commit.committedAt) : data?.refreshedAt ? "暂无提交记录" : "尚未获取"))}
    ${value("GitHub Pages", pagesMarkup)}
    ${value("仓库可见性", data?.isPublic === true ? "Public" : data?.isPublic === false ? "非 Public" : "尚未获取")}
    ${value("数据最后刷新", esc(data?.refreshedAt ? formattedTimestamp(data.refreshedAt) : "尚未刷新"))}
    </div></section>`;
}

function missingLocalProjectLabel() {
  if (ui.localProjectsStatus === "ready") return "此设备未发现本地项目";
  if (ui.localProjectsStatus === "loading") return ui.localProjects ? "正在扫描；当前缓存未发现匹配项目" : "Companion 正在扫描此设备";
  if (ui.localProjects) return "扫描缓存未发现匹配项目（缓存可能过期）";
  return "Companion 离线，本机状态暂不可用";
}

function renderLocalProjectDetails(localProject) {
  const value = (label, content) => `<div class="local-data-cell"><div class="meta-label">${label}</div><div class="local-data-value">${content}</div></div>`;
  const documents = localProject?.documents || {};
  const commit = localProject?.lastLocalCommit;
  const missing = localProject ? "" : missingLocalProjectLabel();
  const cleanLabel = localProject ? localGitLabel(localProject) : missing;
  const aheadBehind = localProject ? localAheadBehind(localProject) : missing;
  const docRows = [
    ["README", documents.readme],
    ["HANDOFF", documents.handoff],
    ["PROJECT_STATUS", documents.projectStatus],
    ["TODO", documents.todo],
    ["PROJECT_CONTEXT", documents.projectContext],
    ["CHANGELOG", documents.changelog],
  ];
  return `<section class="card local-data-card"><div class="github-info-head"><div><h3>本地扫描状态</h3><p>文件名、Git 元数据和最后修改时间；不读取文档正文。</p></div><span class="local-state ${localProject?.clean === false || !localProject?.hasGit ? "warning" : localProject?.clean === true ? "ok" : ""}">${esc(cleanLabel)}</span></div><div class="local-data-grid">
    ${value("Local Path", esc(localProject?.path || missing))}
    ${value("Git Status", esc(cleanLabel))}
    ${value("Branch", esc(localProject?.branch || (localProject?.hasGit ? "未知" : localProject ? "无 Git" : missing)))}
    ${value("Ahead / Behind", esc(aheadBehind))}
    ${value("本地 HEAD", esc(localProject?.head || missing))}
    ${value("origin/main", esc(localProject ? (localProject.originMain || "未找到本地引用") : missing))}
    ${value("Last Local Commit", commit ? `${esc(commit.message || "无提交说明")}<br><span class="minor">${esc(commit.sha)} · ${esc(commit.committedAt ? formattedTimestamp(commit.committedAt) : "时间未知")}</span>` : localProject?.hasGit ? "暂无提交记录" : localProject ? "无 Git 仓库" : esc(missing))}
    ${value("最后修改", esc(localProject?.modifiedAt ? formattedTimestamp(localProject.modifiedAt) : missing))}
    </div><div class="local-documents"><div class="meta-label">项目文档（仅检查是否存在）</div><div class="local-document-grid">${docRows.map(([label, path]) => `<div class="local-document ${path ? "present" : "missing"}"><span>${path ? "✓" : "—"} ${label}</span><small>${esc(path || (localProject ? "缺失" : missing))}</small></div>`).join("")}</div></div>${!localProject ? `<p class="local-scan-note">${esc(missing)}；云端项目资料仍可查看。</p>` : ""}</section>`;
}

function knowledgeContent(item) {
  const href = item.type === "链接" ? safeExternal(item.content.trim()) : "";
  return href ? `<a class="knowledge-external" href="${esc(href)}" target="_blank" rel="noreferrer">${esc(href)} ${icon("external")}</a>` : esc(item.content);
}

function projectNextStepContext(project, tasks) {
  const githubCommit = verifiedProjectGitHubCommit(project);
  return buildProjectNextStepContext({ project, tasks, githubCommit, githubFresh: githubCommit?.fresh === true });
}

function renderProjectNextStep(project, tasks) {
  const current = projectNextStepContext(project, tasks);
  const state = ui.projectNextStep?.projectId === project.id ? ui.projectNextStep : null;
  const aiReady = getAIStatus().mode === "real";
  const stale = Boolean(state?.suggestion && state.contextKey !== current.contextKey);
  const cloudReady = cloudSyncEnabled && ui.cloud.status === "synced" && !cloudSyncRunning && !cloudSyncTimer && navigator.onLine !== false;
  const githubSource = current.context.github.available
    ? `${current.context.github.repositoryName} · ${current.context.github.latestCommitMessage}${current.context.github.committedAt ? ` · ${formattedTimestamp(current.context.github.committedAt)}` : ""}${current.context.github.snapshotFresh ? " · 最近刷新" : " · 快照可能过期"}`
    : parsePublicGitHubRepository(project.github) ? "尚无可验证的公开 GitHub 最近提交" : "未配置有效的公开 GitHub 仓库";
  const missing = [...current.missing, ...(state?.warning ? [state.warning] : [])];
  return `<section class="card card-pad project-next-step" aria-labelledby="project-next-step-title">
    <div class="project-next-step-head"><div><h3 id="project-next-step-title">AI 建议下一步</h3><p>结合项目简介、公开 GitHub 最近提交和关联任务。生成或编辑只是草稿，只有点击采纳才会保存到项目。</p></div><button class="button quiet small" data-action="generate-project-next-step" data-id="${esc(project.id)}" ${state?.busy || !aiReady ? "disabled" : ""}>${state?.busy ? "正在生成…" : state?.suggestion ? "重新生成" : "生成建议"}</button></div>
    <div class="project-next-step-sources"><span>项目简介：${project.description?.trim() ? "已提供" : "缺失"}</span><span>GitHub：${esc(githubSource)}</span><span>关联任务：${tasks.length} 条</span></div>
    ${missing.length ? `<p class="project-next-step-missing" role="status">资料提示：${esc(missing.join("；"))}。建议只依据当前可用资料，不代表未记录的进度。</p>` : ""}
    ${!aiReady ? `<p class="project-next-step-error" role="status">智谱 API 当前未配置；此功能不会改用本地 Mock 生成建议。</p>` : ""}
    ${state?.error ? `<p class="project-next-step-error" role="alert">${esc(state.error)}</p>` : ""}
    ${state?.suggestion ? `<label class="project-next-step-label" for="project-next-step-draft">建议内容（可编辑）</label><textarea id="project-next-step-draft" maxlength="500" rows="3" ${state.busy ? "disabled" : ""}>${esc(state.suggestion)}</textarea><div class="project-next-step-rationale"><strong>依据</strong><span>${esc(state.rationale || "请检查建议依据后再采纳。")}</span></div>
      ${stale ? `<p class="project-next-step-missing" role="status">项目资料或关联任务在生成后有变化，请重新生成后再采纳。</p>` : ""}
      <div class="project-next-step-footer">${state.adopted ? `<span class="project-next-step-saved" role="status">已采纳到项目资料；云端状态请查看页面同步指示。</span>` : !cloudReady ? `<span class="project-next-step-missing" role="status">云端同步就绪后才能采纳。</span>` : ""}<button class="button primary small" data-action="adopt-project-next-step" data-id="${esc(project.id)}" ${state.busy || stale || !cloudReady || !state.suggestion.trim() || state.suggestion.trim() === state.adoptedText ? "disabled" : ""}>${state.adopted ? (state.suggestion.trim() === state.adoptedText ? "已采纳" : "采纳修改") : "采纳为下一步"}</button></div>` : ""}
  </section>`;
}

async function refreshProjectNextStepGitHub(project) {
  const repository = parsePublicGitHubRepository(project.github);
  const cached = verifiedProjectGitHubCommit(project);
  if (!repository) return { commit: null, warning: "未关联有效的公开 GitHub 仓库。" };
  if (cached?.fresh) return { commit: cached, warning: "" };
  if (ui.githubRefreshing) return {
    commit: cached,
    warning: cached ? "GitHub 正在刷新，暂使用上次真实快照；请留意快照时间。" : "GitHub 正在刷新，当前没有可用的最近提交。",
  };

  const githubUrl = project.github;
  ui.githubRefreshing = true;
  ui.githubRefreshStatus[project.id] = "loading";
  try {
    const snapshot = await fetchPublicGitHubRepository(githubUrl);
    const current = projectById(project.id);
    if (!workspaceActive || !current || current.github !== githubUrl) return { commit: null, warning: "项目 GitHub 地址已变化，请重新生成建议。" };
    current.githubData = snapshot;
    ui.githubRefreshStatus[project.id] = "connected";
    delete ui.githubRefreshAttemptAt[project.id];
    saveCloudCache(workspaceAuth.userId, db, cloudBaseline, ui.cloud.lastSyncedAt, ui.projectPinningAvailable);
    return { commit: verifiedProjectGitHubCommit(current), warning: "" };
  } catch {
    ui.githubRefreshAttemptAt[project.id] = Date.now();
    ui.githubRefreshStatus[project.id] = "error";
    return {
      commit: cached,
      warning: cached ? "无法刷新 GitHub；使用上次真实快照，可能不是最新提交。" : "无法从公开 GitHub 获取最近提交，此来源未提供给 AI。",
    };
  } finally {
    ui.githubRefreshing = false;
  }
}

async function generateProjectNextStep(projectId) {
  const project = projectById(projectId);
  if (!project || !workspaceActive) return;
  if (getAIStatus().mode !== "real") {
    ui.projectNextStep = { projectId, error: "智谱 API 当前未配置；此功能不会使用本地 Mock。" };
    render();
    return;
  }
  if (!cloudSyncEnabled || ui.cloud.status !== "synced") {
    ui.projectNextStep = { projectId, error: "请先连接并完成私人云端同步，再生成建议。" };
    render();
    return;
  }

  const requestId = uid("next-step");
  const prior = ui.projectNextStep?.projectId === projectId ? ui.projectNextStep : null;
  ui.projectNextStep = { ...prior, projectId, requestId, busy: true, error: "", warning: "" };
  render();
  try {
    const githubResult = await refreshProjectNextStepGitHub(project);
    if (!workspaceActive || ui.projectNextStep?.requestId !== requestId) return;
    const currentProject = projectById(projectId);
    if (!currentProject) throw new Error("项目已不存在，请返回 Projects 后重试。");
    const tasks = db.tasks.filter((task) => task.projectId === projectId);
    const context = buildProjectNextStepContext({
      project: currentProject,
      tasks,
      githubCommit: githubResult.commit,
      githubFresh: githubResult.commit?.fresh === true,
    });
    if (!context.hasEvidence) {
      ui.projectNextStep = { projectId, requestId, busy: false, error: `资料不足，暂不生成泛化建议。请补齐：${context.missing.join("、")}。`, missing: context.missing, warning: githubResult.warning };
      render();
      return;
    }
    const result = await chatWithAI({
      message: buildProjectNextStepPrompt(),
      currentPage: "project-next-step",
      currentProject: { name: currentProject.name },
      relevantContext: { projectNextStep: context.context },
      history: [],
    });
    if (result.provider !== "real") throw new Error("智谱服务没有返回真实模型结果；建议未生成。");
    const parsed = parseProjectNextStepResponse(result.message?.content);
    if (!workspaceActive || ui.projectNextStep?.requestId !== requestId) return;
    if (parsed.insufficient) {
      const taskOnlyReason = !context.context.tasks.length
        && /任务|待办/.test(parsed.rationale)
        && !/(简介|提交|commit|摘要|时间|目标|功能)/i.test(parsed.rationale);
      if (context.hasEvidence && taskOnlyReason) {
        throw new Error("GLM 将缺少关联任务误判为资料不足；项目简介与有效 GitHub 最近提交已提供，请重新生成。");
      }
      ui.projectNextStep = { projectId, requestId, busy: false, error: parsed.rationale, missing: context.missing, warning: githubResult.warning };
      render();
      return;
    }
    const latestProject = projectById(projectId);
    const latestTasks = db.tasks.filter((task) => task.projectId === projectId);
    const latestContext = buildProjectNextStepContext({
      project: latestProject,
      tasks: latestTasks,
      githubCommit: verifiedProjectGitHubCommit(latestProject),
      githubFresh: verifiedProjectGitHubCommit(latestProject)?.fresh === true,
    });
    if (context.contextKey !== latestContext.contextKey) throw new Error("项目或关联任务在生成期间发生变化，请重新生成建议。");
    ui.projectNextStep = {
      projectId,
      requestId,
      busy: false,
      suggestion: parsed.suggestion,
      rationale: parsed.rationale,
      contextKey: context.contextKey,
      missing: context.missing,
      warning: githubResult.warning,
      model: result.model,
      adopted: false,
      adoptedText: "",
      error: "",
    };
  } catch (error) {
    if (!workspaceActive || ui.projectNextStep?.requestId !== requestId) return;
    ui.projectNextStep = {
      ...ui.projectNextStep,
      busy: false,
      error: error?.message
        ? `${error.message}${error.code ? `（${error.code}${error.status ? `，HTTP ${error.status}` : ""}）` : ""}`
        : getAIErrorMessage(error),
    };
  }
  if (workspaceActive && ui.projectNextStep?.requestId === requestId) render();
}

function adoptProjectNextStep(projectId) {
  const state = ui.projectNextStep;
  const project = projectById(projectId);
  if (!project || !state || state.projectId !== projectId || state.busy || !state.suggestion?.trim()) return;
  if (!cloudSyncEnabled || ui.cloud.status !== "synced" || cloudSyncRunning || cloudSyncTimer || navigator.onLine === false) {
    toast("请等私人云端同步就绪后再采纳建议");
    return;
  }
  const tasks = db.tasks.filter((task) => task.projectId === projectId);
  const current = projectNextStepContext(project, tasks);
  if (current.contextKey !== state.contextKey) {
    ui.projectNextStep = { ...state, error: "项目资料或关联任务在建议生成后发生变化，请重新生成后再采纳。" };
    render();
    return;
  }
  const next = state.suggestion.trim().slice(0, 500);
  if (!next || next === state.adoptedText) return;
  project.next = next;
  project.updatedAt = new Date().toISOString();
  const adoptedContext = projectNextStepContext(project, tasks);
  ui.projectNextStep = { ...state, contextKey: adoptedContext.contextKey, adopted: true, adoptedText: next, error: "" };
  persist();
  render();
  toast("已采纳为项目下一步，正在同步到云端");
}

function renderProjectDetail() {
  const project = projectById(ui.projectId);
  if (!project) return `<div class="page-heading"><div><h1>找不到这个项目</h1><p>它可能已经被删除。</p></div><button class="button" data-page="projects">${icon("back")} 返回项目</button></div>`;
  const tasks = db.tasks.filter((item) => item.projectId === project.id).sort((a, b) => Number(a.status === "done") - Number(b.status === "done"));
  const knowledge = db.knowledge.filter((item) => item.projectId === project.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const activities = db.activities.filter((item) => item.projectId === project.id).slice(0, 6);
  const localProject = localProjectForWorkspace(project);
  const github = safeExternal(project.github);
  const live = safeExternal(project.url);
  return `<div class="detail-topline"><button class="icon-button" data-page="projects" aria-label="返回项目">${icon("back")}</button><span>Projects</span>${icon("chevron")}<span>${esc(project.name)}</span></div>
    <section class="card detail-hero"><div class="detail-hero-head"><div class="detail-hero-copy">${statusPill(project.status)}<h2 style="margin-top:11px">${esc(project.name)}</h2><p>${esc(project.description || "还没有项目简介。")}</p></div><div class="detail-actions"><button class="button" data-action="edit-project" data-id="${esc(project.id)}">${icon("edit")} 编辑项目</button><button class="button quiet danger" data-action="delete-project" data-id="${esc(project.id)}">${icon("trash")} 删除</button></div></div><div class="detail-links">${github ? `<a class="detail-link" href="${esc(github)}" target="_blank" rel="noreferrer">${icon("external")} GitHub</a>` : ""}${live ? `<a class="detail-link" href="${esc(live)}" target="_blank" rel="noreferrer">${icon("external")} 在线网址</a>` : ""}</div></section>
    <div class="detail-meta-grid"><div class="card meta-card"><div class="meta-label">当前阶段</div><div class="meta-value">${esc(project.stage || "未设置")}</div></div><div class="card meta-card"><div class="meta-label">下一步</div><div class="meta-value">${esc(project.next || "待补充")}</div></div><div class="card meta-card"><div class="meta-label">进度概览</div><div class="meta-value">${tasks.filter((task) => task.status === "done").length} / ${tasks.length} 项任务完成</div></div></div>
    ${renderProjectNextStep(project, tasks)}
    ${project.notes ? `<section class="card card-pad project-notes"><div class="meta-label">云端手工备注</div><p>${esc(project.notes)}</p></section>` : ""}
    ${renderGitHubDetails(project)}
    ${renderLocalProjectDetails(localProject)}
    <div class="subgrid"><section class="card task-panel">${sectionTitle("TODO", `<button class="button quiet small" data-action="open-create-task" data-project-id="${esc(project.id)}">${icon("plus")} 添加任务</button>`)}<div>${tasks.map((task) => `<div class="task-detail-row"><button class="check-button ${task.status === "done" ? "checked" : ""}" data-action="toggle-task" data-id="${esc(task.id)}" aria-label="${task.status === "done" ? "重新打开" : "完成"}任务">${task.status === "done" ? icon("checkSquare") : ""}</button><div class="task-text">${esc(task.title)}</div><span class="priority ${priorityClass(task.priority)}">${esc(task.priority || "低")}</span></div>`).join("") || `<div class="empty-state">这个项目还没有任务。</div>`}</div></section>
      <section class="card card-pad">${sectionTitle("最近活动", `<span class="minor">${activities.length} 条</span>`)}<div>${activities.map(activityRow).join("") || `<div class="empty-state">项目活动会显示在这里。</div>`}</div></section>
      <section class="card card-pad" style="grid-column:1/-1">${sectionTitle("相关资料", `<button class="button quiet small" data-action="open-create-knowledge" data-project-id="${esc(project.id)}">${icon("plus")} 添加资料</button>`)}<div class="subgrid">${knowledge.map((item) => `<article class="card knowledge-card"><span class="type-pill">${esc(item.type)}</span><h3>${esc(item.title)}</h3><p>${esc(item.summary || item.content)}</p><div class="tag-row">${item.tags.map((tag) => `<span class="tag">#${esc(tag)}</span>`).join("")}</div></article>`).join("") || `<div class="empty-state">还没有关联资料。</div>`}</div></section></div>`;
}

function renderLocalProjectDetail() {
  const localProject = localProjectById(ui.localProjectId);
  if (!localProject) return `<div class="page-heading"><div><h1>找不到本地项目</h1><p>请返回 Projects 并重新扫描本机目录。</p></div><button class="button" data-page="projects">${icon("back")} 返回项目</button></div>`;
  const linked = workspaceProjectForLocal(localProject);
  const repository = safeExternal(localProject.githubRepository || linked?.github || "");
  return `<div class="detail-topline"><button class="icon-button" data-page="projects" aria-label="返回项目">${icon("back")}</button><span>Projects</span>${icon("chevron")}<span>${esc(localProject.name)}</span></div><section class="card detail-hero"><div class="detail-hero-head"><div class="detail-hero-copy"><span class="status-pill">当前设备本地状态</span><h2 style="margin-top:11px">${esc(localProject.name)}</h2><p>${linked ? `已对应云端项目「${esc(linked.name)}」。` : "此目录目前尚未关联云端项目资料。"}</p></div><div class="detail-actions"><button class="button primary" data-action="open-assistant">${icon("sparkle")} 询问 AI</button></div></div><div class="detail-links"><span class="detail-link">${icon("folder")} ${esc(localProject.path)}</span>${repository ? `<a class="detail-link" href="${esc(repository)}" target="_blank" rel="noreferrer">${icon("external")} GitHub</a>` : ""}</div></section>${renderLocalProjectDetails(localProject)}${linked ? renderGitHubDetails(linked) : ""}<section class="card card-pad local-readonly-note"><strong>只读扫描</strong><p>工作区内文件、Git 提交、远端引用和文档内容均未被修改；扫描只读取项目文档文件名。</p></section>`;
}

function renderTasks() {
  const filters = [["all", "全部"], ["todo", "待办"], ["done", "已完成"]];
  const cloudTasks = cloudWorkspaceAvailable() ? db.tasks : [];
  const tasks = [...cloudTasks].filter((task) => taskMatchesFilter(task, ui.taskFilter)).sort((a, b) => Number(a.status === "done") - Number(b.status === "done") || ["高", "中", "低"].indexOf(a.priority) - ["高", "中", "低"].indexOf(b.priority));
  return `<div class="page-heading"><div><div class="eyebrow">行动清单 · 云端同步</div><h1>Tasks</h1><p>把下一步写清楚，一件一件完成。</p></div><div class="heading-actions"><button class="button primary" data-action="open-create-task">${icon("plus")} 新建任务</button></div></div>
    <div class="toolbar"><div class="filter-list">${filters.map(([value, label]) => `<button class="filter-button ${ui.taskFilter === value ? "active" : ""}" data-action="filter-tasks" data-filter="${value}">${label}${value === "todo" && cloudWorkspaceAvailable() ? ` · ${cloudTasks.filter((task) => task.status !== "done").length}` : ""}</button>`).join("")}</div><span class="muted">${cloudWorkspaceAvailable() ? `${tasks.length} 项任务` : esc(dashboardUnavailableMessage())}</span></div>
    <section class="card card-pad"><div class="task-list">${tasks.map((task) => taskRow(task)).join("") || `<div class="empty-state"><strong>${cloudWorkspaceAvailable() ? "没有符合条件的任务" : "Supabase 资料不可用"}</strong>${cloudWorkspaceAvailable() ? "创建一条任务，让下一步更清晰。" : esc(dashboardUnavailableMessage())}</div>`}</div></section>`;
}

function renderKnowledge() {
  const records = [...db.knowledge].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return `<div class="page-heading"><div><div class="eyebrow">收件箱 · 云端同步</div><h1>Knowledge</h1><p>先收集，再整理。文本、笔记和链接随账号保存。</p></div><div class="heading-actions"><button class="button primary" data-action="open-create-knowledge">${icon("plus")} 添加资料</button></div></div>
    <section class="card card-pad"><div class="card-header"><h3>所有资料</h3><span class="minor">${records.length} 条</span></div>${records.map((item) => `<article class="knowledge-row"><div class="record-icon">${recordIcon(item.type)}</div><div class="record-copy"><div class="record-title">${esc(item.title)}</div><div class="record-meta">${esc(item.summary || "暂无摘要")} · ${esc(projectTitle(item.projectId))} · ${timeAgo(item.createdAt)}</div><details class="knowledge-details"><summary>查看内容</summary><div class="record-meta content-text">${knowledgeContent(item)}</div></details><div class="tag-row">${item.tags.map((tag) => `<span class="tag">#${esc(tag)}</span>`).join("")}</div></div><div class="record-actions" style="opacity:1"><button class="icon-button" data-action="edit-knowledge" data-id="${esc(item.id)}" aria-label="编辑资料">${icon("edit")}</button><button class="icon-button" data-action="delete-knowledge" data-id="${esc(item.id)}" aria-label="删除资料">${icon("trash")}</button></div></article>`).join("") || `<div class="empty-state"><strong>收件箱还空着</strong>添加一段文字、一则笔记或一个网页链接。</div>`}</section>`;
}

function decisionCard(decision) {
  const expanded = ui.expandedDecisionId === decision.id;
  return `<article class="card decision-card" data-action="toggle-decision" data-id="${esc(decision.id)}" tabindex="0" role="button" aria-expanded="${expanded}"><div class="decision-card-top"><div><h3>${esc(decision.question)}</h3><p>${esc(decision.goal || "尚未描述目标")}</p></div><div class="record-actions" style="opacity:1"><button class="icon-button" data-action="edit-decision" data-id="${esc(decision.id)}" aria-label="编辑决策">${icon("edit")}</button><button class="icon-button" data-action="delete-decision" data-id="${esc(decision.id)}" aria-label="删除决策">${icon("trash")}</button></div></div><div class="decision-result">${icon("target")} ${esc(decision.final || "尚未填写最终决定")}</div><div class="record-meta">${esc(projectTitle(decision.projectId))} · ${timeAgo(decision.createdAt)}</div>${expanded ? `<div class="decision-detail-grid"><div class="decision-detail-cell"><div class="meta-label">可选方案</div><div class="meta-value">${esc(decision.options.join("；") || "未记录")}</div></div><div class="decision-detail-cell"><div class="meta-label">Mock AI 建议</div><div class="meta-value">${esc(decision.recommendation || "未生成")}</div></div><div class="decision-detail-cell"><div class="meta-label">时间 · 成本</div><div class="meta-value">${esc(decision.time || "未记录")} · ${esc(decision.cost || "未记录")}</div></div><div class="decision-detail-cell"><div class="meta-label">风险</div><div class="meta-value">${esc(decision.risk || "未记录")}</div></div><div class="decision-detail-cell" style="grid-column:1/-1"><div class="meta-label">决定原因</div><div class="meta-value">${esc(decision.reason || "未记录")}</div></div></div>` : ""}</article>`;
}

function renderDecisions() {
  const decisions = [...db.decisions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return `<div class="page-heading"><div><div class="eyebrow">决策记录 · 云端同步</div><h1>Decisions</h1><p>把问题、选项和最终原因放在一起，方便以后回看。</p></div><div class="heading-actions"><button class="button primary" data-action="open-create-decision">${icon("plus")} 新建决策</button></div></div>
    <div class="section-title"><h2>历史决策</h2><span class="muted">${decisions.length} 条记录</span></div>${decisions.map(decisionCard).join("") || `<div class="card empty-state"><strong>还没有决策记录</strong>记录一次选择，之后就能回看当时的考虑。<br><br><button class="button primary" data-action="open-create-decision">${icon("plus")} 新建决策</button></div>`}`;
}

function pageTitle() {
  if (ui.page === "project") return projectTitle(ui.projectId);
  if (ui.page === "local-project") return localProjectById(ui.localProjectId)?.name || "本地项目";
  return ({ home: "Home", projects: "Projects", knowledge: "Knowledge", decisions: "Decisions", tasks: "Tasks" })[ui.page] || "Home";
}

function renderNav() {
  const items = [["home", "grid", "Home"], ["projects", "folder", "Projects"], ["knowledge", "inbox", "Knowledge"], ["decisions", "bulb", "Decisions"], ["tasks", "checkSquare", "Tasks"]];
  return `<aside class="sidebar"><div class="brand"><div class="brand-mark">D</div><div><div class="brand-name">Daniel Workspace · ${APP_VERSION}</div><div class="brand-caption">个人 AI 工作台</div></div></div><div class="nav-label">Workspace</div><nav class="nav-list" aria-label="主导航">${items.map(([page, iconName, label]) => `<button class="nav-item ${(ui.page === page || (ui.page === "project" && page === "projects")) ? "active" : ""}" data-page="${page}">${icon(iconName)}<span>${label}</span>${page === "tasks" ? `<span class="nav-count">${cloudWorkspaceAvailable() ? openTasks().length : "—"}</span>` : ""}</button>`).join("")}</nav><div class="sidebar-spacer"></div><div class="workspace-mini"><div class="avatar">D</div><div><div class="workspace-title">Daniel 的工作区</div><div class="workspace-sub">云端资料 · 本机状态</div></div></div><div class="sidebar-footer"><span class="local-label"><span class="local-dot"></span> Companion 只读扫描</span></div></aside>`;
}

function searchItems(query) {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [];
  const records = [
    ...db.projects.map((item) => ({ kind: "project", type: "Project", id: item.id, title: item.name, subtitle: `${item.stage || "项目"} · ${item.next || ""}`, haystack: `${item.name} ${item.status} ${item.path} ${item.github} ${item.url} ${item.stage} ${item.next} ${item.description}` })),
    ...db.knowledge.map((item) => ({ kind: "knowledge", type: "Knowledge", id: item.id, title: item.title, subtitle: `${item.type} · ${projectTitle(item.projectId)}`, haystack: `${item.title} ${item.content} ${item.summary} ${item.tags.join(" ")} ${projectTitle(item.projectId)}` })),
    ...db.decisions.map((item) => ({ kind: "decision", type: "Decision", id: item.id, title: item.question, subtitle: `${item.final || "待决定"} · ${projectTitle(item.projectId)}`, haystack: `${item.question} ${item.options.join(" ")} ${item.goal} ${item.time} ${item.cost} ${item.risk} ${item.recommendation} ${item.final} ${item.reason}` })),
    ...db.tasks.map((item) => ({ kind: "task", type: "Task", id: item.id, title: item.title, subtitle: `${projectTitle(item.projectId)} · ${item.status === "done" ? "已完成" : "待办"}`, haystack: `${item.title} ${item.priority} ${item.status} ${projectTitle(item.projectId)}` })),
  ];
  return records.map((record) => ({ ...record, score: record.title.toLocaleLowerCase().includes(needle) ? 0 : record.haystack.toLocaleLowerCase().includes(needle) ? 1 : 5 }))
    .filter((record) => record.score < 5).sort((a, b) => a.score - b.score || a.title.localeCompare(b.title, "zh-CN")).slice(0, 8);
}

function renderSearchResults() {
  const host = document.querySelector("#search-results");
  if (!host) return;
  if (!ui.searchOpen || !ui.query.trim()) { host.innerHTML = ""; return; }
  const results = searchItems(ui.query);
  host.innerHTML = `<div class="search-results"><div class="search-results-head">搜索结果</div>${results.length ? results.map((item) => `<button class="search-result" data-action="open-search-result" data-kind="${item.kind}" data-id="${esc(item.id)}"><span class="record-icon">${recordIcon(item.kind)}</span><span class="search-result-copy"><span class="search-result-title">${esc(item.title)}</span><span class="search-result-sub">${esc(item.subtitle)}</span></span><span class="search-result-type">${item.type}</span></button>`).join("") : `<div class="search-no-results">没有找到相关记录</div>`}<div class="search-footer"><span>搜索项目、资料、决策和任务</span><span>Enter 打开首个结果</span></div></div>`;
}

function contextLabel() {
  if (ui.page === "project") return `当前项目：${projectTitle(ui.projectId)}`;
  if (ui.page === "local-project") return `当前项目：${localProjectById(ui.localProjectId)?.name || "本地项目"}`;
  return `当前页面：${pageTitle()}`;
}

function renderAssistant() {
  if (!ui.assistantOpen) return `<button class="assistant-launcher" data-action="open-assistant" aria-label="打开 AI 助手"><span class="assistant-orb">${icon("sparkle")}</span><span>问问 AI</span></button>`;
  const prompts = ["project", "local-project"].includes(ui.page) ? ["这个项目现在有什么问题？", "这个项目最近有什么变化？", "帮我总结下一步"] : ui.page === "decisions" ? ["帮我整理这个决定", "我最近做了什么决定？"] : ui.page === "tasks" ? ["我下一步应该做什么？", "哪个任务优先？"] : ui.page === "knowledge" ? ["最近收集了哪些资料？", "总结一下当前收件箱"] : ["我下一步应该做什么？", "最近有哪些进展？"];
  const status = getAIStatus();
  const transportNote = status.mode === "real" ? "API Key 仅由 Cloudflare Worker Secret 管理。" : status.hint;
  return `<section class="assistant-panel" aria-label="AI Assistant"><header class="assistant-head"><span class="assistant-orb">${icon("sparkle")}</span><div class="assistant-head-copy"><div class="assistant-head-title">Workspace Assistant <span class="tag ai-mode ${status.mode}">${esc(status.label)}</span></div><div class="ai-mode-hint">${esc(status.hint)}</div><div class="assistant-context">${esc(contextLabel())} · 当前页面数据上下文</div></div><button class="icon-button" data-action="clear-chat" title="清空对话" aria-label="清空对话">${icon("reset")}</button><button class="icon-button" data-action="close-assistant" aria-label="关闭助手">${icon("close")}</button></header>
    <div class="assistant-messages" id="assistant-messages" aria-live="polite">${ui.chat.map((message) => `<div class="chat-message ${message.role === "user" ? "user" : ""} ${message.pending ? "pending" : ""} ${message.isError ? "error" : ""}">${esc(message.text)}${message.isError ? `<button class="chat-retry" data-action="retry-chat" data-id="${esc(message.requestId)}">重试</button>` : ""}</div>`).join("")}</div>
    <div class="assistant-suggestions">${prompts.map((prompt) => `<button class="suggestion-chip" data-action="send-prompt" data-prompt="${esc(prompt)}" ${ui.chatBusy ? "disabled" : ""}>${esc(prompt)}</button>`).join("")}</div>
    <form class="assistant-compose" id="assistant-form"><label class="sr-only" for="assistant-input">给 AI 助手发消息</label><textarea id="assistant-input" name="message" rows="1" placeholder="问问当前工作区…" required ${ui.chatBusy ? "disabled" : ""}></textarea><button class="send-button" type="submit" aria-label="发送" ${ui.chatBusy ? "disabled" : ""}>${icon("send")}</button></form><div class="assistant-note">${esc(status.label)} · ${esc(transportNote)}</div></section>`;
}

function projectOptions(selected = "") {
  return `<option value="">不关联项目</option>${db.projects.map((project) => `<option value="${esc(project.id)}" ${project.id === selected ? "selected" : ""}>${esc(project.name)}</option>`).join("")}`;
}

function field(label, name, value = "", options = {}) {
  const full = options.full ? "full" : "";
  const optional = options.optional ? ` <span class="optional">可选</span>` : "";
  const placeholder = options.placeholder ? ` placeholder="${esc(options.placeholder)}"` : "";
  const required = options.required === false ? "" : "required";
  const input = options.textarea
    ? `<textarea name="${name}" class="${options.short ? "short" : ""}"${placeholder} ${required}>${esc(value)}</textarea>`
    : options.select
      ? `<select name="${name}" ${required}>${options.select}</select>`
      : `<input name="${name}" value="${esc(value)}" type="text" ${required}${placeholder}/>`;
  return `<div class="field ${full}"><label>${label}${optional}</label>${input}</div>`;
}

function recommendationFor(options, goal, risk) {
  const choices = options.filter(Boolean);
  if (!choices.length) return "补充可选方案后，这里会给出一条本地 Mock 建议。";
  const first = choices[0];
  const hasHighRisk = /高|不确定|延期|依赖|昂贵/.test(risk);
  const second = choices[1];
  if (second && hasHighRisk) return `结合目标「${goal || "尚未填写"}」和风险描述，建议先验证「${second}」的成本与可行性，再决定是否投入。`;
  return `先围绕目标「${goal || "尚未填写"}」评估「${first}」是否能用最少时间验证关键假设；如果不行，再比较其他方案。`;
}

function renderModal() {
  if (ui.confirmation?.kind === "codex") {
    const { suggestion, project, taskText } = ui.confirmation;
    const runnerStatus = ui.confirmation.runnerStatus === "ready" ? "本机 Action Runner 已连接 · Codex CLI 可用"
      : ui.confirmation.runnerStatus === "cli_missing" ? "Action Runner 已连接，但未找到 Codex CLI；确认后提供复制 Task"
        : ui.confirmation.runnerStatus === "offline" ? "Action Runner 未连接；确认后提供复制 Task"
          : "正在检查本机 Action Runner…";
    const confirmLabel = ui.confirmation.runnerStatus === "ready" ? "确认交给 Codex" : "确认并生成 Task";
    const checking = ui.confirmation.runnerStatus === "checking";
    return `<div class="modal-backdrop" data-action="close-confirm-backdrop"><section class="modal wide" role="alertdialog" aria-modal="true" aria-labelledby="codex-confirm-title"><header class="modal-head"><div class="modal-head-copy"><h2 id="codex-confirm-title">准备交给 Codex</h2><p>先由 Codex 在只读沙箱中生成草稿，之后还要单独确认文件 diff 才会写入。</p></div><button class="icon-button" data-action="cancel-confirm" aria-label="关闭">${icon("close")}</button></header><div class="modal-body codex-task-body"><div class="runner-status" role="status" aria-live="polite">${esc(runnerStatus)}</div><div class="codex-plan"><div><span>项目</span><strong>${esc(suggestion.projectName)}</strong><code>${esc(project.path)}</code></div><div><span>问题</span><strong>${esc(suggestion.finding)}</strong></div><div><span>计划</span><strong>只创建缺少的 ${esc(({ missing_readme: "README.md", missing_handoff: "HANDOFF.md", missing_todo: "TODO.md", missing_project_status: "PROJECT_STATUS.md" })[suggestion.issueType] || "文档")}。</strong></div><div><span>允许修改</span><strong>${esc(({ missing_readme: "README.md", missing_handoff: "HANDOFF.md", missing_todo: "TODO.md", missing_project_status: "PROJECT_STATUS.md" })[suggestion.issueType] || "文档")}</strong></div><div><span>明确禁止</span><strong>删除、业务源码、其他项目、任意命令、Git 写操作、commit、push、系统或网络设置。</strong></div></div><details class="codex-task-details"><summary>查看完整 Codex Task</summary><textarea id="codex-task-text" readonly rows="13">${esc(taskText)}</textarea></details></div><footer class="modal-foot"><button class="button" data-action="cancel-confirm">取消</button><button class="button quiet" data-action="copy-codex-task">复制 Task</button><button class="button primary" data-action="accept-confirm" ${checking ? "disabled" : ""}>${checking ? "正在检查…" : confirmLabel}</button></footer></section></div>`;
  }
  if (ui.confirmation) {
    if (ui.confirmation.kind === "local-project-sync") {
      const { projects, skipped } = ui.confirmation;
      const preview = projects.length
        ? `<div class="codex-plan">${projects.map((project) => `<div><span>项目</span><strong>${esc(project.name)}</strong><code>${esc(project.github || "未发现 GitHub 地址")}</code><small>描述：${esc(project.description || "未提供，将留空")}</small></div>`).join("")}</div>`
        : `<div class="empty-state">扫描到的项目都已关联云端资料，无需新增。</div>`;
      return `<div class="modal-backdrop confirm-backdrop" data-action="close-confirm-backdrop"><section class="modal wide" role="alertdialog" aria-modal="true" aria-labelledby="local-project-sync-title"><header class="modal-head"><div class="modal-head-copy"><h2 id="local-project-sync-title">同步本地项目 · 预览</h2><p>待新增 ${projects.length} 个 · 已关联并跳过 ${skipped} 个</p></div><button class="icon-button" data-action="cancel-confirm" aria-label="关闭">${icon("close")}</button></header><div class="modal-body"><p class="confirm-message">确认后只新增名称、描述和 GitHub URL；现有云端项目不会被覆盖。Companion 不提供描述时会留空，可在同步后手动补充。本机路径、Git 状态和扫描数据不会上传。</p>${preview}</div><footer class="modal-foot"><button class="button" data-action="cancel-confirm">取消</button>${projects.length ? `<button class="button primary" data-action="accept-confirm">确认同步 ${projects.length} 个项目</button>` : ""}</footer></section></div>`;
    }
    const { title, message, confirmLabel } = ui.confirmation;
    return `<div class="modal-backdrop confirm-backdrop" data-action="close-confirm-backdrop"><section class="modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message"><header class="modal-head"><div class="modal-head-copy"><h2 id="confirm-title">${esc(title)}</h2></div><button class="icon-button" data-action="cancel-confirm" aria-label="关闭">${icon("close")}</button></header><div class="modal-body"><p class="confirm-message" id="confirm-message">${esc(message)}</p></div><footer class="modal-foot"><button class="button" data-action="cancel-confirm">取消</button><button class="button danger" data-action="accept-confirm">${esc(confirmLabel || "确认")}</button></footer></section></div>`;
  }
  if (ui.codex?.dialog === "fallback") {
    return `<div class="modal-backdrop" data-action="close-codex-dialog"><section class="modal wide" role="dialog" aria-modal="true" aria-labelledby="codex-fallback-title"><header class="modal-head"><div class="modal-head-copy"><h2 id="codex-fallback-title">Codex Task 已准备好</h2><p>已准备好，粘贴到 Codex 即可。Runner 没有修改项目文件。</p></div><button class="icon-button" data-action="close-codex-dialog" aria-label="关闭">${icon("close")}</button></header><div class="modal-body codex-task-body"><p class="runner-status">${esc(ui.codex.message || "本机 Action Runner 当前不可用。")}</p><textarea id="codex-task-text" readonly rows="16">${esc(ui.codex.taskText || "")}</textarea></div><footer class="modal-foot"><button class="button" data-action="close-codex-dialog">关闭</button><button class="button primary" data-action="copy-codex-task">复制完整 Task</button></footer></section></div>`;
  }
  if (ui.codex?.dialog === "preview" || ui.codex?.dialog === "complete") {
    const complete = ui.codex.dialog === "complete";
    const diff = ui.codex.diff || "";
    return `<div class="modal-backdrop" data-action="close-codex-dialog"><section class="modal wide" role="dialog" aria-modal="true" aria-labelledby="codex-result-title"><header class="modal-head"><div class="modal-head-copy"><h2 id="codex-result-title">${complete ? "✅ Codex 已完成" : "Codex 已生成文档草稿"}</h2><p>${esc(ui.codex.projectName)} · ${esc(ui.codex.fileName || "文档")}${complete ? ` · +${Number(ui.codex.additions) || 0} / -${Number(ui.codex.deletions) || 0}` : " · 请检查 diff 后确认写入"}</p></div><button class="icon-button" data-action="close-codex-dialog" aria-label="关闭">${icon("close")}</button></header><div class="modal-body codex-task-body"><div class="codex-plan"><div><span>允许修改</span><strong>${esc(ui.codex.fileName || "单个文档")}</strong></div><div><span>执行边界</span><strong>没有删除、业务代码修改、其他项目操作、commit 或 push。</strong></div></div><pre class="codex-diff">${esc(diff)}</pre>${ui.codex.message && !complete ? `<p class="suggestion-error">${esc(ui.codex.message)}</p>` : ""}</div><footer class="modal-foot">${complete ? `<button class="button" data-action="close-codex-dialog">关闭</button><button class="button quiet" data-action="view-codex-project">查看项目</button><button class="button primary" data-action="rescan-after-codex">重新扫描</button>` : `<button class="button" data-action="close-codex-dialog">暂不写入</button><button class="button primary" data-action="apply-codex-document" ${ui.codex.status === "applying" ? "disabled" : ""}>${ui.codex.status === "applying" ? "正在创建…" : `确认创建 ${esc(ui.codex.fileName || "文档")}`}</button>`}</footer></section></div>`;
  }
  if (!ui.modal) return "";
  const { kind, id } = ui.modal;
  const existing = id ? ({ project: projectById(id), task: db.tasks.find((item) => item.id === id), knowledge: db.knowledge.find((item) => item.id === id), decision: db.decisions.find((item) => item.id === id) })[kind] : null;
  if (id && !existing) return "";
  const isEdit = Boolean(existing);
  let title = "", subtitle = "", form = "", wide = "";

  if (kind === "project") {
    title = isEdit ? "编辑项目" : "新建项目"; subtitle = "项目基础资料随账号同步；本机路径只保存在此设备。";
    form = `<div class="form-grid">${field("项目名称", "name", existing?.name || "", { full: true })}${field("项目简介", "description", existing?.description || "", { full: true, textarea: true, short: true, required: false, placeholder: "这个项目要解决什么问题？" })}${field("当前状态", "status", existing?.status || "计划中", { select: ["计划中", "进行中", "暂停", "已完成"].map((x) => `<option ${x === (existing?.status || "计划中") ? "selected" : ""}>${x}</option>`).join("") })}${field("当前阶段", "stage", existing?.stage || "", { placeholder: "例如：原型验证" })}${field("本地路径（仅此设备）", "path", existing?.path || "", { full: true, optional: true, required: false, placeholder: "本机项目路径" })}${field("GitHub 地址", "github", existing?.github || "", { optional: true, required: false, placeholder: "https://github.com/..." })}${field("在线网址", "url", existing?.url || "", { optional: true, required: false, placeholder: "https://..." })}${field("下一步", "next", existing?.next || "", { full: true, textarea: true, short: true, required: false })}${field("手工备注", "notes", existing?.notes || "", { full: true, textarea: true, short: true, optional: true, required: false, placeholder: "跨设备保留的项目背景或补充信息" })}</div>`;
  } else if (kind === "task") {
    title = isEdit ? "编辑任务" : "新建任务"; subtitle = "任务自动保存到此账号的云端工作区。";
    const selectedProject = existing?.projectId || ui.modal.projectId || "";
    form = `<div class="form-grid">${field("任务名称", "title", existing?.title || "", { full: true })}${field("任务说明", "description", existing?.description || "", { full: true, textarea: true, short: true, required: false, placeholder: "补充任务背景或完成说明" })}${field("关联项目", "projectId", "", { select: projectOptions(selectedProject), required: false })}${field("优先级", "priority", "", { select: ["高", "中", "低"].map((x) => `<option ${x === (existing?.priority || "中") ? "selected" : ""}>${x}</option>`).join("") })}${field("到期提示", "due", existing?.due || "", { optional: true, required: false, placeholder: "例如：周五" })}</div>`;
  } else if (kind === "knowledge") {
    title = isEdit ? "编辑资料" : "添加资料"; subtitle = "内容自动保存到此账号的云端收件箱，不会解析网页内容。"; wide = "wide";
    const typeSelect = ["文本", "笔记", "链接"].map((x) => `<option ${x === (existing?.type || "笔记") ? "selected" : ""}>${x}</option>`).join("");
    form = `<div class="form-grid">${field("资料类型", "type", "", { select: typeSelect })}${field("关联项目", "projectId", "", { select: projectOptions(existing?.projectId || ui.modal.projectId || ""), required: false })}${field("标题", "title", existing?.title || "", { full: true })}${field("内容", "content", existing?.content || "", { full: true, textarea: true, placeholder: "粘贴文字、写一则笔记或输入网页链接…" })}${field("简单摘要", "summary", existing?.summary || "", { full: true, textarea: true, short: true, optional: true, required: false, placeholder: "一句话概括这条资料" })}${field("标签", "tags", existing?.tags.join(", ") || "", { full: true, optional: true, required: false, placeholder: "用逗号分隔，例如：产品, 灵感" })}</div>`;
  } else if (kind === "decision") {
    title = isEdit ? "编辑决策" : "新建决策"; subtitle = "决策内容自动保存到此账号的云端工作区。"; wide = "wide";
    const optionsText = existing?.options.join("\n") || "";
    form = `<div class="form-grid">${field("问题", "question", existing?.question || "", { full: true })}${field("目标", "goal", existing?.goal || "", { full: true, textarea: true, short: true })}${field("可选方案", "options", optionsText, { full: true, textarea: true, short: true, placeholder: "每行一个方案" })}${field("时间", "time", existing?.time || "", { textarea: true, short: true, optional: true, required: false })}${field("成本", "cost", existing?.cost || "", { textarea: true, short: true, optional: true, required: false })}${field("风险", "risk", existing?.risk || "", { full: true, textarea: true, short: true, optional: true, required: false })}<div class="field full"><label>AI 建议 <span class="tag">Mock</span></label><div class="recommendation-box" id="decision-recommendation">${esc(existing?.recommendation || recommendationFor([], existing?.goal || "", existing?.risk || ""))}</div></div>${field("最终决定", "final", existing?.final || "", { full: true, optional: true, required: false, placeholder: "填写最终选择的方案" })}${field("决定原因", "reason", existing?.reason || "", { full: true, textarea: true, short: true, optional: true, required: false })}${field("关联项目", "projectId", "", { full: true, select: projectOptions(existing?.projectId || ""), required: false })}</div>`;
  }

  return `<div class="modal-backdrop" data-action="close-modal-backdrop"><section class="modal ${wide}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header class="modal-head"><div class="modal-head-copy"><h2 id="modal-title">${title}</h2><p>${subtitle}</p></div><button class="icon-button" data-action="close-modal" aria-label="关闭">${icon("close")}</button></header><form id="record-form" data-kind="${kind}" data-id="${esc(id || "")}"><div class="modal-body">${form}</div><footer class="modal-foot"><button class="button" type="button" data-action="close-modal">取消</button><button class="button primary" type="submit">${isEdit ? "保存修改" : kind === "decision" ? "保存决策" : "保存"}</button></footer></form></section></div>`;
}

function openLocalProjectSyncPreview() {
  if (!workspaceActive || ui.localProjectsStatus !== "ready" || ui.localProjectsSource !== "live" || ui.cloud.status !== "synced" || cloudSyncRunning || cloudSyncTimer) {
    toast("请等待本机实时扫描和云端同步完成后再试");
    return;
  }
  const items = ui.localProjects?.items || [];
  const projects = [];
  const knownProjects = [...db.projects];
  for (const item of items) {
    const project = {
      name: String(item.name || "").trim(),
      description: String(item.description || ""),
      github: parsePublicGitHubRepository(item.githubRepository)?.url || "",
      path: typeof item.path === "string" ? item.path : "",
    };
    if (!project.name || workspaceProjectForLocal(item) || cloudProjectMatchesLocal(project, knownProjects)) continue;
    projects.push(project);
    knownProjects.push(project);
  }
  ui.confirmation = {
    kind: "local-project-sync",
    projects,
    skipped: Math.max(0, items.length - projects.length),
    onConfirm: () => { void syncLocalProjectsToCloud(projects); },
  };
  render();
}

async function syncLocalProjectsToCloud(previewProjects) {
  if (!workspaceActive || !Array.isArray(previewProjects)) return;
  if (!cloudSyncEnabled || cloudSyncRunning || cloudSyncTimer || cloudSyncRequested) {
    toast("云端同步状态已变化，请稍后重新打开预览");
    return;
  }
  ui.localProjectSyncStatus = "syncing";
  ui.localProjectSyncError = "";
  cloudSyncRunning = true;
  render();
  try {
    const latest = await loadCloudWorkspace(workspaceAuth.client, workspaceAuth.userId, () => workspaceActive);
    if (!workspaceActive) return;
    const knownProjects = [...latest.data.projects];
    const additions = [];
    for (const project of previewProjects) {
      if (cloudProjectMatchesLocal(project, knownProjects)) continue;
      const now = new Date().toISOString();
      const addition = {
        id: uid("project"),
        name: project.name,
        description: project.description,
        status: "计划中",
        stage: "",
        next: "",
        github: project.github,
        url: "",
        notes: "",
        path: project.path,
        createdAt: now,
        updatedAt: now,
      };
      additions.push(addition);
      knownProjects.push(addition);
    }
    await insertCloudProjects(workspaceAuth.client, workspaceAuth.userId, additions);
    if (!workspaceActive) return;
    const refreshed = await loadCloudWorkspace(workspaceAuth.client, workspaceAuth.userId, () => workspaceActive);
    if (!workspaceActive) return;
    activateCloudWorkspace(refreshed, { ...db, projects: [...db.projects, ...additions] });
    ui.localProjectSyncStatus = "idle";
    ui.localProjectSyncError = "";
    toast(additions.length ? `已新增 ${additions.length} 个本地项目到云端` : "所有扫描项目都已存在于云端");
  } catch (error) {
    if (!workspaceActive) return;
    ui.localProjectSyncStatus = "error";
    ui.localProjectSyncError = typeof error?.message === "string" ? error.message : "云端写入失败";
  } finally {
    cloudSyncRunning = false;
    if (workspaceActive) render();
    if (cloudSyncRequested && workspaceActive) void syncCloudNow();
  }
}

function cloudStatusLabel() {
  if (ui.cloud.status === "synced") {
    const time = ui.cloud.lastSyncedAt ? new Date(ui.cloud.lastSyncedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : "";
    return time ? `已同步 ${time}` : "已同步";
  }
  if (ui.cloud.status === "syncing") return "正在同步…";
  if (ui.cloud.status === "migrating") return "正在迁移…";
  if (ui.cloud.status === "loading") return "正在读取…";
  if (ui.cloud.status === "offline") return "离线 · 保留缓存";
  if (ui.cloud.status === "migration") return ui.cloud.migrationDismissed ? "本机保存" : "待迁移";
  return "同步失败 · 重试";
}

function renderCloudNotice() {
  if (ui.cloud.status === "error" || ui.cloud.status === "offline") {
    const cacheMessage = cloudCacheActive
      ? `当前显示上次成功同步的云端缓存${ui.cloud.lastSyncedAt ? `（${formattedTimestamp(ui.cloud.lastSyncedAt)}）` : ""}。`
      : "没有可用的云端缓存；首页不会把本机草稿当成云端数据展示。";
    const localNotice = ui.cloud.localDataUnmerged
      ? "本机旧资料仍保留在设备上，当前显示账号云端资料。"
      : "";
    return `<section class="cloud-notice cloud-notice-subtle" role="status"><div><strong>${ui.cloud.status === "offline" ? "云端连接中断" : "云端同步失败"}</strong><p>${ui.cloud.error ? `${esc(ui.cloud.error)} · ` : ""}${esc(cacheMessage)}${localNotice ? ` ${localNotice}` : ""}恢复网络或服务后可重试。</p></div><div class="cloud-notice-actions">${ui.cloud.migrationAvailable ? `<button class="button primary small" data-action="migrate-legacy-data">重试迁移</button>` : ""}<button class="button quiet small" data-action="retry-cloud-sync">${icon("reset")} 重试云同步</button></div></section>`;
  }
  if (ui.cloud.migrationAvailable && !ui.cloud.migrationDismissed) {
    const counts = countLocalMigrationCandidates(db);
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    const summary = Object.entries(counts).filter(([, count]) => count).map(([kind, count]) => `${({ projects: "项目", tasks: "任务", knowledge: "资料", decisions: "决策" })[kind]} ${count}`).join(" · ");
    return `<section class="cloud-notice" role="status"><div><strong>发现此设备的旧工作区资料</strong><p>Supabase 云端目前为空。可以将 ${total} 条真实资料迁移到云端；演示内容会跳过，已有云端记录不会被覆盖。本机原始 localStorage 会保留。</p><span class="cloud-notice-detail">${esc(summary)}</span>${ui.cloud.status === "error" ? `<p class="cloud-notice-error">迁移没有完成；本机资料仍保留。${ui.cloud.error ? ` ${esc(ui.cloud.error)}` : ""}</p>` : ""}</div><div class="cloud-notice-actions"><button class="button primary small" data-action="migrate-legacy-data" ${ui.cloud.status === "migrating" ? "disabled" : ""}>迁移到云端</button><button class="button quiet small" data-action="defer-cloud-migration">稍后</button></div></section>`;
  }
  if (ui.cloud.localDataUnmerged) {
    return `<section class="cloud-notice" role="status"><div><strong>云端已有工作区资料</strong><p>为保护云端内容，本机旧资料没有自动合并；它仍保存在这台设备原有的 localStorage 中。当前显示云端资料。</p></div></section>`;
  }
  return "";
}

function render() {
  if (!workspaceActive) return;
  const page = ui.page === "home" ? renderDashboard() : ui.page === "projects" ? renderProjects() : ui.page === "project" ? renderProjectDetail() : ui.page === "local-project" ? renderLocalProjectDetail() : ui.page === "tasks" ? renderTasks() : ui.page === "knowledge" ? renderKnowledge() : renderDecisions();
  app.innerHTML = `${renderNav()}<main class="main-shell"><header class="topbar"><div class="breadcrumbs"><span>Daniel Workspace</span><span class="crumb-sep">/</span><strong>${esc(pageTitle())}</strong></div><div class="search-wrap"><div class="search-box">${icon("search")}<input id="global-search" type="search" value="${esc(ui.query)}" placeholder="搜索项目、资料、决策或任务…" autocomplete="off" aria-label="全局搜索"/><kbd class="search-hint">Ctrl K</kbd></div><div id="search-results"></div></div><div class="topbar-actions"><span class="today-label">${formattedDate()}</span><button class="cloud-sync-indicator ${esc(ui.cloud.status)}" data-action="retry-cloud-sync" title="点击重新检查 Supabase 同步状态" aria-live="polite" ${["loading", "syncing", "migrating"].includes(ui.cloud.status) ? "disabled" : ""}>${esc(cloudStatusLabel())}</button><button class="icon-button theme-toggle" data-action="toggle-theme" title="切换到${document.documentElement.dataset.theme === "light" ? "深色" : "浅色"}模式" aria-label="切换到${document.documentElement.dataset.theme === "light" ? "深色" : "浅色"}模式">${icon(document.documentElement.dataset.theme === "light" ? "moon" : "sun")}</button><button class="icon-button" data-action="open-assistant" title="打开 AI Assistant" aria-label="打开 AI Assistant">${icon("sparkle")}</button><button class="button quiet small logout-button" data-action="logout">退出登录</button></div></header><div class="content">${renderCloudNotice()}${page}</div></main>${renderAssistant()}${renderModal()}<div class="toast-region" id="toast-region" aria-live="polite"></div>`;
  renderSearchResults();
  if (ui.assistantOpen) document.querySelector("#assistant-messages")?.scrollTo({ top: 999999, behavior: "smooth" });
  if (ui.page === "home" && cloudWorkspaceAvailable() && ui.projectPinningAvailable === true && !ui.githubRefreshing) {
    const stalePinnedIds = getHomePinnedProjects(db.projects)
      .filter((project) => parsePublicGitHubRepository(project.github) && !isGitHubSnapshotFresh(project.githubData)
        && ui.githubRefreshStatus[project.id] !== "loading"
        && !(ui.githubRefreshAttemptAt[project.id] && Date.now() - ui.githubRefreshAttemptAt[project.id] < GITHUB_CACHE_TTL_MS))
      .map((project) => project.id);
    if (stalePinnedIds.length) void refreshGitHubData(stalePinnedIds, { force: false, silent: true });
  }
}

function toast(message) {
  const region = document.querySelector("#toast-region");
  if (!region) return;
  const element = document.createElement("div");
  element.className = "toast";
  element.innerHTML = `${icon("checkSquare")}<span>${esc(message)}</span>`;
  region.append(element);
  setTimeout(() => element.remove(), 2800);
}

function openModal(kind, id = null, projectId = null) {
  ui.modal = { kind, id, projectId };
  render();
  document.querySelector(".modal input, .modal textarea")?.focus({ preventScroll: true });
}

function openConfirmation({ title, message, confirmLabel, onConfirm }) {
  ui.confirmation = { title, message, confirmLabel, onConfirm };
  render();
  document.querySelector("[data-action=accept-confirm]")?.focus({ preventScroll: true });
}

async function sendChat(message) {
  const clean = message.trim();
  if (!clean || ui.chatBusy) return;
  const requestId = uid("chat");
  const pendingMessage = { role: "assistant", text: "GLM-4-Flash 正在思考…", pending: true, requestId };
  ui.chat.push({ role: "user", text: clean, requestId }, pendingMessage);
  ui.chatBusy = true;
  ui.assistantOpen = true;
  try {
    render();
    const companionContextAvailable = ui.localProjectsStatus === "ready"
      || (ui.localProjectsStatus === "loading" && Boolean(ui.localProjects));
    const assistantLocalProjects = companionContextAvailable ? ui.localProjects?.items || [] : [];
    const localProject = !companionContextAvailable ? null
      : ui.page === "local-project" ? localProjectById(ui.localProjectId)
        : ui.page === "project" ? localProjectForWorkspace(projectById(ui.projectId))
          : null;
    const assistantPage = ui.page === "local-project" ? "project" : ui.page;
    const homeLocalModel = assistantPage === "home" ? localDashboardModel() : null;
    const dashboardModel = assistantPage === "home"
      ? homeLocalModel || cloudDashboardModel()
      : null;
    const cloudContextAvailable = cloudCacheActive || ui.cloud.status === "synced";
    const assistantData = cloudContextAvailable ? db : { projects: [], tasks: [], knowledge: [], decisions: [], activities: [] };
    const selection = window.getSelection();
    const selectedContent = selection?.anchorNode && document.querySelector(".main-shell .content")?.contains(selection.anchorNode.parentElement)
      ? selection.toString().trim().slice(0, 1_200)
      : "";
    const context = buildAssistantContext({
      data: assistantData,
      currentPage: assistantPage,
      projectId: ui.projectId,
      taskFilter: ui.taskFilter,
      localProject,
      localProjects: assistantLocalProjects,
      dashboardModel,
      localChanges: ui.localComparison?.changes || [],
      comparisonFirstScan: ui.localComparison?.firstScan || false,
      selectedContent,
      companionStatus: ui.localProjectsStatus,
      companionScannedAt: companionContextAvailable ? ui.localProjects?.scannedAt || "" : "",
    });
    const request = {
      message: clean,
      currentPage: assistantPage,
      currentProject: context.currentProject,
      relevantContext: context.relevantContext,
      history: ui.chat.filter((item) => !item.pending && !item.isError && ["user", "assistant"].includes(item.role)).slice(-20).map((item) => ({ role: item.role, content: item.text.slice(0, 1_200) })),
    };
    const result = await chatWithAI(request);
    pendingMessage.text = result.message.content;
    pendingMessage.provider = result.provider;
  } catch (error) {
    const userMessage = ui.chat.find((item) => item.requestId === requestId && item.role === "user");
    if (userMessage) userMessage.isError = true;
    pendingMessage.text = getAIErrorMessage(error);
    pendingMessage.provider = "real";
    pendingMessage.isError = true;
  } finally {
    pendingMessage.pending = false;
    ui.chatBusy = false;
    render();
  }
}

function submitRecord(form) {
  const data = new FormData(form);
  const values = Object.fromEntries(data.entries());
  const kind = form.dataset.kind;
  const id = form.dataset.id;
  const existing = id ? ({ project: projectById(id), task: db.tasks.find((x) => x.id === id), knowledge: db.knowledge.find((x) => x.id === id), decision: db.decisions.find((x) => x.id === id) })[kind] : null;
  const now = new Date().toISOString();

  if (kind === "project") {
    const item = { ...values, ...(typeof existing?.isPinned === "boolean" ? { isPinned: existing.isPinned } : {}), id: existing?.id || uid("project"), createdAt: existing?.createdAt || now, updatedAt: now, status: values.status || "计划中" };
    if (existing) {
      const repositoryChanged = existing.github !== item.github;
      Object.assign(existing, item);
      if (repositoryChanged) {
        delete existing.githubData;
        delete ui.githubRefreshStatus[item.id];
      }
    }
    else { db.projects.unshift(item); logActivity("project-created", `创建项目「${item.name}」`, item.id); }
    ui.page = "project"; ui.projectId = item.id;
    history.replaceState({ page: "project", projectId: item.id }, "", `#project/${encodeURIComponent(item.id)}`);
  } else if (kind === "task") {
    const item = { ...values, id: existing?.id || uid("task"), status: existing?.status || "todo", createdAt: existing?.createdAt || now, updatedAt: now };
    if (existing) Object.assign(existing, item);
    else { db.tasks.unshift(item); logActivity("task-added", `创建任务「${item.title}」`, item.projectId || null); }
  } else if (kind === "knowledge") {
    const item = { ...values, id: existing?.id || uid("knowledge"), tags: values.tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean), createdAt: existing?.createdAt || now, updatedAt: now };
    if (existing) Object.assign(existing, item);
    else { db.knowledge.unshift(item); logActivity("knowledge-added", `新增资料「${item.title}」`, item.projectId || null); }
  } else if (kind === "decision") {
    const options = values.options.split(/\r?\n/).map((option) => option.trim()).filter(Boolean);
    const recommendation = recommendationFor(options, values.goal, values.risk);
    const item = { ...values, options, recommendation, id: existing?.id || uid("decision"), createdAt: existing?.createdAt || now, updatedAt: now };
    if (existing) Object.assign(existing, item);
    else { db.decisions.unshift(item); logActivity("decision-saved", `保存决策「${item.question}」`, item.projectId || null); }
    ui.page = "decisions";
  }
  persist();
  ui.modal = null;
  render();
  toast(existing ? "修改已保存" : ({ project: "项目已创建", task: "任务已创建", knowledge: "资料已保存", decision: "决策已保存" })[kind]);
}

async function refreshGitHubData(projectIds = null, { force = true, silent = false } = {}) {
  if (ui.githubRefreshing) return;
  const selectedIds = projectIds === null ? null : new Set(Array.isArray(projectIds) ? projectIds : [projectIds]);
  const candidates = db.projects
    .filter((project) => !selectedIds || selectedIds.has(project.id))
    .map((project) => ({ project, githubUrl: project.github, repository: parsePublicGitHubRepository(project.github) }))
    .filter(({ project, repository }) => repository && (force || (!isGitHubSnapshotFresh(project.githubData)
      && ui.githubRefreshStatus[project.id] !== "loading"
      && !(ui.githubRefreshAttemptAt[project.id] && Date.now() - ui.githubRefreshAttemptAt[project.id] < GITHUB_CACHE_TTL_MS))));
  if (!candidates.length) {
    if (!silent) toast("没有可读取的公开 GitHub 仓库地址");
    return;
  }

  ui.githubRefreshing = true;
  candidates.forEach(({ project }) => { ui.githubRefreshStatus[project.id] = "loading"; });
  render();

  const results = await Promise.all(candidates.map(async ({ project, githubUrl }) => {
    try {
      const snapshot = await fetchPublicGitHubRepository(githubUrl);
      const currentProject = projectById(project.id);
      if (currentProject?.github === githubUrl) currentProject.githubData = snapshot;
      ui.githubRefreshStatus[project.id] = "connected";
      delete ui.githubRefreshAttemptAt[project.id];
      return "success";
    } catch (error) {
      ui.githubRefreshAttemptAt[project.id] = Date.now();
      ui.githubRefreshStatus[project.id] = error?.status === 404 ? "unavailable" : "error";
      return "error";
    }
  }));

  ui.githubRefreshing = false;
  const successCount = results.filter((result) => result === "success").length;
  const errorCount = results.length - successCount;
  if (successCount) saveCloudCache(workspaceAuth.userId, db, cloudBaseline, ui.cloud.lastSyncedAt, ui.projectPinningAvailable);
  render();
  if (silent) return;
  if (errorCount && successCount) toast(`已更新 ${successCount} 个仓库；${errorCount} 个请求失败，已有数据已保留`);
  else if (errorCount) toast("GitHub 请求失败，已有数据已保留");
  else toast(`GitHub 数据已更新（${successCount} 个仓库）`);
}

async function refreshLocalProjects() {
  if (!workspaceActive) return;
  if (!localScanEndpoint) {
    ui.localProjectsStatus = "unavailable";
    ui.localScanAttemptAt = new Date().toISOString();
    render();
    return;
  }
  ui.localProjectsStatus = "loading";
  render();
  const controller = new AbortController();
  activeLocalScanController = controller;
  const timeoutId = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(localScanEndpoint, {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
      mode: localScanEndpoint.startsWith("http") ? "cors" : "same-origin",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const inventory = await response.json();
    if (!workspaceActive) return;
    if (!Array.isArray(inventory.items) || typeof inventory.scannedAt !== "string") throw new Error("Invalid local project inventory");
    const prior = loadLocalScanBaseline();
    const comparison = compareLocalProjects(inventory.items, prior.baseline, inventory.scannedAt);
    const saved = saveLocalScanBaseline(comparison.current);
    ui.localComparison = {
      firstScan: comparison.firstScan,
      changes: comparison.changes,
      previousScannedAt: prior.baseline?.scannedAt || "",
      storageWarning: !prior.readable
        ? "此前比较基线无法读取；本次已重新建立。"
        : !saved
          ? "浏览器未能保存比较基线；下次打开时可能无法比较。"
          : "",
    };
    ui.localScanCacheSaved = saveLocalScanCache(inventory);
    ui.localProjects = inventory;
    ui.localProjectsSource = "live";
    ui.localProjectsStatus = "ready";
    ui.localScanAttemptAt = inventory.scannedAt;
  } catch (error) {
    if (!workspaceActive) return;
    ui.localProjectsStatus = ui.localProjects ? "error" : "unavailable";
    ui.localProjectsSource = ui.localProjects ? "cache" : null;
    ui.localScanAttemptAt = new Date().toISOString();
  } finally {
    clearTimeout(timeoutId);
    if (activeLocalScanController === controller) activeLocalScanController = null;
  }
  if (workspaceActive) render();
}

function handleSearchResult(kind, id) {
  ui.query = "";
  if (kind === "project") go("project", id);
  if (kind === "knowledge") go("knowledge");
  if (kind === "decision") go("decisions");
  if (kind === "task") go("tasks");
}

async function toggleProjectPinInCloud(projectId) {
  const project = projectById(projectId);
  if (!project || !workspaceActive) return;
  if (ui.projectPinningAvailable !== true) {
    toast(ui.projectPinningAvailable === false ? "请先执行置顶字段增量 SQL" : "连接云端并完成同步后才能置顶");
    return;
  }
  if (!["synced", "error", "offline"].includes(ui.cloud.status) || cloudSyncRunning || cloudSyncTimer || ui.projectPinUpdatingId) {
    toast("请等待云端同步完成后再修改置顶状态");
    return;
  }

  const result = nextProjectPinState(db.projects, projectId);
  if (!result.changed) {
    if (result.reason === "limit") toast("首页最多置顶 5 个项目");
    return;
  }

  ui.projectPinUpdatingId = projectId;
  render();
  try {
    await setCloudProjectPinned(workspaceAuth.client, workspaceAuth.userId, projectId, result.isPinned);
    if (!workspaceActive) return;
    project.isPinned = result.isPinned;
    const baselineProject = cloudBaseline?.projects?.find((item) => item.id === projectId);
    if (baselineProject) baselineProject.isPinned = result.isPinned;
    workspaceDataRevision += 1;
    // A successful isolated pin update does not mean the rest of a cached workspace synced.
    const syncTimestamp = ui.cloud.status === "synced" ? new Date().toISOString() : ui.cloud.lastSyncedAt;
    if (ui.cloud.status === "synced") ui.cloud.error = "";
    ui.cloud.lastSyncedAt = syncTimestamp;
    if (!saveCloudCache(workspaceAuth.userId, db, cloudBaseline, ui.cloud.lastSyncedAt, ui.projectPinningAvailable)) {
      ui.cloud.error = "置顶已保存到云端，但浏览器未能更新离线缓存";
    }
    toast(result.isPinned ? "已置顶到首页，并同步到其他设备" : "已取消置顶，并同步到其他设备");
  } catch (error) {
    if (!workspaceActive) return;
    ui.cloud.status = navigator.onLine === false ? "offline" : "error";
    ui.cloud.error = typeof error?.message === "string" ? error.message : "置顶状态保存失败";
    toast("置顶状态保存失败；云端项目资料未更改");
  } finally {
    ui.projectPinUpdatingId = null;
    if (workspaceActive) render();
  }
}

function handleAction(action, element, sourceEvent) {
  const id = element.dataset.id;
  if (action === "close-confirm-backdrop" && element !== sourceEvent?.target) return;
  if (action === "cancel-confirm" || action === "close-confirm-backdrop") { ui.confirmation = null; render(); return; }
  if (action === "accept-confirm") {
    const confirmation = ui.confirmation;
    const onConfirm = confirmation?.onConfirm;
    ui.confirmation = null;
    render();
    if (confirmation?.kind === "codex") {
      if (confirmation.runnerStatus !== "ready") {
        const reason = confirmation.runnerStatus === "cli_missing"
          ? "本机 Action Runner 未找到 Codex CLI；已准备好复制 Task。"
          : "本机 Action Runner 未连接；已准备好复制 Task。";
        showCodexFallback(confirmation.suggestion, confirmation.taskText, reason);
      } else void startCodexAction(confirmation.suggestion, confirmation.taskText);
    } else onConfirm?.();
    return;
  }
  if (action === "copy-codex-task") { void copyCodexTask(); return; }
  if (action === "close-codex-dialog") {
    if (element.hasAttribute("data-action") && element.classList.contains("modal-backdrop") && element !== sourceEvent?.target) return;
    if (ui.codex) ui.codex.dialog = "";
    render();
    return;
  }
  if (action === "send-to-codex") {
    const suggestion = ui.dashboardSuggestion;
    if (suggestion?.allowedActions?.includes("send_to_codex")) openCodexConfirmation(suggestion);
  }
  if (action === "toggle-project-pin") { void toggleProjectPinInCloud(id); return; }
  if (action === "create-suggestion-task") createSuggestionTask(ui.dashboardSuggestion);
  if (action === "view-suggestion-project") goLocalProject(id);
  if (action === "show-codex-result" && ui.codex) {
    ui.codex.dialog = ui.codex.status === "fallback" ? "fallback" : ui.codex.status === "complete" ? "complete" : "preview";
    render();
  }
  if (action === "apply-codex-document") void applyCodexDocument();
  if (action === "view-codex-project" && ui.codex?.localProjectId) {
    const localProjectId = ui.codex.localProjectId;
    ui.codex.dialog = "";
    goLocalProject(localProjectId);
  }
  if (action === "rescan-after-codex") {
    if (ui.codex) ui.codex.dialog = "";
    void refreshLocalProjects();
    render();
  }
  if (action === "open-create-project") openModal("project");
  if (action === "generate-project-next-step") { void generateProjectNextStep(id); return; }
  if (action === "generate-daily-brief") { void generateDailyBrief(); return; }
  if (action === "adopt-project-next-step") { adoptProjectNextStep(id); return; }
  if (action === "preview-local-project-sync") openLocalProjectSyncPreview();
  if (action === "retry-cloud-sync") void initializeCloudSync();
  if (action === "migrate-legacy-data") void migrateLegacyData();
  if (action === "defer-cloud-migration") deferLegacyMigration();
  if (action === "open-create-task") openModal("task", null, element.dataset.projectId || null);
  if (action === "open-create-knowledge") openModal("knowledge", null, element.dataset.projectId || null);
  if (action === "open-create-decision") openModal("decision");
  if (action === "edit-project") openModal("project", id);
  if (action === "delete-project") {
    const project = projectById(id);
    if (project) {
      const projectName = project.name;
      openConfirmation({
        title: "删除项目",
        message: `删除项目「${projectName}」？关联任务、资料和决策会保留，并解除项目关联。`,
        confirmLabel: "删除项目",
        onConfirm: () => {
          db.projects = db.projects.filter((item) => item.id !== id);
          for (const collection of [db.tasks, db.knowledge, db.decisions]) {
            collection.forEach((item) => { if (item.projectId === id) item.projectId = ""; });
          }
          db.activities.forEach((activity) => { if (activity.projectId === id) activity.projectId = null; });
          logActivity("project-deleted", `删除项目「${projectName}」`);
          persist();
          go("projects");
          toast("项目已删除，关联记录已保留");
        },
      });
    }
  }
  if (action === "toggle-theme") {
    db.settings = { ...(db.settings || {}), theme: document.documentElement.dataset.theme === "light" ? "dark" : "light" };
    applyTheme();
    persist();
    render();
  }
  if (action === "edit-task") openModal("task", id);
  if (action === "delete-task") {
    const task = db.tasks.find((item) => item.id === id);
    if (task) {
      openConfirmation({
        title: "删除任务",
        message: `确定删除任务「${task.title}」吗？`,
        confirmLabel: "删除任务",
        onConfirm: () => {
          db.tasks = db.tasks.filter((item) => item.id !== id);
          persist(); render(); toast("任务已删除");
        },
      });
    }
  }
  if (action === "edit-knowledge") openModal("knowledge", id);
  if (action === "edit-decision") openModal("decision", id);
  if (action === "delete-decision") {
    const decision = db.decisions.find((item) => item.id === id);
    if (decision) {
      const question = decision.question;
      openConfirmation({
        title: "删除决策",
        message: `确定删除决策「${question}」吗？此操作无法撤销。`,
        confirmLabel: "删除决策",
        onConfirm: () => {
          db.decisions = db.decisions.filter((item) => item.id !== id);
          persist(); render(); toast("决策已删除");
        },
      });
    }
  }
  if (action === "view-project") go("project", id);
  if (action === "view-local-project") goLocalProject(id);
  if (action === "view-decision") { ui.expandedDecisionId = id; go("decisions"); }
  if (action === "toggle-decision") { ui.expandedDecisionId = ui.expandedDecisionId === id ? null : id; render(); }
  if (action === "open-search-result") handleSearchResult(element.dataset.kind, id);
  if (action === "dashboard-stat") {
    const page = element.dataset.targetPage;
    if (page === "projects") ui.projectFilter = element.dataset.filter || "all";
    if (page === "tasks") ui.taskFilter = element.dataset.filter || "all";
    if (page) go(page);
  }
  if (action === "filter-projects") { ui.projectFilter = element.dataset.filter || "all"; render(); }
  if (action === "filter-tasks") { ui.taskFilter = element.dataset.filter; render(); }
  if (action === "toggle-task") {
    const task = db.tasks.find((item) => item.id === id);
    if (task) {
      task.status = task.status === "done" ? "todo" : "done";
      task.updatedAt = new Date().toISOString();
      if (task.status === "done") logActivity("task-done", `完成任务「${task.title}」`, task.projectId || null);
      persist(); render(); toast(task.status === "done" ? "任务已完成" : "任务已重新打开");
    }
  }
  if (action === "delete-knowledge") {
    const item = db.knowledge.find((record) => record.id === id);
    if (item) {
      openConfirmation({
        title: "删除资料",
        message: `确定删除资料「${item.title}」吗？此操作无法撤销。`,
        confirmLabel: "删除资料",
        onConfirm: () => {
          db.knowledge = db.knowledge.filter((record) => record.id !== id);
          persist(); render(); toast("资料已删除");
        },
      });
    }
  }
  if (action === "close-modal" || action === "close-modal-backdrop") {
    if (action === "close-modal-backdrop" && element !== sourceEvent?.target) return;
    ui.modal = null; render();
  }
  if (action === "open-assistant") { ui.assistantOpen = true; render(); document.querySelector("#assistant-input")?.focus(); }
  if (action === "close-assistant") { ui.assistantOpen = false; render(); }
  if (action === "clear-chat") { ui.chat = [{ role: "assistant", text: "对话已清空。我会继续根据你当前打开的页面和本地数据回答。" }]; render(); }
  if (action === "send-prompt") sendChat(element.dataset.prompt || "");
  if (action === "retry-chat") {
    const requestId = element.dataset.id;
    const failed = ui.chat.find((item) => item.requestId === requestId && item.isError);
    const original = ui.chat.find((item) => item.requestId === requestId && item.role === "user");
    if (failed && original) {
      ui.chat = ui.chat.filter((item) => item.requestId !== requestId);
      sendChat(original.text);
    }
  }
  if (action === "refresh-github") refreshGitHubData(id || null);
  if (action === "refresh-home-github") refreshGitHubData(getHomePinnedProjects(db.projects).map((project) => project.id));
  if (action === "refresh-local-projects") refreshLocalProjects();
}

app.addEventListener("click", (event) => {
  const element = event.target.closest("[data-action], [data-page]");
  if (!element) return;
  if (element.dataset.page) {
    if (element.dataset.page === "projects") ui.projectFilter = "all";
    if (element.dataset.page === "tasks") ui.taskFilter = "all";
    go(element.dataset.page);
    return;
  }
  handleAction(element.dataset.action, element, event);
});

app.addEventListener("keydown", (event) => {
  const target = event.target.closest('[data-action="view-project"], [data-action="view-decision"], [data-action="toggle-decision"]');
  if (target && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); handleAction(target.dataset.action, target); }
  if (event.target.id === "assistant-input" && event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    if (!ui.chatBusy) sendChat(event.target.value);
  }
  if (event.target.id === "global-search" && event.key === "Enter") {
    event.preventDefault();
    const first = searchItems(ui.query)[0];
    if (first) handleSearchResult(first.kind, first.id);
  }
  if (event.key === "Escape") {
    if (ui.confirmation) { ui.confirmation = null; render(); }
    else if (ui.modal) { ui.modal = null; render(); }
    else if (ui.codex?.dialog) { ui.codex.dialog = ""; render(); }
    else if (ui.assistantOpen) { ui.assistantOpen = false; render(); }
    else if (ui.searchOpen) { ui.searchOpen = false; renderSearchResults(); }
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); document.querySelector("#global-search")?.focus(); }
});

app.addEventListener("input", (event) => {
  if (event.target.id === "project-next-step-draft" && ui.projectNextStep?.projectId === ui.projectId) {
    const state = ui.projectNextStep;
    state.suggestion = event.target.value.slice(0, 500);
    const section = event.target.closest(".project-next-step");
    const button = section?.querySelector('[data-action="adopt-project-next-step"]');
    if (button) {
      const unchanged = state.suggestion.trim() === state.adoptedText;
      const project = projectById(ui.projectId);
      const current = project ? projectNextStepContext(project, db.tasks.filter((task) => task.projectId === project.id)) : null;
      const stale = !current || current.contextKey !== state.contextKey;
      const cloudReady = cloudSyncEnabled && ui.cloud.status === "synced" && !cloudSyncRunning && !cloudSyncTimer && navigator.onLine !== false;
      button.disabled = state.busy || stale || !cloudReady || !state.suggestion.trim() || unchanged;
      button.textContent = state.adopted ? (unchanged ? "已采纳" : "采纳修改") : "采纳为下一步";
    }
  }
  if (event.target.id === "global-search") {
    ui.query = event.target.value;
    ui.searchOpen = true;
    renderSearchResults();
  }
  if (event.target.closest("#record-form")?.dataset.kind === "decision") {
    const form = event.target.closest("form");
    const values = Object.fromEntries(new FormData(form).entries());
    const recommendation = form.querySelector("#decision-recommendation");
    if (recommendation) recommendation.textContent = recommendationFor((values.options || "").split(/\r?\n/).map((value) => value.trim()), values.goal, values.risk);
  }
});

app.addEventListener("focusin", (event) => {
  if (event.target.id === "global-search") { ui.searchOpen = Boolean(ui.query.trim()); renderSearchResults(); }
});
app.addEventListener("focusout", (event) => {
  if (event.target.id === "global-search") setTimeout(() => { if (!document.activeElement?.closest("#search-results")) { ui.searchOpen = false; renderSearchResults(); } }, 160);
});

app.addEventListener("submit", (event) => {
  event.preventDefault();
  if (event.target.id === "record-form") {
    submitRecord(event.target);
  } else if (event.target.id === "assistant-form") {
    const input = event.target.elements.message;
    const message = input.value;
    input.value = "";
    sendChat(message);
  }
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); document.querySelector("#global-search")?.focus(); }
});

const initialLocalProjectRoute = location.hash.match(/^#local-project\/(.+)$/);
const initialProjectRoute = location.hash.match(/^#project\/(.+)$/);
if (initialLocalProjectRoute) {
  try {
    ui.page = "local-project";
    ui.localProjectId = decodeURIComponent(initialLocalProjectRoute[1]);
  } catch { /* Ignore malformed local routes. */ }
} else if (initialProjectRoute) {
  try {
    const id = decodeURIComponent(initialProjectRoute[1]);
    if (projectById(id)) { ui.page = "project"; ui.projectId = id; }
  } catch { /* Ignore malformed local routes. */ }
} else {
  const initialPage = location.hash.slice(1);
  if (["home", "projects", "knowledge", "decisions", "tasks"].includes(initialPage)) ui.page = initialPage;
}

render();
void initializeCloudSync();
if (localScanEndpoint) refreshLocalProjects();
