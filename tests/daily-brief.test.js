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
  assert.equal(prompt.includes(JSON.stringify(context)), false);
  assert.match(prompt, /24 小时/);
  assert.match(prompt, /1–7 天/);
  assert.match(prompt, /不要建议创建任务/);
  assert.match(prompt, /可验收结果/);
  assert.match(prompt, /逐字引用摘要和 ISO 时间/);
  const vagueNext = buildDailyBriefContext([{ ...project, next: "创建一个任务" }], { now });
  assert.equal(vagueNext[0].confirmedNextStep, "");
});

test("daily brief parser enforces project grounding and item evidence", () => {
  const context = buildDailyBriefContext([project], { now: Date.parse("2026-10-11T08:00:00Z") });
  const parsed = parseDailyBriefResponse(JSON.stringify({
    completed: [{ project: "Workspace", period: "last24Hours", text: "新增首页简报", basis: "Add dashboard brief · 2026-10-11T07:50:00Z" }],
    recommendations: [{ project: "Workspace", text: "检查移动端三栏折叠", acceptance: "窄屏下三部分均单列显示且无横向溢出", basis: "Add dashboard brief · 2026-10-11T07:50:00Z" }],
    watch: [{ project: "Workspace", text: "检查下周计划", basis: "" }],
  }), [project], context);
  assert.equal(parsed.completed.length, 1);
  assert.match(parsed.completed[0].text, /^过去 24 小时：/);
  assert.equal(parsed.recommendations[0].project, "Workspace");
  assert.match(parsed.recommendations[0].text, /验收：窄屏下/);
  assert.deepEqual(parsed.watch, []);
  assert.throws(() => parseDailyBriefResponse(JSON.stringify({ completed: [{ project: "Other", period: "last24Hours", text: "完成了", basis: "提交" }], recommendations: [], watch: [] }), [project], context), /可验证项目依据/);
  assert.throws(() => parseDailyBriefResponse("not JSON", [project]), /无法识别/);
  assert.throws(() => parseDailyBriefResponse(JSON.stringify({ completed: [], recommendations: [{ project: "Workspace", text: "创建一个任务", acceptance: "任务创建成功", basis: "旧 next_step" }], watch: [] }), [project], context), /可验证项目依据/);
});

test("daily brief accepts Companion metadata without sending private commit text or paths", () => {
  const localProgressByProject = {
    p1: {
      branch: "feature/private-work",
      clean: false,
      committedAt: "2026-10-11T07:40:00Z",
      scannedAt: "2026-10-11T08:00:00Z",
      message: "PRIVATE COMMIT SUBJECT",
      path: "D:\\private\\repo",
      sha: "deadbeef",
    },
  };
  const context = buildDailyBriefContext([project], { now: Date.parse("2026-10-11T08:00:00Z"), localProgressByProject });
  assert.deepEqual(context[0].localProgress, {
    branch: "feature/private-work",
    clean: false,
    committedAt: "2026-10-11T07:40:00Z",
    commitPeriod: "last24Hours",
    scannedAt: "2026-10-11T08:00:00Z",
    source: "Local Companion",
  });
  assert.doesNotMatch(JSON.stringify(context), /PRIVATE COMMIT SUBJECT|D:\\private\\repo|deadbeef/);
  const answer = {
    completed: [{ project: "Workspace", period: "last24Hours", text: "本机出现新提交", basis: "本机 Companion · feature/private-work · 有未提交修改 · 2026-10-11T07:40:00Z · 2026-10-11T08:00:00Z" }],
    recommendations: [],
    watch: [],
  };
  const parsed = parseDailyBriefResponse(JSON.stringify(answer), [project], context);
  assert.equal(parsed.completed.length, 1);
  assert.match(buildDailyBriefPrompt(context), /不含提交说明、代码、路径或仓库 URL/);
  const older = buildDailyBriefContext([project], {
    now: Date.parse("2026-10-11T08:00:00Z"),
    localProgressByProject: { p1: { ...localProgressByProject.p1, committedAt: "2026-10-01T08:00:00Z" } },
  });
  assert.equal(older[0].localProgress.commitPeriod, "outsideWindow");
  assert.throws(() => parseDailyBriefResponse(JSON.stringify(answer), [project], older), /可验证项目依据/);
});

test("daily brief accepts a fresh private GitHub App snapshot as commit evidence", () => {
  const privateProject = {
    ...project,
    githubData: {
      source: "github-app", isPublic: false, repositoryName: "daniel/Workspace", defaultBranch: "main",
      refreshedAt: "2026-10-11T08:00:00Z", recentSevenDayCommitCount: 1,
      latestCommit: { sha, message: "Private workspace improvement", committedAt: "2026-10-11T07:50:00Z", url: `https://github.com/daniel/Workspace/commit/${sha}` },
    },
  };
  const context = buildDailyBriefContext([privateProject], { now: Date.parse("2026-10-11T08:00:00Z") });
  assert.equal(context[0].githubBranch, "main");
  assert.equal(context[0].commitsLast24Hours[0].message, "Private workspace improvement");
  const answer = JSON.stringify({ completed: [{ project: project.name, period: "last24Hours", text: "完善私人工作台", basis: "Private workspace improvement · 2026-10-11T07:50:00Z" }], recommendations: [], watch: [] });
  assert.equal(parseDailyBriefResponse(answer, [privateProject], context).completed.length, 1);
});
