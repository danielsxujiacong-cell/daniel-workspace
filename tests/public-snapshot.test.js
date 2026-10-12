import assert from "node:assert/strict";
import test from "node:test";
import worker from "../cloudflare/worker.js";
import {
  buildPublishableSnapshot,
  createSnapshotReviewDraft,
  validatePublicSnapshot,
} from "../src/public-snapshot.js";

const origin = "https://workspace.danielxu.cn";

function snapshotFixture() {
  return {
    schemaVersion: 1,
    generatedAt: "2026-10-12T02:00:00.000Z",
    activity: {
      startDate: "2025-10-13",
      endDate: "2026-10-12",
      githubDailyCounts: [{ date: "2026-10-01", count: 3 }],
      githubRepositoryCount: 1,
      githubComplete: true,
      workLogsComplete: true,
    },
    projects: [{ id: "project-001", name: "Reviewed project", description: "Public summary", status: "进行中", stage: "MVP", next: "Ship", url: "https://example.com/demo", github: "", notes: "", isPinned: true }],
    tasks: [],
    workLogs: [{ id: "work-log-0001", projectId: "project-001", workDate: "2025-01-01", completedItems: "Older reviewed entry", outcomes: "", nextStep: "" }],
    knowledge: [],
    decisions: [],
    summaries: { dailyBrief: "", weeklySummary: "" },
    publishedAt: "",
  };
}

function request(path, { method = "GET", requestOrigin = origin, token = "", body, ip = crypto.randomUUID() } = {}) {
  return new Request(`https://worker.example${path}`, {
    method,
    headers: {
      Origin: requestOrigin,
      "CF-Connecting-IP": ip,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

function testEnv({ storedSnapshot = null } = {}) {
  const writes = [];
  const env = {
    ALLOWED_ORIGINS: origin,
    SUPABASE_URL: "https://auth.example.test",
    SUPABASE_ANON_KEY: "test-publishable-key",
    WORKSPACE_USER_ID: "owner-user-id",
    PUBLIC_WORKSPACE_SNAPSHOTS: {
      async get(key, type) { assert.equal(key, "latest"); assert.equal(type, "json"); return storedSnapshot; },
      async put(key, value, options) { writes.push({ key, value, options }); storedSnapshot = JSON.parse(value); },
    },
  };
  return { env, writes, getSnapshot: () => storedSnapshot };
}

function draftWithSensitiveSources() {
  return createSnapshotReviewDraft({
    now: "2026-10-12T02:00:00.000Z",
    activityRange: { startDate: "2025-10-13", endDate: "2026-10-12" },
    data: {
      projects: [{
        id: "private-project-id",
        name: "Reviewed Workspace",
        description: "Contact owner@example.com; token ghp_012345678901234567890123; local C:\\Users\\Daniel\\secret.",
        status: "进行中",
        stage: "MVP",
        next: "Ship the reviewed demo",
        url: "https://example.com/demo",
        github: "https://github.com/acme/public-demo",
        notes: "Private Drive https://drive.google.com/private-doc",
        path: "D:\\Private\\Project",
        isPinned: true,
      }],
      tasks: [{ id: "private-task-id", title: "Review the release", description: "Details at https://linear.app/private", projectId: "private-project-id", status: "todo", priority: "中", due: "" }],
      knowledge: [],
      decisions: [],
    },
    workLogs: [{ id: "private-log-id", projectId: "private-project-id", workDate: "2025-01-01", completedItems: "Reviewed release notes", outcomes: "Done", nextStep: "Publish", evidenceLinks: ["https://drive.google.com/evidence"] }],
    publicRepositories: [{ repositoryName: "acme/public-demo", isPublic: true }],
    githubActivity: {
      repositories: [{ fullName: "acme/public-demo", complete: true, dailyCounts: [{ date: "2026-10-01", count: 3 }] }],
      complete: true,
      workLogsComplete: true,
    },
  });
}

test("snapshot draft is whitelist-only, redacts private values, and stays unchecked until reviewed", () => {
  const draft = draftWithSensitiveSources();
  const project = draft.collections.projects[0];
  const task = draft.collections.tasks[0];
  const workLog = draft.collections.workLogs[0];
  assert.equal(project.include, false);
  assert.equal(task.include, false);
  assert.equal(workLog.include, false);
  assert.equal(project.fields.url, "https://example.com/demo");
  assert.equal(project.fields.github, "https://github.com/acme/public-demo");
  assert.match(project.fields.description, /\[邮箱已隐藏\]/);
  assert.match(project.fields.description, /\[密钥已隐藏\]/);
  assert.match(project.fields.description, /\[本机路径已隐藏\]/);
  assert.doesNotMatch(project.fields.notes, /drive\.google\.com/);
  assert.doesNotMatch(task.fields.description, /linear\.app/);
  assert.equal(workLog.fields.evidenceLinkCount, 1);
  assert.equal(JSON.stringify(draft).includes("private-project-id"), true, "raw IDs stay only in the owner-side review draft");

  project.sensitiveAcknowledged = true;
  project.include = true;
  task.sensitiveAcknowledged = true;
  task.include = true;
  workLog.sensitiveAcknowledged = true;
  workLog.include = true;
  draft.collections.githubActivity[0].include = true;
  const snapshot = buildPublishableSnapshot(draft);
  assert.equal(validatePublicSnapshot(snapshot), true);
  assert.equal(JSON.stringify(snapshot).includes("private-project-id"), false);
  assert.equal(JSON.stringify(snapshot).includes("private-task-id"), false);
  assert.equal(JSON.stringify(snapshot).includes("drive.google.com"), false);
  assert.equal(snapshot.workLogs[0].workDate, "2025-01-01", "older reviewed logs remain available in the full history");
  assert.equal(snapshot.activity.githubDailyCounts[0].count, 3);
});

test("public GET reads only the isolated KV snapshot and returns 404 until one is published", async () => {
  const empty = testEnv();
  const missing = await worker.fetch(request("/api/public/snapshot"), empty.env);
  assert.equal(missing.status, 404);
  assert.equal(empty.writes.length, 0);

  const populated = testEnv({ storedSnapshot: snapshotFixture() });
  const response = await worker.fetch(request("/api/public/snapshot"), populated.env);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("Cache-Control"), /public/);
  assert.equal((await response.json()).projects.length, 1);
  assert.equal(populated.writes.length, 0);
});

test("snapshot publish requires the configured owner, validates the payload, and leaves old data on rejection", async () => {
  const state = testEnv({ storedSnapshot: snapshotFixture() });
  const originalFetch = globalThis.fetch;
  const seenAuth = [];
  globalThis.fetch = async (input, init = {}) => {
    assert.equal(new URL(String(input)).pathname, "/auth/v1/user");
    seenAuth.push(new Headers(init.headers).get("Authorization"));
    return Response.json({ id: seenAuth.at(-1) === "Bearer owner-token" ? "owner-user-id" : "someone-else" });
  };
  try {
    const noAuth = await worker.fetch(request("/api/public/snapshot", { method: "POST", body: snapshotFixture() }), state.env);
    assert.equal(noAuth.status, 401);
    const wrongUser = await worker.fetch(request("/api/public/snapshot", { method: "POST", token: "other-token", body: snapshotFixture() }), state.env);
    assert.equal(wrongUser.status, 401);
    assert.equal(state.writes.length, 0);

    const owner = await worker.fetch(request("/api/public/snapshot", { method: "POST", token: "owner-token", body: snapshotFixture() }), state.env);
    assert.equal(owner.status, 200);
    assert.equal(state.writes.length, 1);
    assert.equal(state.writes[0].key, "latest");
    assert.equal(state.writes[0].options.metadata.schemaVersion, 1);
    assert.equal((await owner.json()).counts.projects, 1);

    const oldSnapshot = state.getSnapshot();
    const unsafe = snapshotFixture();
    unsafe.projects[0].notes = "Private details https://drive.google.com/doc";
    const rejected = await worker.fetch(request("/api/public/snapshot", { method: "POST", token: "owner-token", body: unsafe }), state.env);
    assert.equal(rejected.status, 400);
    assert.equal(state.getSnapshot(), oldSnapshot);
    assert.equal(state.writes.length, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test("the visitor shell starts the shared app before snapshot fetch settles and never imports private storage or AI modules", async () => {
  const gate = await (await import("node:fs/promises")).readFile(new URL("../src/auth/gate.js", import.meta.url), "utf8");
  const app = await (await import("node:fs/promises")).readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const publicStart = gate.slice(gate.indexOf("async function startPublicDashboard"), gate.indexOf("function startPrivateEntry"));
  assert.ok(publicStart.indexOf("await import(\"../app.js?v=3.8-c\")") < publicStart.indexOf("void snapshotPromise.then"));
  assert.doesNotMatch(publicStart, /await\s+snapshotPromise/);
  assert.match(publicStart, /void snapshotPromise\.then/);
  assert.match(app, /publicSnapshotMode \? \{\} : await import\("\.\/store\.js"\)/);
  assert.match(app, /publicSnapshotMode \? \{\} : await import\("\.\/ai\/service\.js/);
  assert.match(app, /publicSnapshotMode \? \{\} : await import\("\.\/cloud\/sync\.js"\)/);
  assert.match(app, /function enforcePublicReadOnlyDom\(\)/);
  assert.doesNotMatch(gate, /public-dashboard\.js/);
});
