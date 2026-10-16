import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWeeklySummaryContext,
  buildWeeklySummaryPrompt,
  getWeeklySummaryRange,
  parseWeeklySummaryResponse,
  shanghaiDateKey,
  weeklySummaryMarkdown,
} from "../src/ai/weekly-summary.js";

const range = { startDate: "2026-10-05", endDate: "2026-10-11" };
const projects = [{ id: "p1", name: "Workspace", status: "进行中", stage: "V3.6", next: "验证移动端表单回填" }];
const workLogs = [{
  id: "row-id", projectId: "p1", workDate: "2026-10-11", completedItems: "实现工作记录同步",
  outcomes: "遇到 RLS 查询问题并已修复", nextStep: "验证移动端表单回填",
  evidenceLinks: ["https://private.example/evidence"], updatedAt: "2026-10-11T08:00:00Z",
}];
const github = [{ name: "Workspace", commitsLast24Hours: [{ message: "Add work log UI", committedAt: "2026-10-11T07:00:00Z" }], commitsDays1To7: [] }];

test("weekly range uses Asia/Shanghai Monday through the current local date", () => {
  assert.equal(shanghaiDateKey(Date.parse("2026-10-11T16:30:00Z")), "2026-10-12");
  assert.deepEqual(getWeeklySummaryRange(Date.parse("2026-10-11T16:30:00Z")), { startDate: "2026-10-12", endDate: "2026-10-12" });
  assert.deepEqual(getWeeklySummaryRange(Date.parse("2026-10-11T15:59:59.999Z")), range);
});

test("weekly AI payload is bounded and excludes row IDs and evidence URLs", () => {
  const manyProjects = Array.from({ length: 26 }, (_, index) => ({
    id: `project-${index}`, name: `Project ${index} ${"x".repeat(100)}`, status: "进行中".repeat(12), stage: "阶段".repeat(20), next: "下一步".repeat(50),
  }));
  const manyLogs = Array.from({ length: 30 }, (_, index) => ({ ...workLogs[0], id: `row-${index}`, projectId: manyProjects[index % manyProjects.length].id, completedItems: "完成".repeat(200), outcomes: "成果".repeat(100), nextStep: "下一步".repeat(100) }));
  const context = buildWeeklySummaryContext(manyProjects, manyLogs, github, range);
  const sent = JSON.stringify(context.facts);
  assert.ok(sent.length < 12_000, `payload length ${sent.length} should fit the Worker context limit`);
  assert.equal(sent.includes("private.example"), false);
  assert.equal(sent.includes("row-0"), false);
  assert.equal(sent.includes("project-0"), false);
  assert.equal(context.references.workLogs.length, 15);
  assert.match(buildWeeklySummaryPrompt(range), /不得把当前状态冒充本周变化/);
});

test("weekly summary parser accepts grounded sections and rejects status-only completion or plans", () => {
  const context = buildWeeklySummaryContext(projects, workLogs, github, range);
  const answer = JSON.stringify({
    completed: [{ project: "Workspace", text: "记录实现并可跨设备读取", basis: "2026-10-11 · 实现工作记录同步 · 保存后可读取" }],
    progress: [{ project: "Workspace", text: "首页与工作记录入口已接通", basis: "Add work log UI · 2026-10-11T07:00:00Z" }],
    issues: [{ project: "Workspace", text: "本周处理过 RLS 查询问题", basis: "2026-10-11 · 遇到 RLS 查询问题并已修复" }],
    nextWeek: [{ project: "Workspace", text: "验证手机端表单回填", basis: "2026-10-11 · 验证移动端表单回填" }],
  });
  const summary = parseWeeklySummaryResponse(answer, context);
  assert.equal(summary.completed.length, 1);
  assert.equal(summary.progress.length, 1);
  assert.equal(summary.issues.length, 1);
  assert.equal(summary.nextWeek.length, 1);
  const ungrounded = JSON.stringify({
    completed: [{ project: "Workspace", text: "全部工作完成", basis: "进行中" }],
    progress: [], issues: [], nextWeek: [{ project: "Workspace", text: "新建任务跟踪", basis: "进行中" }],
  });
  assert.throws(() => parseWeeklySummaryResponse(ungrounded, context), /来源核验/);
});

test("weekly summary can be copied as Markdown with evidence and empty sections", () => {
  const context = buildWeeklySummaryContext(projects, workLogs, github, range);
  const summary = parseWeeklySummaryResponse(JSON.stringify({ completed: [], progress: [], issues: [], nextWeek: [] }), context);
  const markdown = weeklySummaryMarkdown(summary);
  assert.match(markdown, /# 本周工作总结（2026-10-05 至 2026-10-11）/);
  assert.match(markdown, /## 下周计划/);
  assert.match(markdown, /暂无可核实记录/);
});
