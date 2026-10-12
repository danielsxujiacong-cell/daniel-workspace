import assert from "node:assert/strict";
import test from "node:test";
import {
  loadProjectWorkLogs,
  loadWorkLogActivityForRange,
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
    selectedRange: null,
    select(value) { calls.push(["select", value]); return this; },
    eq(key, value) { calls.push(["eq", key, value]); return this; },
    in(key, value) { calls.push(["in", key, value]); return this; },
    gte(key, value) { calls.push(["gte", key, value]); return this; },
    lte(key, value) { calls.push(["lte", key, value]); return this; },
    order(key, value) { calls.push(["order", key, value]); return this; },
    limit(value) { calls.push(["limit", value]); return this; },
    range(start, end) { calls.push(["range", start, end]); this.selectedRange = [start, end]; return this; },
    abortSignal(signal) { this.signal = signal; return this; },
    then(resolve, reject) {
      const rows = this.selectedRange ? data.slice(this.selectedRange[0], this.selectedRange[1] + 1) : data;
      return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
    },
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

test("project work log read honors the preview stage abort signal", async () => {
  let querySignal;
  const client = {
    from() {
      const query = {
        select() { return this; },
        eq() { return this; },
        order() { return this; },
        limit() { return this; },
        abortSignal(signal) { querySignal = signal; return this; },
        then(resolve, reject) {
          return new Promise((_, rejectAbort) => querySignal.addEventListener("abort", () => rejectAbort(new Error("aborted")), { once: true }))
            .then(resolve, reject);
        },
      };
      return query;
    },
  };
  const controller = new AbortController();
  const request = loadProjectWorkLogs(client, "user-1", "project-1", { signal: controller.signal });
  controller.abort();
  await assert.rejects(request, /工作记录云端读取超时/);
  assert.equal(querySignal.aborted, true);
});

test("date range reads stay within supplied projects and week bounds", async () => {
  const client = fakeClient([]);
  await loadWorkLogsForRange(client, "user-1", { startDate: "2026-10-05", endDate: "2026-10-11", projectIds: ["p1", "p2", "p1"] });
  assert.deepEqual(client.calls.find((call) => call[0] === "in"), ["in", "project_id", ["p1", "p2"]]);
  assert.ok(client.calls.some((call) => call[0] === "gte" && call[1] === "work_date" && call[2] === "2026-10-05"));
  assert.ok(client.calls.some((call) => call[0] === "lte" && call[1] === "work_date" && call[2] === "2026-10-11"));
  await assert.rejects(() => loadWorkLogsForRange(client, "user-1", { startDate: "2026-10-12", endDate: "2026-10-11", projectIds: ["p1"] }), /日期范围无效/);
});

test("activity reads only minimal work-log fields and page through scoped rows", async () => {
  const rows = Array.from({ length: 1_001 }, (_, index) => ({
    id: `log-${index}`,
    project_id: "p1",
    work_date: "2026-10-11",
    completed_items: "must not be selected",
    evidence_links: ["https://example.com/private"],
  }));
  const client = fakeClient(rows);
  const result = await loadWorkLogActivityForRange(client, "user-1", {
    startDate: "2026-10-01",
    endDate: "2026-10-12",
    projectIds: ["p1", "p2", "p1"],
  });

  assert.equal(result.items.length, 1_001);
  assert.equal(result.complete, true);
  assert.deepEqual(client.calls.filter((call) => call[0] === "range"), [["range", 0, 999], ["range", 1_000, 1_999]]);
  assert.deepEqual(client.calls.find((call) => call[0] === "select"), ["select", "id,project_id,work_date"]);
  assert.deepEqual(client.calls.find((call) => call[0] === "in"), ["in", "project_id", ["p1", "p2"]]);
  assert.ok(client.calls.some((call) => call[0] === "eq" && call[1] === "user_id" && call[2] === "user-1"));
  assert.deepEqual(Object.keys(result.items[0]).sort(), ["id", "projectId", "workDate"]);
  assert.equal(JSON.stringify(result.items).includes("must not be selected"), false);
  assert.equal(JSON.stringify(result.items).includes("private"), false);
});

test("activity reads report malformed source rows as incomplete", async () => {
  const client = fakeClient([{ id: "log-1", project_id: "p1", work_date: "not-a-date" }]);
  const result = await loadWorkLogActivityForRange(client, "user-1", {
    startDate: "2026-10-01",
    endDate: "2026-10-12",
    projectIds: ["p1"],
  });
  assert.deepEqual(result.items, []);
  assert.equal(result.complete, false);
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
