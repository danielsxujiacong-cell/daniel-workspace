import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createDemoData } from "../src/mock-data.js";
import { insertCloudProjects, getLocalMigrationCandidates, preserveDeviceOnlyData, saveCloudChanges } from "../src/cloud/sync.js";
import { resetData } from "../src/store.js";

const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");

function createTrackedClient() {
  const calls = [];
  return {
    calls,
    from(table) {
      calls.push({ operation: "from", table });
      return {
        upsert(rows) { calls.push({ operation: "upsert", table, rows }); return Promise.resolve({ error: null }); },
        delete() { calls.push({ operation: "delete", table }); return this; },
        eq() { return this; },
        in() { return Promise.resolve({ error: null }); },
      };
    },
  };
}

test("private Workspace has no demo reset entry or handler", () => {
  assert.doesNotMatch(app, /resetData|data-action="reset-demo"|action === "reset-demo"/);
});

test("the shared private data store refuses demo resets without touching storage", () => {
  assert.throws(() => resetData(), /cannot reset demo data/);
});

test("cloud sync rejects demo fixtures in every table before any Supabase write or delete", async () => {
  const client = createTrackedClient();
  const baseline = { projects: [], tasks: [], knowledge: [], decisions: [] };
  const demo = createDemoData();

  for (const kind of Object.keys(baseline)) {
    const workspace = { projects: [], tasks: [], knowledge: [], decisions: [] };
    workspace[kind] = demo[kind];
    await assert.rejects(saveCloudChanges(client, "user-1", workspace, baseline), /Mock demo records/);
    assert.deepEqual(client.calls, []);
  }
});

test("cached reconnect trusts the fresh cloud snapshot and does not replay stale cache", async () => {
  const restoreBranch = app.match(/if \(cloudCacheActive && cloudBaseline\) \{([\s\S]*?)\n\s*\}/)?.[1] || "";
  assert.match(restoreBranch, /activateCloudWorkspace\(remote, db\)/);
  assert.doesNotMatch(restoreBranch, /mergePendingCloudChanges|syncCloudNow/);

  const demo = createDemoData();
  const remote = {
    projects: Array.from({ length: 29 }, (_, index) => ({
      id: `cloud-project-${index}`,
      name: `Cloud project ${index}`,
      description: "",
      status: "进行中",
      stage: "",
      next: "",
      github: "",
      url: "",
      notes: "",
      createdAt: "2026-10-01T00:00:00.000Z",
      isPinned: index < 3,
    })),
    tasks: [{ id: "cloud-task", title: "云端任务", projectId: "cloud-project-0", status: "todo", priority: "中", due: "", createdAt: "2026-10-01T00:00:00.000Z" }],
    knowledge: [{ id: "cloud-note", type: "笔记", title: "云端资料", content: "", summary: "", tags: [], projectId: "", createdAt: "2026-10-01T00:00:00.000Z" }],
    decisions: [{ id: "cloud-decision", question: "云端决策", options: [], goal: "", time: "", cost: "", risk: "", recommendation: "", final: "", reason: "", projectId: "", createdAt: "2026-10-01T00:00:00.000Z" }],
  };
  const staleCache = {
    projects: [...remote.projects.map((project) => ({ ...project, name: "旧缓存名称", isPinned: false })), ...demo.projects.slice(0, 3)],
    tasks: [...remote.tasks, ...demo.tasks.slice(0, 2)],
    knowledge: [...remote.knowledge, ...demo.knowledge.slice(0, 2)],
    decisions: [...remote.decisions, ...demo.decisions.slice(0, 2)],
  };
  const restored = preserveDeviceOnlyData(remote, staleCache);
  assert.deepEqual(restored.projects.map((project) => project.id), remote.projects.map((project) => project.id));
  assert.equal(restored.projects[0].name, remote.projects[0].name);
  assert.equal(restored.projects[0].isPinned, true);
  assert.deepEqual(restored.tasks, remote.tasks);
  assert.deepEqual(restored.knowledge, remote.knowledge);
  assert.deepEqual(restored.decisions, remote.decisions);

  const calls = [];
  const client = { from: (table) => ({
    upsert: (rows) => { calls.push({ operation: "upsert", table, rows }); return Promise.resolve({ error: null }); },
    delete: () => { calls.push({ operation: "delete", table }); return { eq() { return this; }, in: async () => ({ error: null }) }; },
  }) };
  await saveCloudChanges(client, "user-1", restored, remote);
  assert.deepEqual(calls, []);
});

test("project insertion rejects fixture IDs and migration excludes altered fixture IDs", async () => {
  const demo = createDemoData();
  const fixtureId = demo.projects[0].id;
  const client = createTrackedClient();

  await assert.rejects(insertCloudProjects(client, "user-1", demo.projects), /Mock demo records/);
  assert.deepEqual(client.calls, []);

  demo.projects[0].name = "Edited mock project";
  const candidates = getLocalMigrationCandidates(demo);
  assert.equal(candidates.projects.some((item) => item.id === fixtureId), false);
});
