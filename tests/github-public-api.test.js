import test from "node:test";
import assert from "node:assert/strict";
import {
  GITHUB_ACTIVITY_WINDOW_MS,
  GITHUB_CACHE_TTL_MS,
  fetchPublicGitHubRepositories,
  fetchPublicGitHubRepository,
  isGitHubSnapshotFresh,
  parsePublicGitHubRepository,
} from "../src/github/public-api.js";

const now = Date.parse("2026-10-10T12:00:00.000Z");
const auth = { client: { auth: { getSession: async () => ({ data: { session: { access_token: "workspace-session" } }, error: null }) } } };

function stubFetch(t, handler) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  t.after(() => { globalThis.fetch = original; });
}

const snapshot = {
  repositoryName: "acme/workspace",
  repositoryUrl: "https://github.com/acme/workspace",
  defaultBranch: "main",
  updatedAt: "2026-10-10T11:00:00.000Z",
  latestCommit: {
    sha: "abcdef0",
    message: "最新摘要",
    url: "https://github.com/acme/workspace/commit/abcdef0123456789abcdef0123456789abcdef01",
    committedAt: "2026-10-10T11:00:00.000Z",
  },
  recentCommits: [],
  recentSevenDayCommitCount: 101,
  pagesUrl: "",
  isPublic: true,
  refreshedAt: new Date(now).toISOString(),
};

test("parses only GitHub HTTPS repository URLs", () => {
  assert.equal(parsePublicGitHubRepository("https://github.com/acme/workspace.git")?.fullName, "acme/workspace");
  assert.equal(parsePublicGitHubRepository("http://github.com/acme/workspace"), null);
  assert.equal(parsePublicGitHubRepository("https://notgithub.com/acme/workspace"), null);
});

test("sends public repository reads through the authenticated Worker, never the phone/browser GitHub API", async (t) => {
  const requests = [];
  stubFetch(t, async (url, options) => {
    requests.push({ url: new URL(url), options });
    return Response.json({ snapshots: [snapshot], errors: [] });
  });

  const result = await fetchPublicGitHubRepositories([
    "https://github.com/acme/workspace",
    "https://github.com/acme/workspace.git",
  ], auth);

  assert.equal(requests.length, 1);
  const [{ url, options }] = requests;
  assert.equal(url.origin, "https://daniel-workspace-api.ai-investment-dashboard.workers.dev");
  assert.equal(url.pathname, "/api/github/public-snapshots");
  assert.equal(url.origin === "https://api.github.com", false);
  assert.equal(options.method, "POST");
  assert.equal(options.headers.Authorization, "Bearer workspace-session");
  assert.equal(options.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(options.body), { repositories: [{ fullName: "acme/workspace" }] });
  assert.equal(options.credentials, "omit");
  assert.equal(options.cache, "no-store");
  assert.equal(options.referrerPolicy, "no-referrer");
  assert.deepEqual(result.snapshots, [snapshot]);
  assert.equal(result.errors.length, 0);
});

test("surfaces a sanitized upstream HTTP status from the Worker", async (t) => {
  stubFetch(t, async () => Response.json({
    snapshots: [],
    errors: [{ fullName: "acme/workspace", code: "github_upstream_error", httpStatus: 403, message: "GitHub public repository metadata read HTTP 403: rate limit exceeded" }],
  }));

  await assert.rejects(
    fetchPublicGitHubRepository("https://github.com/acme/workspace", { auth }),
    (error) => error.status === 403 && error.upstreamStatus === 403 && /HTTP 403/.test(error.message),
  );
});

test("preserves the one-hour snapshot cache boundary", () => {
  assert.equal(GITHUB_CACHE_TTL_MS, 60 * 60 * 1000);
  assert.equal(GITHUB_ACTIVITY_WINDOW_MS, 7 * 24 * 60 * 60 * 1000);
  const fresh = (refreshedAt) => ({ refreshedAt, recentSevenDayCommitCount: 0 });
  assert.equal(isGitHubSnapshotFresh(fresh(new Date(now - GITHUB_CACHE_TTL_MS + 1).toISOString()), now), true);
  assert.equal(isGitHubSnapshotFresh(fresh(new Date(now - GITHUB_CACHE_TTL_MS).toISOString()), now), false);
  assert.equal(isGitHubSnapshotFresh(fresh(new Date(now + 1).toISOString()), now), false);
  assert.equal(isGitHubSnapshotFresh(fresh("invalid"), now), false);
  assert.equal(isGitHubSnapshotFresh({ refreshedAt: new Date(now).toISOString() }, now), false);
});
