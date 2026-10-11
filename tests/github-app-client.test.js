import test from "node:test";
import assert from "node:assert/strict";
import { beginGitHubAppConnection, fetchPrivateGitHubSnapshots, listPrivateGitHubRepositories } from "../src/github/private-api.js";

function installBrowserMocks(t, responseUrl) {
  const originalFetch = globalThis.fetch;
  const originalLocation = globalThis.location;
  let request;
  const location = {
    origin: "https://workspace.danielxu.cn",
    pathname: "/",
    search: "?source=projects",
    hash: "#projects",
    assignedUrl: "",
    assign(url) { this.assignedUrl = url; },
  };
  globalThis.location = location;
  globalThis.fetch = async (url, init) => {
    request = { url: String(url), init };
    return Response.json({ url: responseUrl });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalLocation === undefined) delete globalThis.location;
    else globalThis.location = originalLocation;
  });
  return { location, getRequest: () => request };
}

const auth = { client: { auth: { getSession: async () => ({ data: { session: { access_token: "workspace-session" } }, error: null }) } } };

test("connect starts OAuth and preserves the current Workspace route", async (t) => {
  const browser = installBrowserMocks(t, "https://github.com/login/oauth/authorize?client_id=app-client&state=signed-state");
  await beginGitHubAppConnection(auth);
  const request = browser.getRequest();
  assert.equal(request.url, "https://daniel-workspace-api.ai-investment-dashboard.workers.dev/api/github/connect");
  assert.equal(request.init.headers.Authorization, "Bearer workspace-session");
  assert.equal(request.init.credentials, "omit");
  assert.equal(request.init.headers.Cookie, undefined);
  assert.deepEqual(JSON.parse(request.init.body), {
    returnOrigin: "https://workspace.danielxu.cn",
    returnPath: "/?source=projects#projects",
  });
  assert.equal(new URL(browser.location.assignedUrl).pathname, "/login/oauth/authorize");
});

test("private repository listing retries transient KV misses after GitHub OAuth", async (t) => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  const waits = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    if (calls.length < 4) return Response.json({ error: { code: "github_not_connected", message: "not propagated yet" } }, { status: 404 });
    return Response.json({ repositories: [{ fullName: "acme/private-workspace" }] });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const result = await listPrivateGitHubRepositories(auth, {
    retryOnNotConnected: true,
    waitBeforeRetry: async (ms) => waits.push(ms),
  });

  assert.equal(result.repositories[0].fullName, "acme/private-workspace");
  assert.equal(calls.length, 4);
  assert.deepEqual(waits, [500, 1_000, 2_000]);
});

test("private repository listing does not retry authorization or upstream errors", async (t) => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return Response.json({ error: { code: "github_session_required", message: "session required" } }, { status: 401 });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  await assert.rejects(listPrivateGitHubRepositories(auth, {
    retryOnNotConnected: true,
    waitBeforeRetry: async () => assert.fail("unexpected retry"),
  }), (error) => error.code === "github_session_required");
  assert.equal(calls, 1);
});

test("private snapshot reads also retry a transient installation lookup miss", async (t) => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  const waits = [];
  globalThis.fetch = async (url, init) => {
    requests.push({ url: String(url), init });
    return requests.length === 1
      ? Response.json({ error: { code: "github_not_connected", message: "not propagated yet" } }, { status: 404 })
      : Response.json({ snapshots: [{ fullName: "acme/private-workspace" }] });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const result = await fetchPrivateGitHubSnapshots(auth, [{ fullName: "acme/private-workspace" }], {
    retryOnNotConnected: true,
    waitBeforeRetry: async (ms) => waits.push(ms),
  });

  assert.equal(result.snapshots[0].fullName, "acme/private-workspace");
  assert.equal(requests.length, 2);
  assert.equal(requests[0].init.method, "POST");
  assert.deepEqual(JSON.parse(requests[0].init.body), { repositories: [{ fullName: "acme/private-workspace" }] });
  assert.deepEqual(waits, [500]);
});

test("connect rejects redirects outside the GitHub OAuth endpoint", async (t) => {
  const browser = installBrowserMocks(t, "https://github.com/apps/different-app/installations/new");
  await assert.rejects(beginGitHubAppConnection(auth), /GitHub App 授权地址无效/);
  assert.equal(browser.location.assignedUrl, "");
});
