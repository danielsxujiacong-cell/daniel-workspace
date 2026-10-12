import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import worker from "../cloudflare/worker.js";
import { resolveActivityRange } from "../src/home-activity.js";
import { sanitizePublicActivity } from "../src/public-dashboard.js";

const origin = "https://workspace.danielxu.cn";
const installationToken = "ghs_public_dashboard_test_token_never_return_this";

async function configuredWorkerEnv() {
  const pair = await webcrypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const privateKey = await webcrypto.subtle.exportKey("pkcs8", pair.privateKey);
  const encoded = Buffer.from(privateKey).toString("base64");
  return {
    ALLOWED_ORIGINS: origin,
    SUPABASE_URL: "https://auth.example.test",
    SUPABASE_ANON_KEY: "public-test-key",
    WORKSPACE_USER_ID: "workspace-owner-id",
    GITHUB_APP_ID: "12345",
    GITHUB_APP_PRIVATE_KEY: `-----BEGIN PRIVATE KEY-----\n${encoded}\n-----END PRIVATE KEY-----`,
  };
}

function request(path, { method = "GET", requestOrigin = origin, ip = "198.51.100.7" } = {}) {
  return new Request(`https://worker.example${path}`, {
    method,
    headers: { Origin: requestOrigin, "CF-Connecting-IP": ip },
  });
}

test("public activity sanitizer accepts only the fixed public repo IDs, 30 Shanghai dates, and bounded counts", () => {
  const now = new Date("2026-10-12T02:00:00.000Z");
  const period = resolveActivityRange("30d", { now });
  const payload = {
    period: { startDate: period.startDate, endDate: period.endDate },
    repositories: [
      { projectId: "workspace", complete: true, dailyCounts: [{ date: period.endDate, count: 2 }, { date: period.endDate, count: 1_000_001 }] },
      { projectId: "portfolio", complete: false, dailyCounts: [{ date: period.startDate, count: 5 }, { date: "2025-01-01", count: 99 }] },
      { projectId: "investment-dashboard", complete: true, dailyCounts: [{ date: period.endDate, count: 1 }] },
      { projectId: "private-n8n-repo", complete: true, dailyCounts: [{ date: period.endDate, count: 80 }] },
    ],
  };

  const model = sanitizePublicActivity(payload, now);
  assert.equal(model.complete, false);
  assert.equal(model.days.length, 30);
  assert.equal(model.commits, 8);
  assert.equal(model.activeDays, 2);
  assert.equal(model.days.at(-1).commits, 3);
  assert.deepEqual(model.days.at(-1).repositories.map((item) => item.id), ["workspace", "investment-dashboard"]);
  assert.equal(model.days[0].commits, 5);
});

test("public activity rejects an unexpected date period instead of showing it as a current snapshot", () => {
  assert.equal(sanitizePublicActivity({ period: { startDate: "2020-01-01", endDate: "2020-01-30" }, repositories: [] }, new Date("2026-10-12T02:00:00Z")), null);
});

test("public dashboard endpoint reads only its three hardcoded public repositories without auth or row data", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  const now = new Date().toISOString();
  const repositories = [
    "danielsxujiacong-cell/daniel-workspace",
    "danielsxujiacong-cell/personal-portfolio",
    "danielsxujiacong-cell/AI-investment-dashboard",
  ];
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    calls.push({ url: String(input), method: init.method || "GET", authorization: new Headers(init.headers).get("Authorization") });
    const repo = repositories.find((name) => url.pathname === `/repos/${name}` || url.pathname.startsWith(`/repos/${name}/commits`));
    if (!repo) return new Response("unexpected request", { status: 500 });
    if (url.pathname.endsWith("/commits")) {
      return Response.json([{ sha: "abcdef0123456789abcdef0123456789abcdef01", commit: { committer: { date: now } } }]);
    }
    return Response.json({ full_name: repo, private: false });
  };

  try {
    const response = await worker.fetch(request("/api/public/dashboard", { ip: "198.51.100.21" }), { ALLOWED_ORIGINS: origin });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("Cache-Control"), /public, max-age=300/);
    const payload = await response.json();
    assert.equal(payload.repositories.length, 3);
    assert.deepEqual(payload.repositories.map((item) => item.projectId).sort(), ["investment-dashboard", "portfolio", "workspace"]);
    assert.ok(payload.repositories.every((item) => item.complete && item.dailyCounts.length === 1));
    assert.equal(JSON.stringify(payload).includes("sha"), false);
    assert.equal(JSON.stringify(payload).includes("private-n8n"), false);
    assert.equal(calls.length, 6);
    assert.ok(calls.every((call) => call.method === "GET" && call.authorization === null));
    assert.ok(calls.every((call) => call.url.startsWith("https://api.github.com/repos/")));
  } finally { globalThis.fetch = originalFetch; }
});

test("public Dashboard reads only fixed allowlisted repos and verifies each is public before reading commits", async () => {
  const env = await configuredWorkerEnv();
  const originalFetch = globalThis.fetch;
  const calls = [];
  const publicRepos = [
    "danielsxujiacong-cell/daniel-workspace",
    "danielsxujiacong-cell/personal-portfolio",
    "danielsxujiacong-cell/AI-investment-dashboard",
  ];
  const now = new Date().toISOString();
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const method = init.method || "GET";
    const authorization = new Headers(init.headers).get("Authorization");
    calls.push({ url: String(input), method, authorization, body: init.body });
    if (url.pathname === "/app/installations") return Response.json([{ id: 987654, app_id: 12345 }]);
    if (url.pathname.endsWith("/access_tokens")) return Response.json({ token: installationToken });
    if (url.pathname.endsWith("/access_tokens")) return Response.json({ token: installationToken });
    const repository = publicRepos.find((name) => url.pathname === `/repos/${name}` || url.pathname === `/repos/${name}/commits`);
    if (repository && authorization === `Bearer ${installationToken}` && url.pathname === `/repos/${repository}`) {
      return Response.json({ full_name: repository, private: false });
    }
    if (repository && authorization === `Bearer ${installationToken}` && url.pathname === `/repos/${repository}/commits`) {
      return Response.json([{ sha: "abcdef0123456789abcdef0123456789abcdef01", commit: { committer: { date: now } } }]);
    }
    return new Response("unexpected request", { status: 500 });
  };
  try {
    const response = await worker.fetch(request("/api/public/dashboard", { ip: "198.51.100.24" }), env);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.repositories.length, 3);
    assert.ok(payload.repositories.every((item) => item.complete && item.dailyCounts.length === 1));
    assert.equal(JSON.stringify(payload).includes(installationToken), false);
    assert.equal(JSON.stringify(payload).includes("private-project"), false);
    const repositoryReads = calls.filter((call) => call.url.includes("/repos/"));
    assert.equal(repositoryReads.length, 6);
    assert.ok(repositoryReads.every((call) => call.method === "GET" && call.authorization === `Bearer ${installationToken}`));
    assert.equal(calls.some((call) => call.url.includes("/installation/repositories")), false);
    const scopedTokens = calls.filter((call) => call.url.endsWith("/access_tokens"));
    assert.equal(scopedTokens.length, 1);
    assert.deepEqual(JSON.parse(scopedTokens[0].body), {});
  } finally { globalThis.fetch = originalFetch; }
});

test("public endpoint never requests commit history until a repository is confirmed public", async () => {
  const originalFetch = globalThis.fetch;
  const requestedPaths = [];
  const privateName = "danielsxujiacong-cell/personal-portfolio";
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    requestedPaths.push(url.pathname);
    const repository = [
      "danielsxujiacong-cell/daniel-workspace",
      privateName,
      "danielsxujiacong-cell/AI-investment-dashboard",
    ].find((name) => url.pathname === `/repos/${name}` || url.pathname === `/repos/${name}/commits`);
    if (!repository) return new Response("unexpected request", { status: 500 });
    if (url.pathname.endsWith("/commits")) return Response.json([]);
    return Response.json({ full_name: repository, private: repository === privateName });
  };
  try {
    const response = await worker.fetch(request("/api/public/dashboard", { ip: "198.51.100.25" }), { ALLOWED_ORIGINS: origin });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.repositories.find((item) => item.projectId === "portfolio").complete, false);
    assert.equal(requestedPaths.includes(`/repos/${privateName}/commits`), false);
    assert.equal(requestedPaths.filter((path) => path.endsWith("/commits")).length, 2);
  } finally { globalThis.fetch = originalFetch; }
});

test("public endpoint rejects writes and unapproved origins before contacting GitHub", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return Response.json({}); };
  try {
    const env = { ALLOWED_ORIGINS: origin };
    const write = await worker.fetch(request("/api/public/dashboard", { method: "POST", ip: "198.51.100.22" }), env);
    assert.equal(write.status, 405);
    const denied = await worker.fetch(request("/api/public/dashboard", { requestOrigin: "https://attacker.example", ip: "198.51.100.23" }), env);
    assert.equal(denied.status, 403);
    assert.equal(calls, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test("default public page imports no private Workspace modules and shares the authenticated dashboard layout", async () => {
  const publicPage = await readFile(new URL("../src/public-dashboard.js", import.meta.url), "utf8");
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const gate = await readFile(new URL("../src/auth/gate.js", import.meta.url), "utf8");
  const layout = await readFile(new URL("../src/dashboard-layout.js", import.meta.url), "utf8");
  assert.doesNotMatch(publicPage, /(?:src\/app\.js|store\.js|auth\/config|supabase-js|localStorage|sessionStorage|\/api\/chat|\/api\/github\/activity|local_companion|action_runner)/i);
  assert.match(publicPage, /\/api\/public\/dashboard/);
  assert.match(publicPage, /credentials: "omit"/);
  assert.match(app, /import\("\.\/dashboard-layout\.js\?v=3\.8-a"\)/);
  assert.match(layout, /class="dashboard-home"><div class="dashboard-grid"/);
  assert.match(gate, /startPublicDashboard\(entryMode === "default"\)/);
  assert.match(gate, /import\("\.\.\/app\.js\?v=3\.8-a"\)/);
  assert.match(gate, /if \(!isAllowedUser\(user\)\) throw new Error\("Unauthorized user"\)/);
});
