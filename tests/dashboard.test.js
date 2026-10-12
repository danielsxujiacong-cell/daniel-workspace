import test from "node:test";
import assert from "node:assert/strict";
import { buildRecentProjectUpdates, chooseRecentCommit } from "../src/dashboard.js";
import { projectDescriptionAfterEdit, projectDescriptionForEdit, projectIntroduction } from "../src/project-story.js";

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

test("humanizes scan-generated descriptions and preserves a manually edited introduction", () => {
  const project = {
    name: "AI Investment Dashboard",
    github: "https://github.com/danielsxujiacong-cell/AI-investment-dashboard",
    description: "扫描时 README 标记 V6.1 · Step 01 已导入",
  };
  assert.equal(projectIntroduction(project), "整合真实行情、个人持仓和 AI 研究，帮助投资者集中跟踪组合并做决策。");
  assert.equal(projectDescriptionForEdit(project), projectIntroduction(project));
  assert.equal(projectDescriptionAfterEdit(project, projectDescriptionForEdit(project)), project.description);
  project.description = "把真实行情和个人持仓放在一起，方便我检查组合变化。";
  assert.equal(projectIntroduction(project), project.description);
  assert.equal(projectDescriptionAfterEdit(project, "我想手动更新这句简介。"), "我想手动更新这句简介。");
});

test("shows the five newest grounded updates with original GitHub links", () => {
  const commits = [
    { sha: "aaaaaaa", message: "Add Dify knowledge demo to FlowOps", committedAt: "2026-10-12T01:01:31Z", url: "https://github.com/danielsxujiacong-cell/daniel-project-hub/commit/aaaaaaa" },
    { sha: "bbbbbbb", message: "Record FlowOps deployment verification", committedAt: "2026-10-12T00:05:53Z", url: "https://github.com/danielsxujiacong-cell/daniel-project-hub/commit/bbbbbbb" },
    { sha: "ccccccc", message: "chore: archive safe workflows for steps 01-03D", committedAt: "2026-10-11T15:11:27Z", url: "https://github.com/danielsxujiacong-cell/n8n-ai-automation-lab/commit/ccccccc" },
    { sha: "ddddddd", message: "V3.7 精简 Workspace 全站 UI", committedAt: "2026-10-11T11:46:00Z", url: "https://github.com/danielsxujiacong-cell/daniel-workspace/commit/ddddddd" },
    { sha: "eeeeeee", message: "Map AI chat route to EdgeOne directory root", committedAt: "2026-10-09T04:04:22Z", url: "https://github.com/danielsxujiacong-cell/AI-investment-dashboard/commit/eeeeeee" },
    { sha: "fffffff", message: "Unreviewed English title", committedAt: "2026-10-09T03:00:00Z", url: "https://github.com/danielsxujiacong-cell/AI-investment-dashboard/commit/fffffff" },
  ];
  const projects = [
    ["Daniel Project Hub", "daniel-project-hub", commits.slice(0, 2)],
    ["n8n AI Automation Lab", "n8n-ai-automation-lab", commits.slice(2, 3)],
    ["Daniel Workspace", "daniel-workspace", commits.slice(3, 4)],
    ["AI Investment Dashboard", "AI-investment-dashboard", commits.slice(4)],
  ].map(([name, repository, recentCommits]) => ({
    id: repository,
    name,
    isPinned: true,
    github: `https://github.com/danielsxujiacong-cell/${repository}`,
    githubData: { source: "github-app", isPublic: false, repositoryName: `danielsxujiacong-cell/${repository}`, recentCommits },
  }));
  const updates = buildRecentProjectUpdates(projects, [], 5);
  assert.equal(updates.length, 5);
  assert.deepEqual(updates.map((update) => update.text), [
    "加入可体验的企业知识库问答入口，让访客直接查询采购制度和申请流程。",
    "完成 FlowOps 上线检查，确认展示页及静态资源均已正常发布。",
    "整理并归档采购审批与 AI 分析流程配置，方便在新环境安全复用；归档不含凭据或运行数据。",
    "精简首页与项目页的信息层级，让重点项目、进展和待办更容易查看。",
    "调整 AI 对话接口文件位置，使它匹配 EdgeOne 的线上路由规则。",
  ]);
  assert.equal(updates[0].url, commits[0].url);
  assert.equal(updates.some((update) => update.rawMessage === "Unreviewed English title"), false);
});

test("includes recent work records without exposing evidence URLs", () => {
  const project = { id: "p1", name: "Daniel Workspace", isPinned: true };
  const updates = buildRecentProjectUpdates([project], [{
    id: "log-1",
    projectId: "p1",
    workDate: "2026-10-11",
    completedItems: "完成项目简介人话化",
    outcomes: "首页卡片和详情页使用同一简介",
    evidenceLinks: ["https://example.com/private-evidence"],
  }]);
  assert.equal(updates[0].source, "工作记录");
  assert.match(updates[0].text, /完成项目简介人话化/);
  assert.equal(updates[0].text.includes("example.com"), false);
});
