import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import worker from "../cloudflare/worker.js";

const origin = "https://workspace.danielxu.cn";
const uid = "9dd41e63-bdbd-405c-8243-ebe7de99fcf9";
const installationToken = "ghs_test_public_read_token_never_return_this";
const publicRepository = {
  full_name: "acme/workspace",
  private: false,
  visibility: "public",
  size: 5,
  html_url: "https://github.com/acme/workspace",
  default_branch: "main",
  updated_at: "2026-10-11T08:00:00Z",
  has_pages: false,
};

const envPromise = (async () => {
  const pair = await webcrypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const privateKey = await webcrypto.subtle.exportKey("pkcs8", pair.privateKey);
  return {
    ALLOWED_ORIGINS: origin,
    SUPABASE_URL: "https://auth.example.test",
    SUPABASE_ANON_KEY: "public-test-key",
    WORKSPACE_USER_ID: uid,
    GITHUB_APP_ID: "12345",
    GITHUB_APP_PRIVATE_KEY: `-----BEGIN PRIVATE KEY-----\n${Buffer.from(privateKey).toString("base64")}\n-----END PRIVATE KEY-----`,
  };
})();

function request(path, { method = "POST", body, token = "valid-session", from = origin } = {}) {
  return new Request(`https://worker.example${path}`, {
    method,
    headers: { Origin: from, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function publicCommit(sha, message, date) {
  return { sha, commit: { message, committer: { date }, author: { date } } };
}

async function withFetch(t, handler) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  t.after(() => { globalThis.fetch = original; });
}

test("public repository reads require the exact authenticated Workspace user", async (t) => {
  const env = await envPromise;
  const calls = [];
  await withFetch(t, async (input) => {
    calls.push(String(input));
    return String(input).includes("/auth/v1/user") ? Response.json({ id: "another-user" }) : new Response("unexpected", { status: 500 });
  });

  const response = await worker.fetch(request("/api/github/public-snapshots", { body: { repositories: [{ fullName: "acme/workspace" }] } }), env);
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error.code, "github_session_required");
  assert.equal(calls.filter((url) => url.includes("api.github.com")).length, 0);
});

test("the Worker reads public commits through its App token and never returns the token", async (t) => {
  const env = await envPromise;
  const calls = [];
  await withFetch(t, async (input, init = {}) => {
    const url = new URL(String(input));
    const headers = new Headers(init.headers);
    calls.push({ url, method: init.method || "GET", authorization: headers.get("Authorization"), userAgent: headers.get("User-Agent") });
    if (url.pathname === "/auth/v1/user") return Response.json({ id: uid });
    if (url.pathname === "/app/installations") return Response.json([{ id: 987654, app_id: 12345 }]);
    if (url.pathname.endsWith("/access_tokens")) return Response.json({ token: installationToken });
    if (url.pathname === "/repos/acme/workspace") return Response.json(publicRepository);
    if (url.pathname === "/repos/acme/workspace/commits") {
      return Response.json([publicCommit("abcdef0123456789abcdef0123456789abcdef01", "Latest public commit\nDetails", "2026-10-11T08:00:00Z")]);
    }
    return new Response("unexpected", { status: 500 });
  });

  const response = await worker.fetch(request("/api/github/public-snapshots", { body: { repositories: [{ fullName: "acme/workspace" }] } }), env);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.snapshots[0].latestCommit.message, "Latest public commit");
  assert.equal(payload.snapshots[0].latestCommit.sha, "abcdef0");
  assert.equal(payload.snapshots[0].defaultBranch, "main");
  assert.equal(payload.snapshots[0].isPublic, true);
  assert.equal(payload.snapshots[0].recentSevenDayCommitCount, 1);
  assert.deepEqual(payload.errors, []);
  assert.equal(JSON.stringify(payload).includes(installationToken), false);
  assert.ok(calls.filter(({ url }) => url.hostname === "api.github.com").every(({ method, url }) => method === "GET" || url.pathname.endsWith("/access_tokens")));
  assert.ok(calls.filter(({ url }) => url.pathname.startsWith("/repos/")).every(({ authorization }) => authorization === `Bearer ${installationToken}`));
  assert.ok(calls.filter(({ url }) => url.hostname === "api.github.com").every(({ userAgent }) => userAgent === "Daniel-Workspace-GitHub-App-Reader/3.5"));
});

test("a public repository unavailable to the App token falls back to anonymous Worker egress", async (t) => {
  const env = await envPromise;
  const calls = [];
  await withFetch(t, async (input, init = {}) => {
    const url = new URL(String(input));
    const authorization = new Headers(init.headers).get("Authorization");
    calls.push({ url, authorization });
    if (url.pathname === "/auth/v1/user") return Response.json({ id: uid });
    if (url.pathname === "/app/installations") return Response.json([{ id: 987654, app_id: 12345 }]);
    if (url.pathname.endsWith("/access_tokens")) return Response.json({ token: installationToken });
    if (url.pathname === "/repos/acme/workspace" && authorization) return Response.json({ message: "Not Found" }, { status: 404 });
    if (url.pathname === "/repos/acme/workspace") return Response.json(publicRepository);
    if (url.pathname === "/repos/acme/workspace/commits") return Response.json([]);
    return new Response("unexpected", { status: 500 });
  });

  const response = await worker.fetch(request("/api/github/public-snapshots", { body: { repositories: [{ fullName: "acme/workspace" }] } }), env);
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.snapshots[0].isPublic, true);
  assert.equal(calls.some(({ url, authorization }) => url.pathname === "/repos/acme/workspace" && authorization === null), true);
  assert.equal(JSON.stringify(payload).includes(installationToken), false);
});

test("the public route refuses private repositories before reading commits", async (t) => {
  const env = await envPromise;
  const calls = [];
  await withFetch(t, async (input, init = {}) => {
    const url = new URL(String(input));
    calls.push(url);
    if (url.pathname === "/auth/v1/user") return Response.json({ id: uid });
    if (url.pathname === "/app/installations") return Response.json([{ id: 987654, app_id: 12345 }]);
    if (url.pathname.endsWith("/access_tokens")) return Response.json({ token: installationToken });
    if (url.pathname === "/repos/acme/workspace") return Response.json({ ...publicRepository, private: true, visibility: "private" });
    return new Response("unexpected", { status: 500 });
  });

  const response = await worker.fetch(request("/api/github/public-snapshots", { body: { repositories: [{ fullName: "acme/workspace" }] } }), env);
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(payload.snapshots, []);
  assert.equal(payload.errors[0].httpStatus, 404);
  assert.equal(calls.some((url) => url.pathname.endsWith("/commits")), false);
  assert.equal(JSON.stringify(payload).includes(installationToken), false);
});

test("the public route preserves sanitized upstream HTTP diagnostics", async (t) => {
  const env = await envPromise;
  await withFetch(t, async (input, init = {}) => {
    const url = new URL(String(input));
    if (url.pathname === "/auth/v1/user") return Response.json({ id: uid });
    if (url.pathname === "/app/installations") return Response.json([{ id: 987654, app_id: 12345 }]);
    if (url.pathname.endsWith("/access_tokens")) return Response.json({ token: installationToken });
    return Response.json({ message: `API rate limit exceeded. Bearer ${installationToken}` }, { status: 403 });
  });

  const response = await worker.fetch(request("/api/github/public-snapshots", { body: { repositories: [{ fullName: "acme/workspace" }] } }), env);
  const payload = await response.json();
  assert.equal(payload.errors[0].httpStatus, 403);
  assert.match(payload.errors[0].message, /HTTP 403/);
  assert.equal(JSON.stringify(payload).includes(installationToken), false);
});
