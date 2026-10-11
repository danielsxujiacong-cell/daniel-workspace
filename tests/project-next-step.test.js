import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import worker from "../cloudflare/worker.js";
import { buildProjectNextStepContext, buildProjectNextStepPrompt, parseProjectNextStepResponse, verifiedProjectGitHubCommit } from "../src/ai/project-next-step.js";
import { chat, getAIStatus } from "../src/ai/service.js";

const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");

function projectWithGitHubSnapshot() {
  const sha = "abcdef0123456789abcdef0123456789abcdef01";
  return {
    name: "Daniel Workspace",
    description: "Authenticated personal workspace for managing projects, tasks, decisions, and notes.",
    status: "进行中",
    stage: "V3.3",
    next: "验证项目建议功能",
    github: "https://github.com/daniel/Workspace",
    githubData: {
      repositoryName: "daniel/Workspace",
      isPublic: true,
      refreshedAt: new Date().toISOString(),
      recentSevenDayCommitCount: 2,
      latestCommit: {
        sha: sha.slice(0, 7),
        url: `https://github.com/daniel/Workspace/commit/${sha}`,
        message: "Add project next-step suggestions",
        committedAt: "2026-10-11T08:30:00Z",
      },
    },
  };
}

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

test("partial project data stops generation instead of allowing a generic suggestion", () => {
  const result = buildProjectNextStepContext({
    project: { name: "Partial", description: "A short but real project brief" },
    tasks: [{ title: "Verify the next release", status: "todo" }],
  });
  assert.equal(result.hasEvidence, false);
  assert.deepEqual(result.missing, ["没有可验证的公开 GitHub 最近提交"]);
});

test("verifies the real GitHub commit when its URL uses full SHA and its snapshot stores seven characters", () => {
  const project = projectWithGitHubSnapshot();
  const commit = verifiedProjectGitHubCommit(project);
  assert.equal(commit?.message, "Add project next-step suggestions");
  assert.equal(commit?.committedAt, "2026-10-11T08:30:00Z");
  assert.equal(commit?.fresh, true);

  const context = buildProjectNextStepContext({
    project,
    tasks: [{ title: "Add focused suggestion regression coverage", status: "todo", priority: "高", due: "本周" }],
    githubCommit: commit,
    githubFresh: commit?.fresh,
  });
  assert.equal(context.hasEvidence, true);
  assert.equal(context.context.github.latestCommitMessage, "Add project next-step suggestions");
  assert.equal(context.context.github.committedAt, "2026-10-11T08:30:00Z");
  assert.equal(context.context.project.description, project.description);
  assert.equal(context.context.tasks[0].title, "Add focused suggestion regression coverage");
});

test("project description and verified recent commit are sufficient without associated tasks", () => {
  const project = projectWithGitHubSnapshot();
  const commit = verifiedProjectGitHubCommit(project);
  const context = buildProjectNextStepContext({ project, tasks: [], githubCommit: commit, githubFresh: commit?.fresh });

  assert.equal(context.hasEvidence, true);
  assert.deepEqual(context.missing, ["当前项目没有关联任务"]);
  assert.equal(context.context.tasks.length, 0);
  assert.equal(context.context.github.latestCommitMessage, "Add project next-step suggestions");
  assert.match(buildProjectNextStepPrompt(), /tasks 仅作补充，列表为空时绝不能仅因此返回资料不足/);
  assert.match(buildProjectNextStepPrompt(), /紧扣最近 Commit 摘要所述的真实功能或修复/);
});

test("rejects a GitHub commit URL whose SHA does not match the snapshot", () => {
  const project = projectWithGitHubSnapshot();
  project.githubData.latestCommit.url = "https://github.com/daniel/Workspace/commit/1234567890123456789012345678901234567890";
  assert.equal(verifiedProjectGitHubCommit(project), null);
});

test("project description, verified commit and tasks reach the configured GLM model request", async () => {
  const project = projectWithGitHubSnapshot();
  const task = { title: "Add focused suggestion regression coverage", status: "todo", priority: "高", due: "本周" };
  const commit = verifiedProjectGitHubCommit(project);
  const context = buildProjectNextStepContext({ project, tasks: [task], githubCommit: commit, githubFresh: true });
  const workerUrl = "https://daniel-workspace-api.ai-investment-dashboard.workers.dev/api/chat";
  const upstreamUrl = "https://glm.test/v4/chat/completions";
  let upstreamRequest;
  const previousFetch = globalThis.fetch;
  const previousConfig = globalThis.DANIEL_AI_CONFIG;
  globalThis.DANIEL_AI_CONFIG = { provider: "real", chatEndpoint: workerUrl, model: "glm-4-flash-250414" };
  globalThis.fetch = async (input, init = {}) => {
    if (String(input) === workerUrl) {
      const headers = new Headers(init.headers);
      headers.set("Origin", "https://workspace.danielxu.cn");
      return worker.fetch(new Request(String(input), { ...init, headers }), {
        AI_BASE_URL: "https://glm.test/v4",
        AI_MODEL: "glm-4-flash-250414",
        AI_API_KEY: "test-only-not-a-real-key",
        ALLOWED_ORIGINS: "https://workspace.danielxu.cn",
      });
    }
    assert.equal(String(input), upstreamUrl);
    upstreamRequest = JSON.parse(init.body);
    return new Response(JSON.stringify({
      model: "glm-4-flash-250414",
      choices: [{ message: { role: "assistant", content: '{"suggestion":"为项目建议功能补齐验收用例，并检查无任务/无提交时明确阻止生成。","rationale":"最近提交 Add project next-step suggestions（2026-10-11）；现有关联任务要求增加回归覆盖。"}' } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    assert.equal(getAIStatus().mode, "real");
    const result = await chat({
      message: "请给出基于项目真实资料的下一步。",
      currentPage: "project-next-step",
      currentProject: { name: project.name },
      relevantContext: { projectNextStep: context.context },
      history: [],
    }, workerUrl);
    assert.equal(result.provider, "real");
    assert.equal(result.model, "glm-4-flash-250414");
    assert.equal(upstreamRequest.model, "glm-4-flash-250414");
    assert.equal(upstreamRequest.messages[0].role, "system");
    const contextMessage = upstreamRequest.messages.find((item) => item.content.startsWith("Workspace Context JSON"));
    assert.ok(contextMessage);
    const modelContext = JSON.parse(contextMessage.content.slice(contextMessage.content.indexOf("\n") + 1));
    assert.equal(modelContext.currentPage, "project-next-step");
    assert.equal(modelContext.currentProject.name, project.name);
    const sent = modelContext.relevantContext.projectNextStep;
    assert.equal(sent.project.description, project.description);
    assert.equal(sent.github.latestCommitMessage, "Add project next-step suggestions");
    assert.equal(sent.github.committedAt, "2026-10-11T08:30:00Z");
    assert.equal(sent.tasks[0].title, task.title);
    assert.equal(result.message.content.includes("为项目建议功能补齐验收用例"), true);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousConfig === undefined) delete globalThis.DANIEL_AI_CONFIG;
    else globalThis.DANIEL_AI_CONFIG = previousConfig;
  }
});

test("no-task context reaches GLM and its concrete JSON response parses successfully", async () => {
  const project = projectWithGitHubSnapshot();
  const commit = verifiedProjectGitHubCommit(project);
  const context = buildProjectNextStepContext({ project, tasks: [], githubCommit: commit, githubFresh: true });
  const workerUrl = "https://daniel-workspace-api.ai-investment-dashboard.workers.dev/api/chat";
  const upstreamUrl = "https://glm.test/v4/chat/completions";
  const previousFetch = globalThis.fetch;
  const previousConfig = globalThis.DANIEL_AI_CONFIG;
  globalThis.DANIEL_AI_CONFIG = { provider: "real", chatEndpoint: workerUrl, model: "glm-4-flash-250414" };
  let upstreamRequest;
  globalThis.fetch = async (input, init = {}) => {
    if (String(input) === workerUrl) {
      const headers = new Headers(init.headers);
      headers.set("Origin", "https://workspace.danielxu.cn");
      return worker.fetch(new Request(String(input), { ...init, headers }), {
        AI_BASE_URL: "https://glm.test/v4",
        AI_MODEL: "glm-4-flash-250414",
        AI_API_KEY: "test-only-not-a-real-key",
        ALLOWED_ORIGINS: "https://workspace.danielxu.cn",
      });
    }
    assert.equal(String(input), upstreamUrl);
    upstreamRequest = JSON.parse(init.body);
    return new Response(JSON.stringify({
      model: "glm-4-flash-250414",
      choices: [{ message: { role: "assistant", content: '{"suggestion":"为项目建议功能增加一次无关联任务场景的回归验证，确认简介和最近提交仍能生成基于功能的可检查建议。","rationale":"最近提交 Add project next-step suggestions（2026-10-11T08:30:00Z）新增建议能力；项目简介定位于管理项目、任务和决策，因此验证该功能在没有关联任务时仍能给出有依据的建议。"}' } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const result = await chat({
      message: buildProjectNextStepPrompt(),
      currentPage: "project-next-step",
      currentProject: { name: project.name },
      relevantContext: { projectNextStep: context.context },
      history: [],
    });
    assert.equal(result.provider, "real");
    const contextMessage = upstreamRequest.messages.find((item) => item.content.startsWith("Workspace Context JSON"));
    const modelContext = JSON.parse(contextMessage.content.slice(contextMessage.content.indexOf("\n") + 1));
    const sent = modelContext.relevantContext.projectNextStep;
    assert.equal(sent.project.description, project.description);
    assert.equal(sent.github.latestCommitMessage, "Add project next-step suggestions");
    assert.equal(sent.github.committedAt, "2026-10-11T08:30:00Z");
    assert.deepEqual(sent.tasks, []);
    assert.match(upstreamRequest.messages.at(-1).content, /tasks 仅作补充/);
    assert.deepEqual(parseProjectNextStepResponse(result.message.content), {
      suggestion: "为项目建议功能增加一次无关联任务场景的回归验证，确认简介和最近提交仍能生成基于功能的可检查建议。",
      rationale: "最近提交 Add project next-step suggestions（2026-10-11T08:30:00Z）新增建议能力；项目简介定位于管理项目、任务和决策，因此验证该功能在没有关联任务时仍能给出有依据的建议。",
      insufficient: false,
    });
  } finally {
    globalThis.fetch = previousFetch;
    if (previousConfig === undefined) delete globalThis.DANIEL_AI_CONFIG;
    else globalThis.DANIEL_AI_CONFIG = previousConfig;
  }
});

test("configured Worker failures preserve the actual response message, code and status", async () => {
  const workerUrl = "https://daniel-workspace-api.ai-investment-dashboard.workers.dev/api/chat";
  const previousFetch = globalThis.fetch;
  const previousConfig = globalThis.DANIEL_AI_CONFIG;
  globalThis.DANIEL_AI_CONFIG = { provider: "real", chatEndpoint: workerUrl, model: "glm-4-flash-250414" };
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: { code: "ai_upstream_rejected", message: "Worker 返回的具体错误详情。" },
    provider: "real",
  }), { status: 502, headers: { "Content-Type": "application/json" } });

  try {
    await assert.rejects(chat({ message: "test", relevantContext: {} }), (error) => {
      assert.equal(error.message, "Worker 返回的具体错误详情。");
      assert.equal(error.code, "ai_upstream_rejected");
      assert.equal(error.status, 502);
      return true;
    });
  } finally {
    globalThis.fetch = previousFetch;
    if (previousConfig === undefined) delete globalThis.DANIEL_AI_CONFIG;
    else globalThis.DANIEL_AI_CONFIG = previousConfig;
  }
});

test("project next-step response accepts strict JSON or a fenced JSON block", () => {
  assert.deepEqual(parseProjectNextStepResponse('{"suggestion":"核对移动端布局","rationale":"项目简介要求适配移动端。"}'), {
    suggestion: "核对移动端布局",
    rationale: "项目简介要求适配移动端。",
    insufficient: false,
  });
  assert.equal(parseProjectNextStepResponse('```json\n{"suggestion":"补齐验收步骤","rationale":"已有任务提到发布前检查。"}\n```').suggestion, "补齐验收步骤");
});

test("malformed or incomplete AI output is rejected", () => {
  assert.throws(() => parseProjectNextStepResponse("not json"), /JSON/);
  assert.throws(() => parseProjectNextStepResponse('{"suggestion":"写验收步骤"}'), /缺少/);
  assert.deepEqual(parseProjectNextStepResponse('{"suggestion":"","rationale":"资料不足：没有关联任务。"}'), {
    suggestion: "",
    rationale: "资料不足：没有关联任务。",
    insufficient: true,
  });
});

test("generation and editing stay in page state; only the adopt action persists the project change", () => {
  const generate = app.slice(app.indexOf("async function generateProjectNextStep("), app.indexOf("function adoptProjectNextStep("));
  const adopt = app.slice(app.indexOf("function adoptProjectNextStep("), app.indexOf("function renderProjectDetail("));
  const input = app.slice(app.indexOf('app.addEventListener("input"'), app.indexOf('app.addEventListener("focusin"'));

  assert.match(generate, /getAIStatus\(\)\.mode !== "real"/);
  assert.match(generate, /result\.provider !== "real"/);
  assert.match(generate, /currentPage: "project-next-step"/);
  assert.match(generate, /relevantContext: \{ projectNextStep: context\.context \}/);
  assert.match(generate, /message: buildProjectNextStepPrompt\(\)/);
  assert.match(generate, /taskOnlyReason/);
  assert.match(generate, /error\.message/);
  assert.match(generate, /parseProjectNextStepResponse\(result\.message\?\.content\)/);
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
