import test from "node:test";
import assert from "node:assert/strict";
import { beginGitHubAppConnection } from "../src/github/private-api.js";

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
  assert.deepEqual(JSON.parse(request.init.body), {
    returnOrigin: "https://workspace.danielxu.cn",
    returnPath: "/?source=projects#projects",
  });
  assert.equal(new URL(browser.location.assignedUrl).pathname, "/login/oauth/authorize");
});

test("connect rejects redirects outside the GitHub OAuth endpoint", async (t) => {
  const browser = installBrowserMocks(t, "https://github.com/apps/different-app/installations/new");
  await assert.rejects(beginGitHubAppConnection(auth), /GitHub App 授权地址无效/);
  assert.equal(browser.location.assignedUrl, "");
});
