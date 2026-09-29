import { createDemoData } from "./mock-data.js";

const STORAGE_KEY = "daniel-workspace-v1";

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
          if (project.github !== "https://github.com") continue;
          if (project.id === "project-workspace") {
            project.github = "https://github.com/danielsxujiacong-cell/daniel-workspace";
            migratedDemoGithubLinks = true;
          } else if (["project-reading", "project-weekly-review"].includes(project.id)) {
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

export function resetData(settings = {}) {
  const data = createDemoData();
  data.settings = { ...data.settings, ...settings };
  saveData(data);
  return data;
}
