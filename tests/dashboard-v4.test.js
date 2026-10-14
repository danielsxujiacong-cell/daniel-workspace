import test from "node:test";
import assert from "node:assert/strict";
import {
  buildOutcomeTimeline,
  buildProjectRelationships,
  buildProjectTreemap,
  buildProjectUniverse,
  inferProjectType,
  weekdayHourMatrix,
} from "../src/dashboard-v4.js";

test("project categories are derived from saved project text with an explicit fallback", () => {
  assert.equal(inferProjectType({ name: "n8n采购流程自动化" }), "自动化");
  assert.equal(inferProjectType({ name: "AI Investment Dashboard" }), "AI 与数据");
  assert.equal(inferProjectType({ name: "Personal Portfolio 3D" }), "创作与展示");
  assert.equal(inferProjectType({ name: "Daniel Workspace", description: "项目管理工作台" }), "效率工具");
  assert.equal(inferProjectType({ name: "Untyped repository" }), "其他");
});

test("project links require a shared repository or an explicit repository reference", () => {
  const projects = [
    { id: "a", name: "A", github: "https://github.com/acme/a" },
    { id: "b", name: "B", github: "https://github.com/acme/b", notes: "Companion service" },
    { id: "c", name: "C", github: "https://github.com/acme/a" },
  ];
  const links = buildProjectRelationships(projects, [
    { projectId: "b", title: "Read https://github.com/acme/a/releases" },
  ]);
  assert.deepEqual(links, [
    { source: "a", target: "b", kind: "仓库引用" },
    { source: "a", target: "c", kind: "共享仓库" },
    { source: "b", target: "c", kind: "仓库引用" },
  ]);
});

test("universe node sizes follow real activity and treemap tiles cover the project set", () => {
  const projects = [
    { id: "p1", name: "AI Dashboard", github: "https://github.com/acme/dashboard" },
    { id: "p2", name: "Automation Lab", github: "https://github.com/acme/automation" },
    { id: "p3", name: "Portfolio" },
  ];
  const activity = {
    projectActivity: [
      { projectId: "p1", projectName: "AI Dashboard", githubCommits: 8, workLogs: 1 },
      { projectId: "p2", projectName: "Automation Lab", githubCommits: 2, workLogs: 0 },
    ],
    projectCoverage: [
      { projectId: "p1", complete: true },
      { projectId: "p2", complete: false },
    ],
  };
  const graph = buildProjectUniverse({ projects, activity, tasks: [{ projectId: "p2", description: "See https://github.com/acme/dashboard" }] });
  assert.equal(graph.nodes.length, 3);
  assert.ok(graph.nodes.find((item) => item.id === "p1").radius > graph.nodes.find((item) => item.id === "p2").radius);
  assert.equal(graph.edges.length, 1);
  assert.equal(graph.edges[0].kind, "仓库引用");
  assert.equal(graph.nodes.find((item) => item.id === "p2").coverage.complete, false);

  const treemap = buildProjectTreemap(projects);
  assert.equal(treemap.tiles.length, projects.length);
  assert.equal(treemap.categories.reduce((sum, item) => sum + item.count, 0), projects.length);
  assert.ok(treemap.tiles.every((tile) => tile.width > 0 && tile.height > 0));
});

test("weekday-hour fingerprint accepts only a full 7 by 24 real aggregate", () => {
  const full = Array.from({ length: 168 }, (_, index) => ({ weekday: Math.floor(index / 24), hour: index % 24, count: index === 42 ? 3 : 0 }));
  assert.deepEqual(weekdayHourMatrix({ weekdayHourCounts: full, coverage: { weekdayHourlyComplete: true } }), {
    available: true,
    complete: true,
    cells: full,
  });
  assert.deepEqual(weekdayHourMatrix({ weekdayHourCounts: full.slice(0, 167), coverage: { weekdayHourlyComplete: true } }), {
    available: false,
    complete: false,
    cells: [],
  });
  assert.equal(weekdayHourMatrix(null).available, false);
});

test("outcome timeline uses real work logs and curated deployed releases in the last 30 days", () => {
  const timeline = buildOutcomeTimeline({
    now: new Date("2026-10-14T12:00:00+08:00"),
    projects: [{ id: "p1", name: "Daniel Workspace" }],
    workLogs: [
      { id: "private-row-id", projectId: "p1", workDate: "2026-10-14", completedItems: "完成星系图布局", outcomes: "项目节点已经支持悬停聚焦" },
      { id: "old", projectId: "p1", workDate: "2026-09-01", completedItems: "太早了", outcomes: "" },
      { id: "empty", projectId: "p1", workDate: "2026-10-13", completedItems: "", outcomes: "" },
    ],
  });
  assert.ok(timeline.some((item) => item.id === "release-v4.0" && item.date === "2026-10-14"));
  assert.ok(timeline.some((item) => item.id.startsWith("release-v3.9") && item.date === "2026-10-13"));
  const outcome = timeline.find((item) => item.kind === "成果");
  assert.equal(outcome.title, "项目节点已经支持悬停聚焦");
  assert.equal(outcome.projectName, "Daniel Workspace");
  assert.equal(outcome.source, "工作记录");
  assert.equal(timeline.some((item) => item.title === "太早了"), false);
  assert.equal(outcome.id.includes("private-row-id"), false);
});
