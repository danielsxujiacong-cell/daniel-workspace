import test from "node:test";
import assert from "node:assert/strict";
import {
  GITHUB_ACTIVITY_WINDOW_MS,
  GITHUB_CACHE_TTL_MS,
  fetchPublicGitHubRepository,
  isGitHubSnapshotFresh,
  parsePublicGitHubRepository,
} from "../src/github/public-api.js";

const now = Date.parse("2026-10-10T12:00:00.000Z");

function commit(sha, committedAt, message = "提交摘要\n详细说明") {
  return {
    sha,
    html_url: `https://github.com/acme/workspace/commit/${sha}`,
    commit: { message, committer: { date: committedAt }, author: { date: committedAt } },
  };
}

function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function stubFetch(t, handler) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  t.after(() => { globalThis.fetch = original; });
}

const publicRepository = {
  private: false,
  visibility: "public",
  full_name: "acme/workspace",
  html_url: "https://github.com/acme/workspace",
  default_branch: "main",
  updated_at: "2026-10-10T11:00:00.000Z",
  has_pages: false,
};

test("parses only GitHub HTTPS repository URLs", () => {
  assert.equal(parsePublicGitHubRepository("https://github.com/acme/workspace.git")?.fullName, "acme/workspace");
  assert.equal(parsePublicGitHubRepository("http://github.com/acme/workspace"), null);
  assert.equal(parsePublicGitHubRepository("https://notgithub.com/acme/workspace"), null);
});

test("counts all commits in the last seven days and uses no GitHub credentials", async (t) => {
  const recentCommits = Array.from({ length: 100 }, (_, index) => commit(
    `${index.toString(16).padStart(2, "0")}${"a".repeat(38)}`,
    new Date(now - index * 60_000).toISOString(),
    index === 0 ? "最新摘要\n后续说明" : `提交 ${index}`,
  ));
  const finalCommit = commit(`${"f".repeat(40)}`, new Date(now - GITHUB_ACTIVITY_WINDOW_MS).toISOString());
  const requests = [];
  stubFetch(t, async (url, options) => {
    requests.push({ url: new URL(url), options });
    if (new URL(url).pathname === "/repos/acme/workspace") return response(publicRepository);
    if (new URL(url).searchParams.get("page") === "1") return response(recentCommits);
    if (new URL(url).searchParams.get("page") === "2") return response([finalCommit]);
    assert.fail(`Unexpected GitHub request: ${url}`);
  });

  const snapshot = await fetchPublicGitHubRepository("https://github.com/acme/workspace", { now });
  assert.equal(snapshot.latestCommit.message, "最新摘要");
  assert.equal(snapshot.latestCommit.sha, recentCommits[0].sha.slice(0, 7));
  assert.equal(snapshot.latestCommit.url, `https://github.com/acme/workspace/commit/${recentCommits[0].sha}`);
  assert.equal(snapshot.latestCommit.committedAt, recentCommits[0].commit.committer.date);
  assert.equal(snapshot.recentSevenDayCommitCount, 101);
  assert.equal(snapshot.isPublic, true);
  assert.equal(snapshot.refreshedAt, new Date(now).toISOString());
  assert.equal(requests.length, 3);
  for (const { url, options } of requests) {
    assert.equal(url.origin, "https://api.github.com");
    if (url.pathname.endsWith("/commits")) {
      assert.equal(url.searchParams.get("since"), new Date(now - GITHUB_ACTIVITY_WINDOW_MS).toISOString());
    }
    assert.equal(options.credentials, "omit");
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(options.referrerPolicy, "no-referrer");
  }
});

test("shows the latest older commit when there were no commits in the seven-day window", async (t) => {
  const oldCommit = commit("b".repeat(40), new Date(now - GITHUB_ACTIVITY_WINDOW_MS - 1000).toISOString(), "旧提交");
  stubFetch(t, async (url) => {
    const parsed = new URL(url);
    if (parsed.pathname === "/repos/acme/workspace") return response(publicRepository);
    if (parsed.searchParams.has("since")) return response([]);
    if (parsed.searchParams.get("per_page") === "1") return response([oldCommit]);
    assert.fail(`Unexpected GitHub request: ${url}`);
  });

  const snapshot = await fetchPublicGitHubRepository("https://github.com/acme/workspace", { now });
  assert.equal(snapshot.latestCommit.message, "旧提交");
  assert.equal(snapshot.recentSevenDayCommitCount, 0);
});

test("treats inaccessible private repositories as unavailable", async (t) => {
  stubFetch(t, async () => response({ message: "Not Found" }, 404));
  await assert.rejects(fetchPublicGitHubRepository("https://github.com/acme/private", { now }), (error) => error.status === 404);
});

test("uses a one-hour cache boundary", () => {
  assert.equal(GITHUB_CACHE_TTL_MS, 60 * 60 * 1000);
  const snapshot = (refreshedAt) => ({ refreshedAt, recentSevenDayCommitCount: 0 });
  assert.equal(isGitHubSnapshotFresh(snapshot(new Date(now - GITHUB_CACHE_TTL_MS + 1).toISOString()), now), true);
  assert.equal(isGitHubSnapshotFresh(snapshot(new Date(now - GITHUB_CACHE_TTL_MS).toISOString()), now), false);
  assert.equal(isGitHubSnapshotFresh(snapshot(new Date(now + 1).toISOString()), now), false);
  assert.equal(isGitHubSnapshotFresh(snapshot("invalid"), now), false);
  assert.equal(isGitHubSnapshotFresh({ refreshedAt: new Date(now).toISOString() }, now), false);
});
