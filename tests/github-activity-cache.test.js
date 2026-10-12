import test from "node:test";
import assert from "node:assert/strict";
import { loadGitHubActivityCache, loadGitHubActivityCacheForRange, saveGitHubActivityCache } from "../src/store.js";

const CACHE_KEY = "daniel-workspace-github-activity-v2";
const USER_ID = "user-1";
const RANGE_KEY = "2026-10-01|2026-10-30|acme/one,acme/two";
const complete = (fullName) => ({ fullName, complete: true, truncated: false, pagesRead: 1, commitsCount: 0, dailyCounts: [] });

function withLocalStorage(t) {
  const original = globalThis.localStorage;
  const values = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
    },
  });
  t.after(() => {
    if (original === undefined) delete globalThis.localStorage;
    else Object.defineProperty(globalThis, "localStorage", { configurable: true, value: original });
  });
  return values;
}

test("GitHub activity cache refuses errors, truncated results, and missing repositories", (t) => {
  const values = withLocalStorage(t);
  const partial = { repositories: [complete("acme/one")], errors: [{ fullName: "acme/two" }] };
  assert.equal(saveGitHubActivityCache(USER_ID, RANGE_KEY, partial), false);
  values.set(CACHE_KEY, JSON.stringify({ version: 1, userId: USER_ID, entries: {
    [RANGE_KEY]: { fetchedAt: new Date().toISOString(), data: partial },
  } }));
  assert.equal(loadGitHubActivityCache(USER_ID, RANGE_KEY), null);
  assert.equal(saveGitHubActivityCache(USER_ID, RANGE_KEY, { repositories: [complete("acme/one")], errors: [] }), false);
  assert.equal(saveGitHubActivityCache(USER_ID, RANGE_KEY, {
    repositories: [{ ...complete("acme/one"), complete: false, truncated: true }], errors: [],
  }), false);
});

test("GitHub activity cache accepts only a complete repository set and keeps the shorter freshness window", (t) => {
  withLocalStorage(t);
  const fetchedAt = "2026-10-12T00:00:00.000Z";
  const data = { repositories: [complete("acme/one"), complete("acme/two")], errors: [] };
  assert.equal(saveGitHubActivityCache(USER_ID, RANGE_KEY, data, fetchedAt), true);
  assert.deepEqual(loadGitHubActivityCache(USER_ID, RANGE_KEY, Date.parse(fetchedAt) + 14 * 60 * 1000), { ...data, fetchedAt });
  assert.equal(loadGitHubActivityCache(USER_ID, RANGE_KEY, Date.parse(fetchedAt) + 16 * 60 * 1000), null);
});

test("snapshot preview can reuse complete per-batch entries from the existing range cache", (t) => {
  withLocalStorage(t);
  const startDate = "2026-10-01";
  const endDate = "2026-10-30";
  assert.equal(saveGitHubActivityCache(USER_ID, `${startDate}|${endDate}|acme/one`, { repositories: [complete("acme/one")], errors: [] }), true);
  assert.equal(saveGitHubActivityCache(USER_ID, `${startDate}|${endDate}|acme/two`, { repositories: [complete("acme/two")], errors: [] }), true);
  const cached = loadGitHubActivityCacheForRange(USER_ID, startDate, endDate);
  assert.deepEqual(cached.repositories.map(({ fullName }) => fullName).sort(), ["acme/one", "acme/two"]);
  assert.deepEqual(cached.errors, []);
});
