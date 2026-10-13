import assert from "node:assert/strict";
import test from "node:test";
import {
  codexUsageForRange,
  fetchCodexUsage,
  mergeCodexUsageCache,
  publicTokenUsage,
  validateCodexUsage,
} from "../src/codex-usage.js";

function payload(startDate, endDate, days, generatedAt = "2026-10-13T06:00:00Z") {
  return {
    version: 1,
    source: "本机 Codex 会话日志",
    timezone: "Asia/Shanghai",
    startDate,
    endDate,
    coverageStartDate: "2026-10-10",
    coverageEndDate: "2026-10-13",
    generatedAt,
    latestEventAt: generatedAt,
    complete: true,
    fieldAvailability: { inputTokens: true, outputTokens: true, cachedInputTokens: true },
    days,
  };
}

const day = (date, inputTokens, outputTokens, cachedInputTokens) => ({ date, available: true, inputTokens, outputTokens, cachedInputTokens });

test("Codex usage validates exact date coverage and keeps out-of-range days unknown", () => {
  const source = payload("2026-10-12", "2026-10-13", [day("2026-10-12", 12, 4, 3), day("2026-10-13", 20, 5, 6)]);
  assert.equal(validateCodexUsage(source), true);
  const model = codexUsageForRange(source, { valid: true, startDate: "2026-10-11", endDate: "2026-10-13" });
  assert.equal(model.days[0].available, false);
  assert.equal(model.days[0].inputTokens, null);
  assert.equal(model.days[1].inputTokens, 12);
});

test("Codex usage cache merges overlapping ranges by date and only publishes daily totals", () => {
  const previous = payload("2026-10-10", "2026-10-12", [day("2026-10-10", 3, 1, 0), day("2026-10-11", 8, 2, 1), day("2026-10-12", 12, 4, 3)]);
  const next = payload("2026-10-12", "2026-10-13", [day("2026-10-12", 12, 4, 3), day("2026-10-13", 20, 5, 6)], "2026-10-13T07:00:00Z");
  const merged = mergeCodexUsageCache(previous, next);
  assert.equal(merged.days.length, 4);
  assert.equal(merged.days[2].inputTokens, 12);
  assert.equal(merged.days[3].outputTokens, 5);
  const published = publicTokenUsage(merged, { valid: true, startDate: "2026-10-11", endDate: "2026-10-13" });
  assert.deepEqual(Object.keys(published).sort(), ["complete", "coverageEndDate", "coverageStartDate", "days", "fieldAvailability", "generatedAt"].sort());
  assert.equal(JSON.stringify(published).includes("private chat"), false);
  assert.deepEqual(published.days.map(({ date }) => date), ["2026-10-11", "2026-10-12", "2026-10-13"]);
});

test("Codex usage client sends only the requested date range and rejects incomplete scans", async () => {
  let requestUrl = "";
  await assert.rejects(fetchCodexUsage("http://127.0.0.1:4174/api/codex-usage", { valid: true, startDate: "2026-10-12", endDate: "2026-10-13" }, {
    fetchImpl: async (input) => {
      requestUrl = String(input);
      return Response.json({ ...payload("2026-10-12", "2026-10-13", [day("2026-10-12", 1, 1, 0), day("2026-10-13", 2, 1, 0)]), complete: false });
    },
  }), /读取不完整/);
  const url = new URL(requestUrl);
  assert.equal(url.searchParams.get("startDate"), "2026-10-12");
  assert.equal(url.searchParams.get("endDate"), "2026-10-13");
});
