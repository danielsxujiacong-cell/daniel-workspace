import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createDemoData } from "../src/mock-data.js";
import { insertCloudProjects, getLocalMigrationCandidates, saveCloudChanges } from "../src/cloud/sync.js";
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
