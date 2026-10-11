import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import worker from "../cloudflare/worker.js";

const origin = "https://workspace.danielxu.cn";
const uid = "9dd41e63-bdbd-405c-8243-ebe7de99fcf9";
const store = new Map();
const b64 = (bytes) => Buffer.from(bytes).toString("base64");

async function testEnv() {
  const pair = await webcrypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const privateKey = await webcrypto.subtle.exportKey("pkcs8", pair.privateKey);
  return {
    ALLOWED_ORIGINS: origin,
    SUPABASE_URL: "https://auth.example.test",
    SUPABASE_ANON_KEY: "public-test-key",
    GITHUB_APP_ID: "12345",
    GITHUB_APP_SLUG: "daniel-workspace-readonly",
    GITHUB_CLIENT_ID: "Iv1.testclient",
    GITHUB_CLIENT_SECRET: "test-client-secret",
    GITHUB_APP_PRIVATE_KEY: `-----BEGIN PRIVATE KEY-----\n${b64(privateKey)}\n-----END PRIVATE KEY-----`,
    GITHUB_STATE_SECRET: "test-state-secret-with-enough-entropy-for-hmac",
    WORKSPACE_USER_ID: uid,
    GITHUB_INSTALLATIONS: {
      get: async (key) => store.get(key) || null,
      put: async (key, value) => store.set(key, value),
      delete: async (key) => store.delete(key),
    },
  };
}

function req(path, { method = "GET", token = "valid-session", body } = {}) {
  return new Request(`https://worker.example${path}`, {
    method,
    headers: { Origin: origin, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}

test("GitHub App routes require configured service and a validated Supabase user", async () => {
  const response = await worker.fetch(req("/api/github/status"), { ALLOWED_ORIGINS: origin });
  assert.equal(response.status, 503);
  const env = await testEnv();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => String(url).includes("/auth/v1/user") ? new Response("{}", { status: 401 }) : new Response("unexpected", { status: 500 });
  try {
    const unauthorized = await worker.fetch(req("/api/github/status"), env);
    assert.equal(unauthorized.status, 401);
    assert.equal((await unauthorized.json()).error.code, "github_session_required");
  } finally { globalThis.fetch = originalFetch; }
});

test("GitHub installation cannot be bound to Workspace unless the signed-in GitHub user can access it", async () => {
  const env = await testEnv();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("/auth/v1/user")) return Response.json({ id: uid });
    if (url === "https://github.com/login/oauth/access_token") return Response.json({ access_token: "one-time-user-token" });
    if (url.includes("/user/installations")) return Response.json({ installations: [{ id: 111111, app_id: 12345 }] });
    return new Response("unexpected", { status: 500 });
  };
  try {
    const connect = await worker.fetch(req("/api/github/connect", { method: "POST", body: { returnOrigin: origin } }), env);
    const installUrl = new URL((await connect.json()).url);
    const setup = await worker.fetch(new Request(`https://worker.example/api/github/callback?setup_action=install&installation_id=987654&state=${encodeURIComponent(installUrl.searchParams.get("state"))}`), env);
    const oauthUrl = new URL(setup.headers.get("Location"));
    const verification = await worker.fetch(new Request(`https://worker.example/api/github/oauth/callback?code=one-time-code&state=${encodeURIComponent(oauthUrl.searchParams.get("state"))}`), env);
    assert.equal(verification.status, 403);
    assert.equal(await env.GITHUB_INSTALLATIONS.get(`user:${uid}`), null);
  } finally { globalThis.fetch = originalFetch; }
});

test("GitHub App authorization stores installation per user and reads repository metadata only", async () => {
  const env = await testEnv();
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, method: init.method || "GET" });
    if (url.includes("/auth/v1/user")) return Response.json({ id: uid });
    if (url === "https://github.com/login/oauth/access_token") return Response.json({ access_token: "one-time-user-token" });
    if (url.includes("/user/installations")) return Response.json({ installations: [{ id: 987654, app_id: 12345 }] });
    if (url.includes("/access_tokens")) return Response.json({ token: "short-lived-install-token" });
    if (url.includes("/installation/repositories")) return Response.json({ repositories: [{ full_name: "acme/private-workspace", name: "private-workspace", owner: { login: "acme" }, private: true, default_branch: "main", html_url: "https://github.com/acme/private-workspace" }] });
    if (url.endsWith("/repos/acme/private-workspace")) return Response.json({ full_name: "acme/private-workspace", private: true, default_branch: "main", pushed_at: "2026-10-11T08:00:00Z", html_url: "https://github.com/acme/private-workspace" });
    if (url.includes("/repos/acme/private-workspace/commits")) return Response.json([{ sha: "abcdef0123456789", commit: { message: "Improve private dashboard", committer: { date: "2026-10-11T08:00:00Z" } } }]);
    return new Response("unexpected", { status: 500 });
  };
  try {
    const connect = await worker.fetch(req("/api/github/connect", { method: "POST", body: { returnOrigin: origin, returnPath: "/daniel-workspace/#home" } }), env);
    assert.equal(connect.status, 200);
    const installUrl = new URL((await connect.json()).url);
    assert.equal(installUrl.origin, "https://github.com");
    assert.equal(installUrl.pathname, "/apps/daniel-workspace-readonly/installations/new");
    const payloadPart = installUrl.searchParams.get("state").split(".")[0];
    const payload = JSON.parse(Buffer.from(payloadPart.replace(/-/g, "+").replace(/_/g, "/"), "base64url").toString());
    assert.equal(await env.GITHUB_INSTALLATIONS.get(`state:${payload.nonce}`), uid);
    const setup = await worker.fetch(new Request(`https://worker.example/api/github/callback?setup_action=install&installation_id=987654&state=${encodeURIComponent(installUrl.searchParams.get("state"))}`), env);
    assert.equal(setup.status, 302);
    const authorizeUrl = new URL(setup.headers.get("Location"));
    assert.equal(authorizeUrl.origin, "https://github.com");
    assert.equal(authorizeUrl.pathname, "/login/oauth/authorize");
    const oauthCallback = await worker.fetch(new Request(`https://worker.example/api/github/oauth/callback?code=one-time-code&state=${encodeURIComponent(authorizeUrl.searchParams.get("state"))}`), env);
    assert.equal(oauthCallback.status, 302);
    assert.equal(new URL(oauthCallback.headers.get("Location")).origin, origin);
    assert.equal(await env.GITHUB_INSTALLATIONS.get(`user:${uid}`), "987654");

    const repos = await worker.fetch(req("/api/github/repositories"), env);
    assert.equal(repos.status, 200);
    assert.deepEqual((await repos.json()).repositories.map((repo) => repo.fullName), ["acme/private-workspace"]);
    const snapshots = await worker.fetch(req("/api/github/snapshots", { method: "POST", body: { repositories: [{ fullName: "acme/private-workspace" }] } }), env);
    assert.equal(snapshots.status, 200);
    const item = (await snapshots.json()).snapshots[0];
    assert.equal(item.source, "github-app");
    assert.equal(item.isPublic, false);
    assert.equal(item.defaultBranch, "main");
    assert.equal(item.latestCommit.message, "Improve private dashboard");
    assert.equal(item.recentSevenDayCommitCount, 1);
    assert.ok(calls.every((call) => call.method !== "PUT" && call.method !== "PATCH" && call.method !== "DELETE"));
  } finally { globalThis.fetch = originalFetch; }
});
