import { createDemoData } from "./mock-data.js";

const STORAGE_KEY = "daniel-workspace-v1";
const LOCAL_SCAN_BASELINE_KEY = "daniel-workspace-local-scan-baseline-v1";
const LOCAL_SCAN_CACHE_KEY = "daniel-workspace-local-scan-cache-v1";
const CLOUD_CACHE_KEY = "daniel-workspace-cloud-cache-v1";
const CLOUD_MIGRATION_KEY = "daniel-workspace-v2.6-migration-v1";

export function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.version === 1 && Array.isArray(parsed.projects) && Array.isArray(parsed.tasks)) {
        const settings = parsed.settings && typeof parsed.settings === "object" && !Array.isArray(parsed.settings) ? parsed.settings : {};
        parsed.settings = { ...settings, theme: ["system", "light", "dark"].includes(settings.theme) ? settings.theme : "system" };
        let migratedDemoGithubLinks = false;
        for (const project of parsed.projects) {
          if (project.github === "https://github.com" && ["project-workspace", "project-reading", "project-weekly-review"].includes(project.id)) {
            project.github = "";
            migratedDemoGithubLinks = true;
          }
        }
        if (migratedDemoGithubLinks) saveData(parsed);
        return parsed;
      }
    }
  } catch (error) {
    console.warn("Workspace data could not be read; loading the demo data.", error);
  }
  const data = createDemoData();
  saveData(data);
  return data;
}

export function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function loadCloudCache(userId) {
  try {
    const raw = localStorage.getItem(CLOUD_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (cached?.version !== 1 || cached.userId !== userId || !cached.data || !cached.baseline) return null;
    return cached;
  } catch {
    return null;
  }
}

export function saveCloudCache(userId, data, baseline, lastSyncedAt = "") {
  try {
    localStorage.setItem(CLOUD_CACHE_KEY, JSON.stringify({ version: 1, userId, data, baseline, lastSyncedAt }));
    return true;
  } catch {
    return false;
  }
}

export function loadCloudMigrationState(userId) {
  try {
    const states = JSON.parse(localStorage.getItem(CLOUD_MIGRATION_KEY) || "{}");
    const state = states?.[userId];
    return state && typeof state === "object" ? state : { approved: false, completed: false };
  } catch {
    return { approved: false, completed: false };
  }
}

export function saveCloudMigrationState(userId, state) {
  try {
    const states = JSON.parse(localStorage.getItem(CLOUD_MIGRATION_KEY) || "{}");
    states[userId] = { ...state, updatedAt: new Date().toISOString() };
    localStorage.setItem(CLOUD_MIGRATION_KEY, JSON.stringify(states));
    return true;
  } catch {
    return false;
  }
}

export function loadLocalScanBaseline() {
  try {
    const raw = localStorage.getItem(LOCAL_SCAN_BASELINE_KEY);
    if (!raw) return { baseline: null, readable: true };
    const baseline = JSON.parse(raw);
    if (baseline?.version !== 1 || !Array.isArray(baseline.items)) return { baseline: null, readable: true };
    return { baseline, readable: true };
  } catch {
    return { baseline: null, readable: false };
  }
}

export function saveLocalScanBaseline(baseline) {
  try {
    localStorage.setItem(LOCAL_SCAN_BASELINE_KEY, JSON.stringify(baseline));
    return true;
  } catch {
    return false;
  }
}

export function loadLocalScanCache() {
  try {
    const raw = localStorage.getItem(LOCAL_SCAN_CACHE_KEY);
    if (!raw) return { inventory: null, readable: true };
    const cached = JSON.parse(raw);
    const inventory = cached?.version === 1 ? cached.inventory : null;
    if (!inventory || !Array.isArray(inventory.items) || typeof inventory.scannedAt !== "string") {
      return { inventory: null, readable: true };
    }
    return { inventory, readable: true };
  } catch {
    return { inventory: null, readable: false };
  }
}

export function saveLocalScanCache(inventory) {
  try {
    localStorage.setItem(LOCAL_SCAN_CACHE_KEY, JSON.stringify({ version: 1, inventory }));
    return true;
  } catch {
    return false;
  }
}

export function resetData() {
  throw new Error("The shared Workspace store cannot reset demo data.");
}
