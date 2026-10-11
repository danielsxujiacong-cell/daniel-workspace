import test from "node:test";
import assert from "node:assert/strict";
import { fetchPrivateGitHubSnapshots, listPrivateGitHubRepositories } from "../src/github/private-api.js";

const auth = { client: { auth: { getSession: async () => ({ data: { session: { access_token: "workspace-session" } }, error: null }) } } };

function installFetch(t, response) {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, init) => {
    request = { url: String(url), init };
    return response;
  };
  t.after(() => { globalThis.fetch = originalFetch; });
  return () => request;
}

test("private repository reads use only the authenticated Workspace session and omit cookies", async (t) => {
  const getRequest = installFetch(t, Response.json({ repositories: [{ fullName: "acme/private-workspace" }] }));
  const result = await listPrivateGitHubRepositories(auth);
  const request = getRequest();
  assert.equal(result.repositories[0].fullName, "acme/private-workspace");
  assert.equal(request.url, "https://daniel-workspace-api.ai-investment-dashboard.workers.dev/api/github/repositories");
  assert.equal(request.init.headers.Authorization, "Bearer workspace-session");
  assert.equal(request.init.credentials, "omit");
  assert.equal(request.init.headers.Cookie, undefined);
});

test("private snapshot requests contain only selected repository names and preserve Worker HTTP diagnostics", async (t) => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, init) => {
    request = { url: String(url), init };
    return Response.json({ error: { code: "github_upstream_error", message: "GitHub API HTTP 403: Resource not accessible by integration", httpStatus: 403 } }, { status: 502 });
  };
  t.after(() => { globalThis.fetch = originalFetch; });
  await assert.rejects(fetchPrivateGitHubSnapshots(auth, [{ fullName: "acme/private-workspace" }]), (error) => error.code === "github_upstream_error" && error.upstreamStatus === 403 && error.message.includes("HTTP 403"));
  assert.equal(request.init.method, "POST");
  assert.deepEqual(JSON.parse(request.init.body), { repositories: [{ fullName: "acme/private-workspace" }] });
  assert.equal(request.init.credentials, "omit");
});

test("an absent Supabase session prevents all private GitHub calls", async () => {
  const noSession = { client: { auth: { getSession: async () => ({ data: { session: null }, error: null }) } } };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => assert.fail("Worker must not be called without an authenticated session");
  try { await assert.rejects(listPrivateGitHubRepositories(noSession), /Supabase 登录已失效/); }
  finally { globalThis.fetch = originalFetch; }
});
