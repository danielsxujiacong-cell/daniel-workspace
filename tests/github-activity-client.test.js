import test from "node:test";
import assert from "node:assert/strict";
import { fetchGitHubActivity } from "../src/github/activity.js";

test("GitHub activity client splits repository reads into safe Worker batches", async (t) => {
  const originalFetch = globalThis.fetch;
  const requestedChunks = [];
  let sessionLookups = 0;
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    const names = body.repositories.map(({ fullName }) => fullName);
    requestedChunks.push(names);
    return Response.json({
      repositories: names.map((fullName) => ({
        fullName,
        complete: true,
        truncated: false,
        commitsCount: 0,
        dailyCounts: [],
      })),
      errors: [],
    });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const names = Array.from({ length: 10 }, (_, index) => `acme/repo-${index + 1}`);
  const result = await fetchGitHubActivity([...names, names[0], "invalid"], {
    client: { auth: { getSession: async () => {
      sessionLookups += 1;
      return { data: { session: { access_token: "test-session" } }, error: null };
    } } },
  }, { startDate: "2026-10-01", endDate: "2026-10-30" });

  assert.deepEqual(requestedChunks.map((chunk) => chunk.length), [4, 4, 2]);
  assert.deepEqual(requestedChunks.flat(), names);
  assert.equal(sessionLookups, 3);
  assert.deepEqual(result.repositories.map(({ fullName }) => fullName), names);
  assert.deepEqual(result.errors, []);
});
