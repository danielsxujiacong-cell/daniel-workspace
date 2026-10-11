import test from "node:test";
import assert from "node:assert/strict";
import { buildDailyBriefContext, buildDailyBriefPrompt, parseDailyBriefResponse } from "../src/ai/daily-brief.js";

const sha = "abcdef1234567890abcdef1234567890abcdef12";
const project = {
  id: "p1", name: "Workspace", isPinned: true, status: "进行中", stage: "V3.4", next: "验证首页简报",
  path: "D:\\private", github: "https://github.com/daniel/Workspace",
  githubData: {
    isPublic: true, repositoryName: "daniel/Workspace", refreshedAt: "2026-10-11T08:00:00Z",
    latestCommit: { sha, message: "Add dashboard brief", committedAt: "2026-10-11T07:50:00Z", url: `https://github.com/daniel/Workspace/commit/${sha}` },
  },
};

test("daily brief context limits to pinned projects and verified public commits", () => {
  const context = buildDailyBriefContext([project, { ...project, name: "Unpinned", isPinned: false }, { ...project, name: "Bad commit", githubData: { ...project.githubData, latestCommit: { ...project.githubData.latestCommit, sha: "bad" } } }]);
  assert.equal(context.length, 2);
  assert.equal(context[0].latestCommit.message, "Add dashboard brief");
  assert.equal(context[1].latestCommit, null);
  assert.equal(JSON.stringify(context).includes("D:\\private"), false);
  assert.match(buildDailyBriefPrompt(context), /recommendations/);
});

test("daily brief parser enforces project grounding and item evidence", () => {
  const parsed = parseDailyBriefResponse(JSON.stringify({
    completed: [{ project: "Workspace", text: "新增首页简报", basis: "Add dashboard brief · 2026-10-11" }],
    recommendations: [{ project: "Workspace", text: "检查移动端三栏折叠", basis: "首页新增简报区域" }],
    watch: [],
  }), [project]);
  assert.equal(parsed.completed.length, 1);
  assert.equal(parsed.recommendations[0].project, "Workspace");
  assert.deepEqual(parsed.watch, []);
  assert.throws(() => parseDailyBriefResponse(JSON.stringify({ completed: [{ project: "Other", text: "完成了", basis: "提交" }], recommendations: [], watch: [] }), [project]), /项目或依据/);
  assert.throws(() => parseDailyBriefResponse("not JSON", [project]), /无法识别/);
});
