import test from "node:test";
import assert from "node:assert/strict";
import {
  buildHomeActivity,
  projectStageBreakdown,
  projectStatusBreakdown,
  resolveActivityRange,
} from "../src/home-activity.js";

test("activity range defaults to 30 Shanghai dates and validates custom ranges", () => {
  const now = new Date("2026-10-12T02:00:00.000Z");
  assert.deepEqual(resolveActivityRange("30d", { now }), {
    valid: true,
    preset: "30d",
    startDate: "2026-09-13",
    endDate: "2026-10-12",
    days: 30,
  });
  assert.equal(resolveActivityRange("7d", { now }).startDate, "2026-10-06");
  assert.equal(resolveActivityRange("custom", { startDate: "2025-01-01", endDate: "2026-10-12", now }).valid, false);
  assert.equal(resolveActivityRange("custom", { startDate: "2026-10-10", endDate: "2026-10-13", now }).valid, false);
  assert.equal(resolveActivityRange("custom", { startDate: "2026-10-10", endDate: "2026-10-12", now }).days, 3);
});

test("project charts use saved status and stage values and keep blank stages unclassified", () => {
  const projects = [
    { status: "进行中", stage: "" },
    { status: "已完成", stage: "03C" },
    { status: "待确认", stage: "未填写" },
    { status: "进行中", stage: "" },
  ];
  assert.deepEqual(projectStatusBreakdown(projects), [
    { label: "进行中", count: 2 },
    { label: "已完成", count: 1 },
    { label: "待确认", count: 1 },
  ]);
  assert.deepEqual(projectStageBreakdown(projects), [
    { label: "03C", count: 1 },
    { label: "未分类", count: 3 },
  ]);
});

test("activity keeps commit and work-log counts separate and deduplicates repeated repo and log rows", () => {
  const model = buildHomeActivity({
    startDate: "2026-10-10",
    endDate: "2026-10-12",
    projects: [
      { id: "p1", name: "项目一" },
      { id: "p2", name: "项目二" },
    ],
    projectRepositories: [
      { fullName: "acme/app", projectId: "p1", projectName: "项目一" },
      { fullName: "ACME/APP", projectId: "p2", projectName: "项目二" },
    ],
    githubResults: [
      { fullName: "acme/app", complete: true, dailyCounts: [{ date: "2026-10-11", count: 2 }] },
      { fullName: "ACME/APP", complete: true, dailyCounts: [{ date: "2026-10-11", count: 9 }] },
    ],
    workLogs: [
      { id: "log-1", projectId: "p1", workDate: "2026-10-11" },
      { id: "log-1", projectId: "p1", workDate: "2026-10-11" },
      { id: "log-2", projectId: "p2", workDate: "2026-10-12" },
    ],
    githubStatus: "ready",
    workLogsStatus: "ready",
  });

  const firstActiveDay = model.days.find((day) => day.date === "2026-10-11");
  assert.equal(firstActiveDay.githubCommits, 2);
  assert.equal(firstActiveDay.workLogs, 1);
  assert.deepEqual(new Set(firstActiveDay.githubProjects), new Set(["项目一", "项目二"]));
  assert.deepEqual(model.totals, { githubCommits: 2, workLogs: 2, activityRecords: 4, activeDays: 2 });
  assert.equal(model.coverage.complete, true);
});

test("unreadable GitHub history marks empty dates as incomplete instead of zero activity", () => {
  const model = buildHomeActivity({
    startDate: "2026-10-10",
    endDate: "2026-10-11",
    projects: [{ id: "p1", name: "项目一" }],
    projectRepositories: [{ fullName: "acme/app", projectId: "p1", projectName: "项目一" }],
    githubResults: [],
    githubErrors: [{ fullName: "acme/app", code: "github_rate_limited", message: "GitHub 历史读取 HTTP 403：API rate limit exceeded" }],
    githubStatus: "ready",
    workLogs: [],
    workLogsStatus: "ready",
  });

  assert.equal(model.coverage.complete, false);
  assert.equal(model.days.every((day) => day.partial), true);
  assert.deepEqual(model.coverage.githubIncompleteDetails, [{
    fullName: "acme/app",
    reason: "GitHub 历史读取 HTTP 403：API rate limit exceeded",
  }]);
  assert.deepEqual(model.totals, { githubCommits: 0, workLogs: 0, activityRecords: 0, activeDays: 0 });
});

test("truncated GitHub history identifies the affected repository and the pagination reason", () => {
  const model = buildHomeActivity({
    startDate: "2026-10-10",
    endDate: "2026-10-11",
    projects: [{ id: "p1", name: "项目一" }],
    projectRepositories: [{ fullName: "acme/app", projectId: "p1", projectName: "项目一" }],
    githubResults: [{
      fullName: "acme/app", complete: false, truncated: true,
      incompleteReason: "近 100 页后仍有 GitHub 分页结果。", commitsCount: 1,
      dailyCounts: [{ date: "2026-10-10", count: 1 }],
    }],
    workLogs: [],
  });

  assert.deepEqual(model.coverage.githubIncompleteDetails, [{
    fullName: "acme/app", reason: "近 100 页后仍有 GitHub 分页结果。",
  }]);
});
