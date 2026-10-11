import test from "node:test";
import assert from "node:assert/strict";
import { chooseRecentCommit } from "../src/dashboard.js";

test("deduplicates the same commit reported by GitHub and the local scan", () => {
  const selected = chooseRecentCommit(
    { sha: "abcdef0", message: "One real update", committedAt: "2026-10-10T10:00:00Z", url: "https://github.com/acme/app/commit/abcdef0" },
    { sha: "abcdef012345", message: "One real update", committedAt: "2026-10-10T10:00:00Z" },
  );

  assert.equal(selected.source, "GitHub");
  assert.equal(selected.message, "One real update");
  assert.equal(selected.sha, "abcdef0");
});

test("shows only the newest source when GitHub and the local scan report different commits", () => {
  const selected = chooseRecentCommit(
    { sha: "aaaaaaa", message: "Older remote update", committedAt: "2026-10-10T10:00:00Z" },
    { sha: "bbbbbbb", message: "New local update", committedAt: "2026-10-11T10:00:00Z" },
  );

  assert.equal(selected.source, "本机");
  assert.equal(selected.message, "New local update");
});
