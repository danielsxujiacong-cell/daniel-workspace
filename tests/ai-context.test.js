import assert from "node:assert/strict";
import test from "node:test";
import { buildAssistantContext } from "../src/ai/context.js";

const project = {
  id: "cloud-project-1",
  name: "Daniel Workspace",
  status: "进行中",
  stage: "V3.1-B",
  next: "验证云端读取",
  description: "真实云端项目",
};

function workspaceData(projects = []) {
  return { projects, tasks: [], knowledge: [], decisions: [], activities: [] };
}

test("home assistant context accepts cloud recentProjects as project records", () => {
  const result = buildAssistantContext({
    data: workspaceData([project]),
    currentPage: "home",
    dashboardModel: { source: "cloud", recentProjects: [project] },
  });

  assert.equal(result.relevantContext.dashboard.recentlyActiveProjects[0].name, "Daniel Workspace");
  assert.equal(result.relevantContext.dashboard.recentlyActiveProjects[0].status, "进行中");
});

test("home assistant context retains local recentProjects wrapper records", () => {
  const localProject = { id: "local-1", name: "本机项目", hasGit: true };
  const result = buildAssistantContext({
    data: workspaceData(),
    currentPage: "home",
    localProjects: [localProject],
    dashboardModel: { source: "local", recentProjects: [{ item: localProject, project: null }] },
  });

  assert.equal(result.relevantContext.dashboard.recentlyActiveProjects[0].name, "本机项目");
  assert.equal(result.relevantContext.dashboard.recentlyActiveProjects[0].status, "本地项目");
});
