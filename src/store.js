import { createDemoData } from "./mock-data.js";

const STORAGE_KEY = "daniel-workspace-v1";

export function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.version === 1 && Array.isArray(parsed.projects) && Array.isArray(parsed.tasks)) return parsed;
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

export function resetData() {
  const data = createDemoData();
  saveData(data);
  return data;
}
