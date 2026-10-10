import test from "node:test";
import assert from "node:assert/strict";
import {
  countPinnedProjects,
  getHomePinnedProjects,
  MAX_HOME_PROJECT_PINS,
  MIN_HOME_PROJECT_PINS,
  toggleProjectPin,
} from "../src/project-pinning.js";
import { checkProjectPinningSupport, loadCloudWorkspace, mergePendingCloudChanges, saveCloudChanges, setCloudProjectPinned } from "../src/cloud/sync.js";

function projects(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `project-${index + 1}`,
    name: `项目 ${String(index + 1).padStart(2, "0")}`,
    isPinned: index < count,
  }));
}

test("Home waits for three pins and never displays more than five", () => {
  assert.equal(MIN_HOME_PROJECT_PINS, 3);
  assert.equal(MAX_HOME_PROJECT_PINS, 5);
  assert.deepEqual(getHomePinnedProjects(projects(2)), []);
  assert.equal(getHomePinnedProjects(projects(3)).length, 3);
  assert.equal(getHomePinnedProjects(projects(7)).length, 5);
});

test("pin toggle caps new pins at five while allowing unpin", () => {
  const items = projects(6).map((item, index) => ({ ...item, isPinned: index < 5 }));
  const capped = toggleProjectPin(items, "project-6");
  assert.equal(capped.changed, false);
  assert.equal(capped.reason, "limit");
  assert.equal(countPinnedProjects(capped.projects), 5);

  const unpinned = toggleProjectPin(items, "project-1");
  assert.equal(unpinned.changed, true);
  assert.equal(unpinned.isPinned, false);
  assert.equal(countPinnedProjects(unpinned.projects), 4);
});

test("pin schema probe distinguishes an unapplied additive migration", async () => {
  const client = { from: () => ({ select: () => ({ limit: async () => ({ error: { code: "PGRST204", message: "is_pinned missing" } }) }) }) };
  assert.equal(await checkProjectPinningSupport(client), false);
});

test("cloud load reads pin state when the additive column is present", async () => {
  const projectRow = { id: "p1", user_id: "u1", name: "真实项目", is_pinned: true };
  const client = {
    from(table) {
      return {
        select(columns) {
          return {
            limit: async () => ({ error: null }),
            eq: async (_column, userId) => ({
              error: null,
              data: table === "workspace_projects" && columns === "*" && userId === "u1" ? [projectRow] : [],
            }),
          };
        },
      };
    },
  };
  const result = await loadCloudWorkspace(client, "u1");
  assert.equal(result.projectPinningAvailable, true);
  assert.equal(result.data.projects[0].isPinned, true);
  assert.equal(result.baseline.projects[0].isPinned, true);
});

test("pending edits to other project fields retain a remote pin change", () => {
  const result = mergePendingCloudChanges(
    { projects: [{ id: "p1", name: "项目", stage: "云端阶段", isPinned: true }], tasks: [], knowledge: [], decisions: [] },
    { projects: [{ id: "p1", name: "项目", stage: "本机阶段", isPinned: false }], tasks: [], knowledge: [], decisions: [] },
    { projects: [{ id: "p1", name: "项目", stage: "旧阶段", isPinned: false }], tasks: [], knowledge: [], decisions: [] },
  );

  assert.equal(result.projects[0].stage, "本机阶段");
  assert.equal(result.projects[0].isPinned, true);
});

test("bulk project sync leaves the dedicated pin field untouched", async () => {
  const writes = [];
  const client = {
    from(table) {
      return {
        upsert: async (rows) => { writes.push({ table, rows }); return { error: null }; },
      };
    },
  };
  const workspace = { projects: [{ id: "p1", name: "项目", stage: "新阶段", isPinned: true }], tasks: [], knowledge: [], decisions: [] };
  const baseline = { projects: [{ id: "p1", name: "项目", stage: "旧阶段", isPinned: false }], tasks: [], knowledge: [], decisions: [] };

  await saveCloudChanges(client, "u1", workspace, baseline);

  assert.equal(writes.length, 1);
  assert.equal(writes[0].table, "workspace_projects");
  assert.equal(writes[0].rows[0].stage, "新阶段");
  assert.equal(Object.hasOwn(writes[0].rows[0], "is_pinned"), false);
});

test("pin-only changes do not trigger a bulk project upsert", async () => {
  const writes = [];
  const client = {
    from(table) {
      return {
        upsert: async (rows) => { writes.push({ table, rows }); return { error: null }; },
      };
    },
  };
  const workspace = { projects: [{ id: "p1", name: "项目", isPinned: true }], tasks: [], knowledge: [], decisions: [] };
  const baseline = { projects: [{ id: "p1", name: "项目", isPinned: false }], tasks: [], knowledge: [], decisions: [] };

  await saveCloudChanges(client, "u1", workspace, baseline);

  assert.deepEqual(writes, []);
});

test("pin update changes only the scoped pin field", async () => {
  const calls = [];
  const query = {
    update: (value) => { calls.push(["update", value]); return query; },
    eq: (column, value) => { calls.push(["eq", column, value]); return query; },
    select: (columns) => { calls.push(["select", columns]); return query; },
    maybeSingle: async () => ({ data: { id: "p1" }, error: null }),
  };
  const client = { from: (table) => { calls.push(["from", table]); return query; } };

  await setCloudProjectPinned(client, "u1", "p1", true);

  assert.deepEqual(calls, [
    ["from", "workspace_projects"],
    ["update", { is_pinned: true }],
    ["eq", "user_id", "u1"],
    ["eq", "id", "p1"],
    ["select", "id"],
  ]);
});
