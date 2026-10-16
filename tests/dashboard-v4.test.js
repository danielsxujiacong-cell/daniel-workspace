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

test("universe keeps categories in one stable field without overlap", () => {
  const groups = [
    ["AI 与数据", 8, "AI 数据分析"],
    ["自动化", 6, "n8n 自动化工作流"],
    ["效率工具", 5, "项目管理工作台"],
    ["创作与展示", 4, "作品集 design"],
    ["其他", 3, "未分类项目"],
  ];
  const projects = groups.flatMap(([type, count, description], groupIndex) => Array.from({ length: count }, (_, index) => ({
    id: `${groupIndex}-${index}`,
    name: `${type} 项目 ${index + 1}`,
    description,
  })));
  const activity = {
    projectActivity: projects.map((project, index) => ({
      projectId: project.id,
      githubCommits: index % 7,
      workLogs: index % 3,
    })),
  };
  for (const [width, height] of [[1280, 620], [960, 700], [720, 880]]) {
    const graph = buildProjectUniverse({ projects, activity, width, height });
    assert.equal(graph.nodes.length, 26);
    assert.equal(graph.clusters.length, 0);
    assert.equal(new Set(graph.nodes.map((node) => node.category)).size, 5);
    assert.ok(graph.nodes.every((node) => node.x >= node.radius + 10 && node.x <= graph.width - node.radius - 10
      && node.y >= node.radius + 10 && node.y <= graph.height - node.radius - 10));
    for (let left = 0; left < graph.nodes.length; left += 1) {
      for (let right = left + 1; right < graph.nodes.length; right += 1) {
        const a = graph.nodes[left];
        const b = graph.nodes[right];
        const gap = Math.hypot(b.x - a.x, b.y - a.y) - a.radius - b.radius;
        assert.ok(gap >= 8, `${width}×${height}: ${a.project.name} and ${b.project.name} overlap by ${-gap}px`);
      }
    }
    const repeated = buildProjectUniverse({ projects, activity, width, height });
    assert.deepEqual(graph.nodes.map(({ id, x, y }) => [id, x, y]), repeated.nodes.map(({ id, x, y }) => [id, x, y]));
  }
  const repositioned = buildProjectUniverse({ projects, activity, width: 1280, height: 620, positions: { "0-1": { x: 640, y: 340 } } });
  assert.equal(repositioned.nodes.find((node) => node.id === "0-1").x, 640);
  assert.equal(repositioned.nodes.find((node) => node.id === "0-1").y, 340);

  const filtered = buildProjectUniverse({ projects, activity, width: 1280, height: 620, selectedCategory: "AI 与数据" });
  const baseline = buildProjectUniverse({ projects, activity, width: 1280, height: 620 });
  assert.deepEqual(filtered.nodes.map(({id,x,y}) => [id,x,y]), baseline.nodes.map(({id,x,y}) => [id,x,y]), "category cannot split the field");
  const renamed = buildProjectUniverse({projects:projects.map(p=>({...p,description:"automation workflow"})),activity});
  assert.deepEqual(renamed.nodes.map(({id,x,y})=>[id,x,y]),baseline.nodes.map(({id,x,y})=>[id,x,y]));
});

test("missing activity remains distinguishable from verified zero activity", () => {
  const graph = buildProjectUniverse({ projects: [{ id: "unknown", name: "Unlinked project" }] });
  assert.equal(graph.activityAvailable, false);
  assert.equal(graph.nodes[0].score, 0);
  assert.equal(graph.nodes[0].coverage, undefined);
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


test("compact universe preserves flagship hierarchy and leaves room for touch targets", () => {
  const names = ["Daniel Workspace", "AI Investment Dashboard", "Daniel Project Hub", "Daniel website", "n8n AI Automation Lab"];
  const projects = Array.from({length:26}, (_,i)=>({id:`p${i}`,name:names[i] || `Project ${i}`}));
  for (const width of [390,500]) {
    const graph = buildProjectUniverse({projects,width,height:360});
    assert.equal(graph.nodes.length,26);
    assert.equal(graph.nodes.filter(n=>n.flagship).length,5);
    assert.ok(Math.min(...graph.nodes.filter(n=>n.flagship).map(n=>n.radius)) > Math.max(...graph.nodes.filter(n=>!n.flagship).map(n=>n.radius)));
    for (let i=0;i<26;i++) for (let j=i+1;j<26;j++) {
      const a=graph.nodes[i],b=graph.nodes[j];
      assert.ok(Math.hypot(a.x-b.x,a.y-b.y) > a.radius+b.radius+8);
    }
    const occupied = Math.max(...graph.nodes.map(n=>n.x+n.radius))-Math.min(...graph.nodes.map(n=>n.x-n.radius));
    assert.ok(occupied/width > .64 && occupied/width < .8);
  }
});
