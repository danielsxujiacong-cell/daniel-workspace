import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildProjectNextStepContext, parseProjectNextStepResponse } from "../src/ai/project-next-step.js";

const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");

test("project next-step context contains only bounded project, task and verified commit text", () => {
  const result = buildProjectNextStepContext({
    project: {
      id: "p-1", name: "Workspace", description: "Ship a small dashboard", status: "进行中",
      stage: "V3.3", next: "Review the layout", path: "D:\\private", github: "https://github.com/x/y",
    },
    tasks: [{ title: "Check mobile layout", status: "todo", priority: "高", due: "周五", description: "private task body", projectId: "p-1" }],
    githubCommit: { repositoryName: "x/y", message: "Polish dashboard cards", committedAt: "2026-10-10T10:00:00Z", refreshedAt: "2026-10-10T10:01:00Z", sha: "abcdef0", url: "https://github.com/x/y/commit/abcdef0" },
    githubFresh: true,
  });

  assert.equal(result.hasEvidence, true);
  assert.deepEqual(result.missing, []);
  assert.equal(result.context.github.latestCommitMessage, "Polish dashboard cards");
  assert.equal(result.context.tasks[0].title, "Check mobile layout");
  assert.equal(result.context.project.currentNextStep, "Review the layout");
  const serialized = JSON.stringify(result.context);
  for (const privateValue of ["D:\\private", "private task body", "abcdef0", "github.com"]) assert.equal(serialized.includes(privateValue), false);
});

test("missing project sources are explicit and an empty project does not trigger an AI suggestion", () => {
  const result = buildProjectNextStepContext({ project: { name: "Empty project" }, tasks: [] });
  assert.equal(result.hasEvidence, false);
  assert.deepEqual(result.missing, ["项目简介未填写", "没有可验证的公开 GitHub 最近提交", "当前项目没有关联任务"]);
  assert.deepEqual(result.context.github, { available: false });
});

test("project next-step response accepts strict JSON or a fenced JSON block", () => {
  assert.deepEqual(parseProjectNextStepResponse('{"suggestion":"核对移动端布局","rationale":"项目简介要求适配移动端。"}'), {
    suggestion: "核对移动端布局",
    rationale: "项目简介要求适配移动端。",
  });
  assert.equal(parseProjectNextStepResponse('```json\n{"suggestion":"补齐验收步骤","rationale":"已有任务提到发布前检查。"}\n```').suggestion, "补齐验收步骤");
});

test("malformed or incomplete AI output is rejected", () => {
  assert.throws(() => parseProjectNextStepResponse("not json"), /JSON/);
  assert.throws(() => parseProjectNextStepResponse('{"suggestion":"写验收步骤"}'), /缺少/);
});

test("generation and editing stay in page state; only the adopt action persists the project change", () => {
  const generate = app.slice(app.indexOf("async function generateProjectNextStep("), app.indexOf("function adoptProjectNextStep("));
  const adopt = app.slice(app.indexOf("function adoptProjectNextStep("), app.indexOf("function renderProjectDetail("));
  const input = app.slice(app.indexOf('app.addEventListener("input"'), app.indexOf('app.addEventListener("focusin"'));

  assert.match(generate, /getAIStatus\(\)\.mode !== "real"/);
  assert.match(generate, /result\.provider !== "real"/);
  assert.doesNotMatch(generate, /\bpersist\s*\(|saveCloudChanges\s*\(/);
  assert.match(input, /state\.suggestion = event\.target\.value\.slice\(0, 500\)/);
  assert.match(input, /button\.textContent = state\.adopted \? \(unchanged \? "已采纳" : "采纳修改"\)/);
  assert.doesNotMatch(input, /\bpersist\s*\(/);
  assert.match(adopt, /project\.next = next/);
  assert.match(adopt, /persist\(\)/);
  assert.match(app, /action === "adopt-project-next-step"\) \{ adoptProjectNextStep\(id\); return; \}/);
});

test("logout clears the in-memory project next-step draft", () => {
  const clear = app.slice(app.indexOf("export function clearPrivateWorkspace()"), app.indexOf("function logActivity("));
  assert.match(clear, /ui\.projectNextStep = null/);
});
