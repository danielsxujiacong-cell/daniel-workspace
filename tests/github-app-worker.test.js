import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import worker from "../cloudflare/worker.js";

const origin = "https://workspace.danielxu.cn";
const uid = "9dd41e63-bdbd-405c-8243-ebe7de99fcf9";
const installationToken = "ghs_private_installation_token_for_test";
const b64 = (bytes) => Buffer.from(bytes).toString("base64");
const fromB64Url = (value) => Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");

async function testEnv() {
  const pair = await webcrypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const privateKey = await webcrypto.subtle.exportKey("pkcs8", pair.privateKey);
  const publicKey = await webcrypto.subtle.exportKey("spki", pair.publicKey);
  return {
    env: {
      ALLOWED_ORIGINS: origin,
      SUPABASE_URL: "https://auth.example.test",
      SUPABASE_ANON_KEY: "public-test-key",
      WORKSPACE_USER_ID: uid,
      GITHUB_APP_ID: "12345",
      GITHUB_APP_PRIVATE_KEY: `-----BEGIN PRIVATE KEY-----\n${b64(privateKey)}\n-----END PRIVATE KEY-----`,
    },
    publicKey,
  };
}

function req(path, { method = "GET", token = "valid-session", body } = {}) {
  return new Request(`https://worker.example${path}`, {
    method,
    headers: { Origin: origin, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function verifyAppJwt(jwt, publicKey) {
  const [headerPart, payloadPart, signaturePart] = jwt.split(".");
  const header = JSON.parse(fromB64Url(headerPart));
  const payload = JSON.parse(fromB64Url(payloadPart));
  return webcrypto.subtle.importKey("spki", publicKey, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"])
    .then((key) => webcrypto.subtle.verify("RSASSA-PKCS1-v1_5", key, fromB64Url(signaturePart), new TextEncoder().encode(`${headerPart}.${payloadPart}`)))
    .then((valid) => ({ header, payload, valid }));
}

test("GitHub App routes fail closed unless the validated Supabase user is the sole Workspace user", async () => {
  const { env } = await testEnv();
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return String(url).includes("/auth/v1/user") ? Response.json({ id: "another-user" }) : new Response("unexpected", { status: 500 });
  };
  try {
    const response = await worker.fetch(req("/api/github/repositories"), env);
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error.code, "github_session_required");
    assert.equal(calls.filter((url) => url.includes("api.github.com")).length, 0);
    const unset = { ...env, WORKSPACE_USER_ID: "" };
    const missingAllowlist = await worker.fetch(req("/api/github/repositories"), unset);
    assert.equal(missingAllowlist.status, 503);
  } finally { globalThis.fetch = originalFetch; }
});

test("installation-token reads list authorized private repositories and return the actual latest commit without exposing tokens", async () => {
  const { env, publicKey } = await testEnv();
  const originalFetch = globalThis.fetch;
  const calls = [];
  const privateRepos = ["acme/private-one", "acme/private-two", "acme/private-three"];
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, method: init.method || "GET", authorization: new Headers(init.headers).get("Authorization"), userAgent: new Headers(init.headers).get("User-Agent"), body: init.body });
    if (url.includes("/auth/v1/user")) return Response.json({ id: uid });
    if (url.includes("/app/installations?")) return Response.json([{ id: 987654, app_id: 12345 }]);
    if (url.includes("/access_tokens")) return Response.json({ token: installationToken });
    if (url.includes("/installation/repositories")) return Response.json({ repositories: privateRepos.map((fullName) => ({ full_name: fullName, name: fullName.split("/")[1], owner: { login: "acme" }, private: true, default_branch: "main", html_url: `https://github.com/${fullName}` })) });
    if (url.endsWith("/repos/acme/private-one")) return Response.json({ full_name: "acme/private-one", private: true, size: 2, default_branch: "main", pushed_at: "2026-10-11T08:00:00Z", html_url: "https://github.com/acme/private-one" });
    if (url.includes("/repos/acme/private-one/commits")) return Response.json([{ sha: "abcdef0123456789abcdef0123456789abcdef01", commit: { message: "Fix authenticated repository reads\nDetails", committer: { date: "2026-10-11T08:00:00Z" } } }]);
    return new Response("unexpected", { status: 500 });
  };
  try {
    const repositoriesResponse = await worker.fetch(req("/api/github/repositories"), env);
    assert.equal(repositoriesResponse.status, 200);
    const repositories = await repositoriesResponse.json();
    assert.deepEqual(repositories.repositories.map((repo) => repo.fullName), privateRepos);
    assert.equal(JSON.stringify(repositories).includes(installationToken), false);

    const appRequest = calls.find((call) => call.url.includes("/app/installations?"));
    assert.equal(appRequest.userAgent, "Daniel-Workspace-GitHub-App-Reader/3.5");
    const appJwt = appRequest.authorization.replace(/^Bearer\s+/i, "");
    const verified = await verifyAppJwt(appJwt, publicKey);
    assert.equal(verified.valid, true);
    assert.equal(verified.header.alg, "RS256");
    assert.equal(verified.payload.iss, "12345");
    const tokenRequest = calls.find((call) => call.url.includes("/access_tokens"));
    assert.equal(tokenRequest.method, "POST");
    assert.deepEqual(JSON.parse(tokenRequest.body), {});
    const repoList = calls.find((call) => call.url.includes("/installation/repositories"));
    assert.equal(repoList.authorization, `Bearer ${installationToken}`);

    const snapshotsResponse = await worker.fetch(req("/api/github/snapshots", { method: "POST", body: { repositories: [{ fullName: "acme/private-one" }] } }), env);
    assert.equal(snapshotsResponse.status, 200);
    const snapshots = await snapshotsResponse.json();
    assert.equal(snapshots.snapshots[0].latestCommit.message, "Fix authenticated repository reads");
    assert.equal(snapshots.snapshots[0].latestCommit.sha, "abcdef0");
    assert.equal(snapshots.snapshots[0].defaultBranch, "main");
    assert.equal(snapshots.snapshots[0].isPublic, false);
    assert.equal(JSON.stringify(snapshots).includes(installationToken), false);
    const writes = calls.filter((call) => ["PUT", "PATCH", "DELETE"].includes(call.method));
    assert.deepEqual(writes, []);
    assert.ok(calls.filter((call) => call.url.includes("api.github.com")).every((call) => call.method === "GET" || call.url.includes("/access_tokens")));
  } finally { globalThis.fetch = originalFetch; }
});

test("GitHub App installation and authorized repository inventories follow Link pagination without truncating the repo list", async () => {
  const { env } = await testEnv();
  const originalFetch = globalThis.fetch;
  const calls = [];
  const firstPage = Array.from({ length: 100 }, (_, index) => {
    const fullName = `acme/repo-${String(index + 1).padStart(3, "0")}`;
    return { full_name: fullName, name: fullName.split("/")[1], owner: { login: "acme" }, private: true, default_branch: "main", html_url: `https://github.com/${fullName}` };
  });
  const secondPage = ["repo-101", "repo-102"].map((name) => ({
    full_name: `acme/${name}`, name, owner: { login: "acme" }, private: true, default_branch: "main", html_url: `https://github.com/acme/${name}`,
  }));
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    calls.push(url);
    if (url.pathname === "/auth/v1/user") return Response.json({ id: uid });
    if (url.pathname === "/app/installations" && url.searchParams.get("page") === "1") {
      return Response.json([{ id: 111, app_id: 99999 }], { headers: { Link: '<https://api.github.com/app/installations?per_page=100&page=2>; rel="next"' } });
    }
    if (url.pathname === "/app/installations" && url.searchParams.get("page") === "2") return Response.json([{ id: 987654, app_id: 12345 }]);
    if (url.pathname.endsWith("/access_tokens")) return Response.json({ token: installationToken });
    if (url.pathname === "/installation/repositories" && url.searchParams.get("page") === "1") {
      return Response.json({ repositories: firstPage }, { headers: { Link: '<https://api.github.com/installation/repositories?per_page=100&page=2>; rel="next"' } });
    }
    if (url.pathname === "/installation/repositories" && url.searchParams.get("page") === "2") return Response.json({ repositories: secondPage });
    return new Response(`unexpected ${init.method || "GET"} ${url}`, { status: 500 });
  };
  try {
    const response = await worker.fetch(req("/api/github/repositories"), env);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.repositories.length, 102);
    assert.equal(payload.repositories.at(-1).fullName, "acme/repo-102");
    assert.deepEqual(calls.filter((url) => url.pathname === "/app/installations").map((url) => url.searchParams.get("page")), ["1", "2"]);
    assert.deepEqual(calls.filter((url) => url.pathname === "/installation/repositories").map((url) => url.searchParams.get("page")), ["1", "2"]);
  } finally { globalThis.fetch = originalFetch; }
});

test("GitHub activity reads every paginated branch and deduplicates full SHAs per repository", async () => {
  const { env } = await testEnv();
  const originalFetch = globalThis.fetch;
  const calls = [];
  const sharedSha = "a".repeat(40);
  const paginatedSha = "c".repeat(40);
  const featureSha = "b".repeat(40);
  const commit = (sha, date) => ({ sha, commit: { committer: { date } } });
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    calls.push({ url, method: init.method || "GET" });
    if (url.pathname === "/auth/v1/user") return Response.json({ id: uid });
    if (url.pathname === "/app/installations") return Response.json([{ id: 987654, app_id: 12345 }]);
    if (url.pathname.endsWith("/access_tokens")) return Response.json({ token: installationToken });
    if (url.pathname === "/installation/repositories") return Response.json({ repositories: [{
      full_name: "acme/private-one", name: "private-one", owner: { login: "acme" }, private: true,
      default_branch: "main", html_url: "https://github.com/acme/private-one",
    }] });
    if (url.pathname === "/repos/acme/private-one/branches" && url.searchParams.get("page") === "1") {
      return Response.json([{ name: "main" }], { headers: { Link: '<https://api.github.com/repos/acme/private-one/branches?per_page=100&page=2>; rel="next"' } });
    }
    if (url.pathname === "/repos/acme/private-one/branches" && url.searchParams.get("page") === "2") {
      return Response.json([{ name: "feature/activity" }]);
    }
    if (url.pathname === "/repos/acme/private-one/commits" && url.searchParams.get("sha") === "main" && url.searchParams.get("page") === "1") {
      const next = new URL(url);
      next.searchParams.set("page", "2");
      return Response.json([commit(sharedSha, "2026-10-11T08:00:00Z")], { headers: { Link: `<${next.href}>; rel="next"` } });
    }
    if (url.pathname === "/repos/acme/private-one/commits" && url.searchParams.get("sha") === "main" && url.searchParams.get("page") === "2") {
      return Response.json([commit(paginatedSha, "2026-10-10T08:00:00Z")]);
    }
    if (url.pathname === "/repos/acme/private-one/commits" && url.searchParams.get("sha") === "feature/activity") {
      return Response.json([
        commit(sharedSha, "2026-10-11T08:00:00Z"),
        commit(featureSha, "2026-10-12T08:00:00Z"),
      ]);
    }
    return new Response(`unexpected ${init.method || "GET"} ${url}`, { status: 500 });
  };
  try {
    const response = await worker.fetch(req("/api/github/activity", {
      method: "POST",
      body: { repositories: [{ fullName: "acme/private-one" }], startDate: "2026-10-10", endDate: "2026-10-12" },
    }), env);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.repositories[0].complete, true);
    assert.equal(payload.repositories[0].branchesRead, 2);
    assert.equal(payload.repositories[0].commitsCount, 3);
    assert.deepEqual(payload.repositories[0].dailyCounts, [
      { date: "2026-10-10", count: 1 },
      { date: "2026-10-11", count: 1 },
      { date: "2026-10-12", count: 1 },
    ]);
    assert.deepEqual(calls.filter(({ url }) => url.pathname.endsWith("/branches")).map(({ url }) => url.searchParams.get("page")), ["1", "2"]);
    assert.deepEqual(calls.filter(({ url }) => url.pathname.endsWith("/commits")).map(({ url }) => [url.searchParams.get("sha"), url.searchParams.get("page")]), [["main", "1"], ["main", "2"], ["feature/activity", "1"]]);
    assert.equal(Object.hasOwn(payload.repositories[0], "branchNames"), false);
  } finally { globalThis.fetch = originalFetch; }
});

test("GitHub activity reports branch-history permission failures separately from authorization gaps", async () => {
  const { env } = await testEnv();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname === "/auth/v1/user") return Response.json({ id: uid });
    if (url.pathname === "/app/installations") return Response.json([{ id: 987654, app_id: 12345 }]);
    if (url.pathname.endsWith("/access_tokens")) return Response.json({ token: installationToken });
    if (url.pathname === "/installation/repositories") return Response.json({ repositories: [{
      full_name: "acme/private-one", name: "private-one", owner: { login: "acme" }, private: true,
      default_branch: "main", html_url: "https://github.com/acme/private-one",
    }] });
    if (url.pathname === "/repos/acme/private-one/branches") return Response.json([{ name: "main" }]);
    if (url.pathname === "/repos/acme/private-one/commits") return Response.json({ message: "Resource not accessible by integration" }, { status: 403 });
    return new Response(`unexpected ${url}`, { status: 500 });
  };
  try {
    const response = await worker.fetch(req("/api/github/activity", {
      method: "POST",
      body: { repositories: [{ fullName: "acme/private-one" }], startDate: "2026-10-10", endDate: "2026-10-12" },
    }), env);
    const payload = await response.json();
    assert.equal(payload.errors[0].reasonCategory, "branch_commit_history_failed");
    assert.equal(payload.errors[0].operation, "GitHub branch commit history read (main)");
    assert.equal(payload.errors[0].httpStatus, 403);
  } finally { globalThis.fetch = originalFetch; }
});

test("GitHub activity reports a sanitized diagnostic when GitHub returns malformed branch JSON", async () => {
  const { env } = await testEnv();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname === "/auth/v1/user") return Response.json({ id: uid });
    if (url.pathname === "/app/installations") return Response.json([{ id: 987654, app_id: 12345 }]);
    if (url.pathname.endsWith("/access_tokens")) return Response.json({ token: installationToken });
    if (url.pathname === "/installation/repositories") return Response.json({ repositories: [{
      full_name: "acme/private-one", name: "private-one", owner: { login: "acme" }, private: true,
      default_branch: "main", html_url: "https://github.com/acme/private-one",
    }] });
    if (url.pathname === "/repos/acme/private-one/branches") return new Response("not-json github_pat_0123456789abcdefghijkl", { status: 200 });
    return new Response(`unexpected ${url}`, { status: 500 });
  };
  try {
    const response = await worker.fetch(req("/api/github/activity", {
      method: "POST",
      body: { repositories: [{ fullName: "acme/private-one" }], startDate: "2026-10-10", endDate: "2026-10-12" },
    }), env);
    const payload = await response.json();
    assert.equal(payload.errors[0].reasonCategory, "invalid_github_response");
    assert.equal(payload.errors[0].errorType, "SyntaxError");
    assert.match(payload.errors[0].diagnostic, /not-json|JSON/i);
    assert.equal(payload.errors[0].diagnostic.includes("github_pat_0123456789abcdefghijkl"), false);
    assert.equal(payload.errors[0].diagnostic.includes(installationToken), false);
  } finally { globalThis.fetch = originalFetch; }
});

test("GitHub activity explains Cloudflare single-invocation subrequest exhaustion", async () => {
  const { env } = await testEnv();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname === "/auth/v1/user") return Response.json({ id: uid });
    if (url.pathname === "/app/installations") return Response.json([{ id: 987654, app_id: 12345 }]);
    if (url.pathname.endsWith("/access_tokens")) return Response.json({ token: installationToken });
    if (url.pathname === "/installation/repositories") return Response.json({ repositories: [{
      full_name: "acme/private-one", name: "private-one", owner: { login: "acme" }, private: true, default_branch: "main",
    }] });
    if (url.pathname === "/repos/acme/private-one/branches") {
      throw new Error("Too many subrequests by single Worker invocation");
    }
    return new Response(`unexpected ${url}`, { status: 500 });
  };
  try {
    const response = await worker.fetch(req("/api/github/activity", {
      method: "POST",
      body: { repositories: [{ fullName: "acme/private-one" }], startDate: "2026-10-10", endDate: "2026-10-12" },
    }), env);
    const payload = await response.json();
    assert.equal(payload.errors[0].reasonCategory, "worker_subrequest_limit");
    assert.equal(payload.errors[0].code, "github_worker_subrequest_limit");
    assert.match(payload.errors[0].message, /缩小批次/);
  } finally { globalThis.fetch = originalFetch; }
});

test("GitHub activity identifies upstream rate limits while reading branch lists", async () => {
  const { env } = await testEnv();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname === "/auth/v1/user") return Response.json({ id: uid });
    if (url.pathname === "/app/installations") return Response.json([{ id: 987654, app_id: 12345 }]);
    if (url.pathname.endsWith("/access_tokens")) return Response.json({ token: installationToken });
    if (url.pathname === "/installation/repositories") return Response.json({ repositories: [{
      full_name: "acme/private-one", name: "private-one", owner: { login: "acme" }, private: true,
      default_branch: "main", html_url: "https://github.com/acme/private-one",
    }] });
    if (url.pathname === "/repos/acme/private-one/branches") return Response.json({ message: "API rate limit exceeded" }, {
      status: 403,
      headers: { "X-RateLimit-Remaining": "0", "X-RateLimit-Reset": String(Math.ceil(Date.now() / 1000) + 600) },
    });
    return new Response(`unexpected ${url}`, { status: 500 });
  };
  try {
    const response = await worker.fetch(req("/api/github/activity", {
      method: "POST",
      body: { repositories: [{ fullName: "acme/private-one" }], startDate: "2026-10-10", endDate: "2026-10-12" },
    }), env);
    const payload = await response.json();
    assert.equal(payload.errors[0].reasonCategory, "rate_limited");
    assert.equal(payload.errors[0].httpStatus, 403);
    assert.equal(payload.errors[0].operation, "GitHub branch list read");
  } finally { globalThis.fetch = originalFetch; }
});

test("GitHub activity marks inaccessible repositories outside the App installation as ambiguous private-or-missing", async () => {
  const { env } = await testEnv();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname === "/auth/v1/user") return Response.json({ id: uid });
    if (url.pathname === "/app/installations") return Response.json([{ id: 987654, app_id: 12345 }]);
    if (url.pathname.endsWith("/access_tokens")) return Response.json({ token: installationToken });
    if (url.pathname === "/installation/repositories") return Response.json({ repositories: [] });
    if (url.pathname === "/repos/acme/private-missing") return Response.json({ message: "Not Found" }, { status: 404 });
    return new Response(`unexpected ${url}`, { status: 500 });
  };
  try {
    const response = await worker.fetch(req("/api/github/activity", {
      method: "POST",
      body: { repositories: [{ fullName: "acme/private-missing" }], startDate: "2026-10-10", endDate: "2026-10-12" },
    }), env);
    const payload = await response.json();
    assert.equal(payload.errors[0].reasonCategory, "private_or_missing_outside_app_scope");
    assert.match(payload.errors[0].message, /私有仓库、已删除仓库或仓库名不匹配/);
    assert.equal(payload.errors[0].httpStatus, 404);
  } finally { globalThis.fetch = originalFetch; }
});

test("GitHub activity uses an existing installation token for public repositories outside its repository list", async () => {
  const { env } = await testEnv();
  const originalFetch = globalThis.fetch;
  const publicReadAuthorizations = [];
  const sha = "d".repeat(40);
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const authorization = new Headers(init.headers).get("Authorization");
    if (url.pathname === "/auth/v1/user") return Response.json({ id: uid });
    if (url.pathname === "/app/installations") return Response.json([{ id: 987654, app_id: 12345 }]);
    if (url.pathname.endsWith("/access_tokens")) return Response.json({ token: installationToken });
    if (url.pathname === "/installation/repositories") return Response.json({ repositories: [{
      full_name: "acme/private-one", name: "private-one", owner: { login: "acme" }, private: true,
      default_branch: "main", html_url: "https://github.com/acme/private-one",
    }] });
    if (["/repos/acme/public-one", "/repos/acme/public-one/branches", "/repos/acme/public-one/commits"].includes(url.pathname)) {
      publicReadAuthorizations.push(authorization);
    }
    if (url.pathname === "/repos/acme/public-one") return Response.json({ full_name: "acme/public-one", private: false });
    if (url.pathname === "/repos/acme/public-one/branches") return Response.json([{ name: "main" }]);
    if (url.pathname === "/repos/acme/public-one/commits") return Response.json([{ sha, commit: { committer: { date: "2026-10-12T08:00:00Z" } } }]);
    return new Response(`unexpected ${url}`, { status: 500 });
  };
  try {
    const response = await worker.fetch(req("/api/github/activity", {
      method: "POST",
      body: { repositories: [{ fullName: "acme/public-one" }], startDate: "2026-10-12", endDate: "2026-10-12" },
    }), env);
    const payload = await response.json();
    assert.equal(payload.repositories[0].complete, true);
    assert.equal(payload.repositories[0].commitsCount, 1);
    assert.deepEqual(publicReadAuthorizations, [
      `Bearer ${installationToken}`,
      `Bearer ${installationToken}`,
      `Bearer ${installationToken}`,
    ]);
  } finally { globalThis.fetch = originalFetch; }
});

test("GitHub activity preserves an authenticated rate-limit error instead of retrying anonymously", async () => {
  const { env } = await testEnv();
  const originalFetch = globalThis.fetch;
  const publicReadAuthorizations = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const authorization = new Headers(init.headers).get("Authorization");
    if (url.pathname === "/auth/v1/user") return Response.json({ id: uid });
    if (url.pathname === "/app/installations") return Response.json([{ id: 987654, app_id: 12345 }]);
    if (url.pathname.endsWith("/access_tokens")) return Response.json({ token: installationToken });
    if (url.pathname === "/installation/repositories") return Response.json({ repositories: [] });
    if (url.pathname === "/repos/acme/public-one") {
      publicReadAuthorizations.push(authorization);
      return Response.json({ message: "API rate limit exceeded" }, {
        status: 403,
        headers: { "X-RateLimit-Remaining": "0", "X-RateLimit-Reset": String(Math.ceil(Date.now() / 1000) + 600) },
      });
    }
    return new Response(`unexpected ${url}`, { status: 500 });
  };
  try {
    const response = await worker.fetch(req("/api/github/activity", {
      method: "POST",
      body: { repositories: [{ fullName: "acme/public-one" }], startDate: "2026-10-12", endDate: "2026-10-12" },
    }), env);
    const payload = await response.json();
    assert.equal(payload.errors[0].reasonCategory, "rate_limited");
    assert.ok(publicReadAuthorizations.length >= 1);
    assert.ok(publicReadAuthorizations.every((authorization) => authorization === `Bearer ${installationToken}`));
  } finally { globalThis.fetch = originalFetch; }
});

test("GitHub upstream HTTP failures are reported with a redacted status and message", async () => {
  const { env } = await testEnv();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    if (String(input).includes("/auth/v1/user")) return Response.json({ id: uid });
    return Response.json({ message: "Resource not accessible by integration: Bearer ghs_secret_value_never_return_this" }, { status: 403 });
  };
  try {
    const response = await worker.fetch(req("/api/github/repositories"), env);
    assert.equal(response.status, 502);
    const payload = await response.json();
    assert.equal(payload.error.httpStatus, 403);
    assert.match(payload.error.message, /GitHub App installation lookup HTTP 403/);
    assert.equal(JSON.stringify(payload).includes("ghs_secret_value"), false);
  } finally { globalThis.fetch = originalFetch; }
});

test("only GitHub App installations and repository reads are used; OAuth callback routes are gone", async () => {
  const { env } = await testEnv();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => String(url).includes("/auth/v1/user") ? Response.json({ id: uid }) : new Response("unexpected", { status: 500 });
  try {
    const response = await worker.fetch(req("/api/github/oauth/callback?code=unused"), env);
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error.code, "not_found");
  } finally { globalThis.fetch = originalFetch; }
});
