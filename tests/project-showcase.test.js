import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { deployedWebsiteUrl, projectShowcase } from "../src/project-story.js";

const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");

test("website CTA uses only an explicit safe online URL and never a GitHub repository", () => {
  assert.equal(deployedWebsiteUrl({ url: "https://demo.example.org/app", github: "https://github.com/acme/source" }), "https://demo.example.org/app");
  for (const project of [
    { github: "https://github.com/acme/source" },
    { url: "https://github.com/acme/source" },
    { url: "javascript:alert(1)" },
    { url: "https://user:secret@demo.example.org" },
    { url: "http://localhost:4174" },
    { url: "http://127.0.0.1:4174" },
    { url: "http://192.168.1.12:4174" },
  ]) assert.equal(deployedWebsiteUrl(project), "");
});

test("curated project facts are purpose-specific and leave unknown project outcomes empty", () => {
  const hub = projectShowcase({ github: "https://github.com/danielsxujiacong-cell/daniel-project-hub" });
  assert.match(hub.purpose, /AI 产品、网站和实验作品/);
  assert.match(hub.features.join(" "), /采购流程回放/);
  assert.match(hub.outcomes.join(" "), /正常批准、审批拒绝和重复事件/);

  const unknown = projectShowcase({ description: "手工维护的项目用途" });
  assert.equal(unknown.purpose, "手工维护的项目用途");
  assert.deepEqual(unknown.features, []);
  assert.deepEqual(unknown.outcomes, []);
});

test("home and project cards have explicit detail and conditional experience actions", () => {
  const homeCards = app.slice(app.indexOf("function renderDashboardFocusProjects"), app.indexOf("function latestProjectCommit"));
  const projectCards = app.slice(app.indexOf("function renderProjects"), app.indexOf("function safeExternal"));
  assert.match(homeCards, /查看详情/);
  assert.match(homeCards, /website \? `.*体验网站/);
  assert.match(projectCards, /查看详情/);
  assert.match(projectCards, /website \? `.*体验网站/);
});

test("project details put reader-facing facts and grounded updates before collapsed technical details", () => {
  const details = app.slice(app.indexOf("function renderProjectDetail()"), app.indexOf("function renderLocalProjectDetail()"));
  const coreFeatures = details.indexOf("renderProjectShowcase(project)");
  const recentProgress = details.indexOf("renderProjectRecentProgress(project, localProject)");
  const technicalDetails = details.indexOf('<details class="technical-details">');
  assert.ok(coreFeatures >= 0 && recentProgress > coreFeatures && technicalDetails > recentProgress);
  assert.match(app, /<h3>核心功能<\/h3>/);
  assert.match(app, /<h3>已验证成果<\/h3>/);
  assert.match(details, /project-purpose-label">项目用途/);
  assert.match(details, /体验网站/);
  assert.doesNotMatch(details.slice(0, technicalDetails), /GitHub<\/a>|本机路径/);
});
