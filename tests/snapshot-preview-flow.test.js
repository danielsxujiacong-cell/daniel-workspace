import assert from "node:assert/strict";
import test from "node:test";
import {
  missingCompleteRepositories,
  missingPublicRepositoryVerifications,
  mergePublicRepositoryVerification,
  reusablePublicRepositorySnapshot,
  snapshotGitHubActivityCacheKey,
  withSnapshotPreviewTimeout,
} from "../src/snapshot-preview-flow.js";

test("snapshot activity cache keys normalize and sort repository names", () => {
  assert.equal(
    snapshotGitHubActivityCacheKey("2026-01-01", "2026-01-30", ["ACME/Two", "acme/one", "acme/two"]),
    "2026-01-01|2026-01-30|acme/one,acme/two",
  );
});

test("only complete, non-truncated repository results satisfy preview coverage", () => {
  const missing = missingCompleteRepositories([
    { fullName: "acme/complete", complete: true, truncated: false },
    { fullName: "acme/truncated", complete: false, truncated: true },
  ], ["acme/complete", "acme/truncated", "acme/missing"]);
  assert.deepEqual(missing, ["acme/truncated", "acme/missing"]);
});

test("reuses only fresh public snapshots that match the linked repository", () => {
  const snapshot = { repositoryName: "acme/workspace", isPublic: true, refreshedAt: "now" };
  assert.equal(reusablePublicRepositorySnapshot(snapshot, "ACME/WORKSPACE", true), snapshot);
  assert.equal(reusablePublicRepositorySnapshot({ ...snapshot, source: "github-app" }, "acme/workspace", true), null);
  assert.equal(reusablePublicRepositorySnapshot({ ...snapshot, isPublic: false }, "acme/workspace", true), null);
  assert.equal(reusablePublicRepositorySnapshot(snapshot, "acme/other", true), null);
  assert.equal(reusablePublicRepositorySnapshot(snapshot, "acme/workspace", false), null);
});

test("snapshot retries only transient or missing repository checks", () => {
  const snapshots = [{ repositoryName: "acme/complete", isPublic: true }];
  const errors = [
    { fullName: "acme/private", httpStatus: 404 },
    { fullName: "acme/limited", httpStatus: 403 },
  ];
  assert.deepEqual(
    missingPublicRepositoryVerifications(["acme/complete", "acme/private", "acme/limited", "acme/unknown"], snapshots, errors),
    ["acme/limited", "acme/unknown"],
  );
});

test("repository verification retries preserve successes and settled non-public results", () => {
  const merged = mergePublicRepositoryVerification({
    snapshots: [{ repositoryName: "acme/complete" }],
    errors: [{ fullName: "acme/private", httpStatus: 404 }, { fullName: "acme/retry", httpStatus: 403 }],
  }, {
    snapshots: [{ repositoryName: "acme/retry" }],
    errors: [{ fullName: "acme/unavailable", httpStatus: 500 }],
  }, ["acme/retry"]);

  assert.deepEqual(merged.snapshots.map(({ repositoryName }) => repositoryName), ["acme/complete", "acme/retry"]);
  assert.deepEqual(merged.errors.map(({ fullName }) => fullName), ["acme/private", "acme/unavailable"]);
});

test("snapshot preview stage timeout aborts the request and provides a retryable error", async () => {
  let signal;
  await assert.rejects(
    withSnapshotPreviewTimeout("GitHub 活动", 5, (stageSignal) => {
      signal = stageSignal;
      return new Promise(() => {});
    }),
    /GitHub 活动读取超时.*安全重试/,
  );
  assert.equal(signal.aborted, true);
});
