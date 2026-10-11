import assert from "node:assert/strict";
import test from "node:test";
import {
  loadProjectWorkLogs,
  loadWorkLogsForRange,
  normalizeEvidenceLinks,
  saveWorkLogRecord,
  validateWorkLogDraft,
  workLogCloudError,
  workLogToRow,
} from "../src/cloud/work-logs.js";

function fakeClient(data = []) {
  const calls = [];
  const builder = {
    select(value) { calls.push(["select", value]); return this; },
    eq(key, value) { calls.push(["eq", key, value]); return this; },
    in(key, value) { calls.push(["in", key, value]); return this; },
    gte(key, value) { calls.push(["gte", key, value]); return this; },
    lte(key, value) { calls.push(["lte", key, value]); return this; },
    order(key, value) { calls.push(["order", key, value]); return this; },
    limit(value) { calls.push(["limit", value]); return this; },
    abortSignal() { return this; },
    then(resolve, reject) { return Promise.resolve({ data, error: null }).then(resolve, reject); },
  };
  return { calls, from(table) { calls.push(["from", table]); return builder; } };
}

const draft = {
  workDate: "2026-10-11",
  completedItems: "实现项目工作记录",
  outcomes: "记录可跨设备读取",
  nextStep: "验证手机端编辑",
  evidenceLinks: "https://example.com/notes\nhttps://github.com/example/repo/issues/1",
};

test("work log draft validates dates, required completion, and safe bounded evidence links", () => {
  assert.equal(validateWorkLogDraft(draft).evidenceLinks.length, 2);
  assert.deepEqual(normalizeEvidenceLinks(["https://example.com", "https://example.com"]), ["https://example.com/"]);
  assert.throws(() => validateWorkLogDraft({ ...draft, workDate: "2026-02-31" }), /有效的工作日期/);
  assert.throws(() => validateWorkLogDraft({ ...draft, completedItems: "  " }), /完成事项/);
  assert.throws(() => normalizeEvidenceLinks(["javascript:alert(1)"]), /HTTP\/HTTPS/);
  assert.throws(() => normalizeEvidenceLinks(["https://person:secret@example.com/private"]), /用户名或密码/);
  assert.throws(() => normalizeEvidenceLinks(Array.from({ length: 11 }, (_, i) => `https://example.com/${i}`)), /最多添加 10 个/);
});

test("work log serialization uses an explicit user/project field allowlist", () => {
  const row = workLogToRow({ ...draft, localPath: "D:\\private", sha: "deadbeef", evidenceLinks: draft.evidenceLinks }, "user-1", "project-1", {
    id: "work-log-1", now: "2026-10-11T08:00:00.000Z",
  });
  assert.deepEqual(Object.keys(row).sort(), ["completed_items", "created_at", "evidence_links", "id", "next_step", "outcomes", "project_id", "updated_at", "user_id", "work_date"].sort());
  assert.equal(row.user_id, "user-1");
  assert.equal(row.project_id, "project-1");
  assert.equal(row.evidence_links.length, 2);
  assert.equal(JSON.stringify(row).includes("D:\\private"), false);
  assert.equal(JSON.stringify(row).includes("deadbeef"), false);
});

test("project work log reads are scoped to the validated user and project", async () => {
  const client = fakeClient([{ id: "work-log-1", user_id: "user-1", project_id: "project-1", work_date: "2026-10-11", completed_items: "完成跨设备记录", outcomes: "保存成功", next_step: "验证读取", evidence_links: [], created_at: "2026-10-11T08:00:00Z" }]);
  const logs = await loadProjectWorkLogs(client, "user-1", "project-1");
  assert.equal(logs.length, 1);
  assert.equal(logs[0].completedItems, "完成跨设备记录");
  assert.ok(client.calls.some((call) => call[0] === "eq" && call[1] === "user_id" && call[2] === "user-1"));
  assert.ok(client.calls.some((call) => call[0] === "eq" && call[1] === "project_id" && call[2] === "project-1"));
});

test("date range reads stay within supplied projects and week bounds", async () => {
  const client = fakeClient([]);
  await loadWorkLogsForRange(client, "user-1", { startDate: "2026-10-05", endDate: "2026-10-11", projectIds: ["p1", "p2", "p1"] });
  assert.deepEqual(client.calls.find((call) => call[0] === "in"), ["in", "project_id", ["p1", "p2"]]);
  assert.ok(client.calls.some((call) => call[0] === "gte" && call[1] === "work_date" && call[2] === "2026-10-05"));
  assert.ok(client.calls.some((call) => call[0] === "lte" && call[1] === "work_date" && call[2] === "2026-10-11"));
  await assert.rejects(() => loadWorkLogsForRange(client, "user-1", { startDate: "2026-10-12", endDate: "2026-10-11", projectIds: ["p1"] }), /日期范围无效/);
});

test("saving an edit uses an upsert and leaves deletion unsupported", async () => {
  const calls = [];
  const savedRow = { id: "work-log-1", user_id: "user-1", project_id: "project-1", work_date: draft.workDate, completed_items: draft.completedItems, outcomes: draft.outcomes, next_step: draft.nextStep, evidence_links: ["https://example.com/notes"], created_at: "2026-10-10T00:00:00Z", updated_at: "2026-10-11T08:00:00Z" };
  const builder = {
    upsert(row, options) { calls.push(["upsert", row, options]); return this; },
    select(fields) { calls.push(["select", fields]); return this; },
    single() { return Promise.resolve({ data: savedRow, error: null }); },
  };
  const client = { from(table) { calls.push(["from", table]); return builder; } };
  const saved = await saveWorkLogRecord(client, "user-1", "project-1", { ...draft, id: "work-log-1", createdAt: "2026-10-10T00:00:00Z" });
  assert.equal(saved.id, "work-log-1");
  assert.deepEqual(calls.find((call) => call[0] === "upsert")[2], { onConflict: "user_id,id" });
  assert.equal(calls.some((call) => call[0] === "delete"), false);
});

test("missing schema and RLS errors are explained without Mock fallback", () => {
  assert.match(workLogCloudError({ code: "PGRST205" }), /尚未部署/);
  assert.match(workLogCloudError({ code: "42501" }), /权限校验失败/);
});
