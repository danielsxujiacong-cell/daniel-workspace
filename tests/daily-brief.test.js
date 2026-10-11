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

test("daily brief context separates verified commits from the last 24 hours and days 1 to 7", () => {
  const now = Date.parse("2026-10-11T08:00:00Z");
  const commits = [
    { sha, message: "Commit within 24 hours", committedAt: "2026-10-11T07:50:00Z", url: `https://github.com/daniel/Workspace/commit/${sha}` },
    { sha, message: "Commit 3 days ago", committedAt: "2026-10-08T08:00:00Z", url: `https://github.com/daniel/Workspace/commit/${sha}` },
    { sha, message: "Commit 8 days ago", committedAt: "2026-10-03T08:00:00Z", url: `https://github.com/daniel/Workspace/commit/${sha}` },
    { sha, message: "Future commit", committedAt: "2026-10-12T08:00:00Z", url: `https://github.com/daniel/Workspace/commit/${sha}` },
    { sha: "bad", message: "Invalid SHA", committedAt: "2026-10-11T07:00:00Z", url: "https://github.com/daniel/Workspace/commit/bad" },
  ];
  const withHistory = { ...project, githubData: { ...project.githubData, recentCommits: commits } };
  const context = buildDailyBriefContext([withHistory, { ...project, name: "Unpinned", isPinned: false }], { now });
  assert.equal(context.length, 1);
  assert.deepEqual(context[0].commitsLast24Hours.map(({ message }) => message), ["Commit within 24 hours"]);
  assert.deepEqual(context[0].commitsDays1To7.map(({ message }) => message), ["Commit 3 days ago"]);
  assert.equal(JSON.stringify(context).includes("D:\\private"), false);
  const prompt = buildDailyBriefPrompt(context);
  assert.match(prompt, /24 小时/);
  assert.match(prompt, /1–7 天/);
  assert.match(prompt, /不要建议创建任务/);
  assert.match(prompt, /可验收结果/);
  assert.match(prompt, /逐字引用提交摘要/);
  const vagueNext = buildDailyBriefContext([{ ...project, next: "创建一个任务" }], { now });
  assert.equal(vagueNext[0].confirmedNextStep, "");
});

test("daily brief parser enforces project grounding and item evidence", () => {
  const context = buildDailyBriefContext([project], { now: Date.parse("2026-10-11T08:00:00Z") });
  const parsed = parseDailyBriefResponse(JSON.stringify({
    completed: [{ project: "Workspace", period: "last24Hours", text: "新增首页简报", basis: "Add dashboard brief · 2026-10-11T07:50:00Z" }],
    recommendations: [{ project: "Workspace", text: "检查移动端三栏折叠", acceptance: "窄屏下三部分均单列显示且无横向溢出", basis: "Add dashboard brief · 2026-10-11T07:50:00Z" }],
    watch: [],
  }), [project], context);
  assert.equal(parsed.completed.length, 1);
  assert.match(parsed.completed[0].text, /^过去 24 小时：/);
  assert.equal(parsed.recommendations[0].project, "Workspace");
  assert.match(parsed.recommendations[0].text, /验收：窄屏下/);
  assert.deepEqual(parsed.watch, []);
  assert.throws(() => parseDailyBriefResponse(JSON.stringify({ completed: [{ project: "Other", period: "last24Hours", text: "完成了", basis: "提交" }], recommendations: [], watch: [] }), [project], context), /项目或依据/);
  assert.throws(() => parseDailyBriefResponse("not JSON", [project]), /无法识别/);
  const vague = parseDailyBriefResponse(JSON.stringify({ completed: [], recommendations: [{ project: "Workspace", text: "创建一个任务", acceptance: "任务创建成功", basis: "旧 next_step" }], watch: [] }), [project], context);
  assert.deepEqual(vague.recommendations, []);
});
