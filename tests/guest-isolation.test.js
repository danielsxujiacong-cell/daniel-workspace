import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolveEntryMode, shouldRestoreExistingSession } from "../src/auth/entry-mode.js";
import { mountGuestDemo } from "../src/guest-demo.js";

const gate = await readFile(new URL("../src/auth/gate.js", import.meta.url), "utf8");
const guest = await readFile(new URL("../src/guest-demo.js", import.meta.url), "utf8");
const index = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("existing sessions never auto-open from the root; only the explicit private entry restores one", () => {
  assert.equal(resolveEntryMode(""), "public");
  assert.equal(resolveEntryMode("?mode=guest"), "public");
  assert.equal(resolveEntryMode("?mode=login"), "login");
  assert.equal(resolveEntryMode("?mode=demo"), "demo");
  assert.equal(resolveEntryMode("?unrelated=1"), "public");
  assert.equal(shouldRestoreExistingSession("public", true), false);
  assert.equal(shouldRestoreExistingSession("login", false), false);
  assert.equal(shouldRestoreExistingSession("login", true), true);
  assert.match(gate, /if \(entryMode === "demo"\)[\s\S]*?void startGuestDemo\(\);[\s\S]*?else if \(entryMode === "login"\)[\s\S]*?startPrivateEntry\(\);[\s\S]*?else \{\s*void startPublicDashboard\(\);/);
  assert.match(gate, /function startPrivateEntry\(\)[\s\S]*?showLogin\(\)[\s\S]*?shouldRestoreExistingSession\(entryMode, hasStoredAuthSession\(\)\)[\s\S]*?restoreExistingSession\(\)/);
  assert.match(gate, /async function startPublicDashboard\(\)[\s\S]*?await import\("\.\.\/app\.js\?v=4\.0\.1"\)[\s\S]*?catch[\s\S]*?startup-failure/);
  const publicStartup = gate.slice(gate.indexOf("async function startPublicDashboard"), gate.indexOf("function startPrivateEntry"));
  assert.ok(publicStartup.indexOf('await import("../app.js?v=4.0.1")') < publicStartup.indexOf("void snapshotPromise.then"));
  assert.doesNotMatch(publicStartup, /await\s+snapshotPromise/);
  assert.doesNotMatch(publicStartup, /hasStoredAuthSession|restoreExistingSession|initializeAuthClient|localStorage|config\.js/);
  assert.match(index, /class="startup-screen"[\s\S]*?正在打开公开项目指挥中心/);
  assert.doesNotMatch(gate, /import\s*\{[^}]*SUPABASE_[^}]*\}\s*from\s*["']\.\/config\.js["']/);
  assert.match(gate, /function getSupabaseConfig\(\)[\s\S]*?import\("\.\/config\.js"\)/);
});

test("logout clears stored auth before reopening the public root; refreshing the root cannot redirect to private mode", () => {
  const logoutFlow = gate.slice(gate.indexOf("async function handleLogout"), gate.indexOf('app.addEventListener("submit"'));
  assert.ok(logoutFlow.indexOf("clearAuthSessionStorage()") < logoutFlow.indexOf('client.auth.signOut({ scope: "local" })'));
  assert.match(logoutFlow, /window\.location\.replace\(window\.location\.pathname\)/);
  assert.doesNotMatch(logoutFlow, /mode=login/);
  assert.equal(shouldRestoreExistingSession(resolveEntryMode(""), false), false);
  assert.equal(shouldRestoreExistingSession(resolveEntryMode(""), true), false);
});

test("fresh visitors and saved-session root refreshes both remain public; explicit login refresh restores only after user validation", () => {
  const rootRoute = resolveEntryMode("");
  const explicitPrivateRoute = resolveEntryMode("?mode=login");
  assert.equal(shouldRestoreExistingSession(rootRoute, false), false);
  assert.equal(shouldRestoreExistingSession(rootRoute, true), false);
  assert.equal(shouldRestoreExistingSession(explicitPrivateRoute, false), false);
  assert.equal(shouldRestoreExistingSession(explicitPrivateRoute, true), true);

  const privateEntry = gate.slice(gate.indexOf("function startPrivateEntry"), gate.lastIndexOf('if (entryMode === "demo")'));
  assert.match(privateEntry, /showLogin\(\)[\s\S]*?shouldRestoreExistingSession\(entryMode, hasStoredAuthSession\(\)\)[\s\S]*?restoreExistingSession\(\)/);
  assert.doesNotMatch(privateEntry, /location\.replace/);
  const authRestore = gate.slice(gate.indexOf("async function restoreExistingSession"), gate.indexOf("async function startGuestDemo"));
  assert.ok(authRestore.indexOf("client.auth.getUser()") < authRestore.indexOf("isAllowedUser(user)") && authRestore.indexOf("isAllowedUser(user)") < authRestore.indexOf("enterWorkspace(user)"));
  const workspaceEntry = gate.slice(gate.indexOf("async function enterWorkspace"), gate.indexOf("function lockWorkspace"));
  assert.match(workspaceEntry, /if \(workspaceEntryPromise\) return workspaceEntryPromise/);
});

test("visitor UI has no imports or private data and service interfaces", () => {
  assert.doesNotMatch(guest, /\bimport\s*(?:\(|\{)/);
  assert.doesNotMatch(guest, /\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/);
  assert.doesNotMatch(guest, /\b(?:localStorage|sessionStorage|indexedDB)\b/);
  assert.doesNotMatch(guest, /127\.0\.0\.1|\/api\/|DANIEL_WORKSPACE_AUTH|supabase-js|AI_API_KEY|action_runner|local_companion/i);
  assert.doesNotMatch(guest, /github\.com|workspace\.danielxu\.cn|invest\.danielxu\.cn|D:\\\\_Codex project/i);
  assert.match(guest, /不读取私人工作台、账号资料或本机项目/);
  assert.match(guest, /https:\/\/hub\.danielxu\.cn\/flowops/);
  assert.match(guest, /https:\/\/danielxu\.cn\//);
  assert.match(guest, /function mountGuestDemo/);
});

test("public entry loads only the gate module", () => {
  const scripts = [...index.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)].map((match) => match[1]);
  assert.deepEqual(scripts, ["./src/auth/gate.js?v=4.0.1"]);
});

test("private login still signs in, verifies the user, and checks the allowlist before opening app", () => {
  assert.match(gate, /name="email" type="email"[\s\S]*name="password" type="password"[\s\S]*>登录<\/button>/);
  const loginFlow = gate.slice(gate.indexOf("async function handleLogin"), gate.indexOf("async function handleLogout"));
  const signInAt = loginFlow.indexOf("signInWithPassword");
  const getUserAt = loginFlow.indexOf("client.auth.getUser()");
  const allowlistAt = loginFlow.indexOf("isAllowedUser(user)");
  const workspaceAt = loginFlow.indexOf("enterWorkspace(user)");
  assert.ok(signInAt >= 0 && signInAt < getUserAt && getUserAt < allowlistAt && allowlistAt < workspaceAt);
  assert.match(gate, /async function enterWorkspace\(user\)\s*\{\s*if \(workspaceVisible\) return;\s*if \(!isAllowedUser\(user\)\) throw new Error\("Unauthorized user"\);[\s\S]*?import\("\.\.\/app\.js\?v=4\.0\.1"\)/);

  const sessionRestore = gate.slice(gate.indexOf("async function restoreExistingSession"), gate.indexOf("async function startGuestDemo"));
  const getSessionAt = sessionRestore.indexOf("client.auth.getSession()");
  const restoreUserAt = sessionRestore.indexOf("client.auth.getUser()");
  const restoreAllowlistAt = sessionRestore.indexOf("isAllowedUser(user)");
  const restoreWorkspaceAt = sessionRestore.indexOf("enterWorkspace(user)");
  assert.ok(getSessionAt >= 0 && getSessionAt < restoreUserAt && restoreUserAt < restoreAllowlistAt && restoreAllowlistAt < restoreWorkspaceAt);
});

function createGuestRoot() {
  const listeners = {};
  return {
    innerHTML: "",
    addEventListener(type, listener) { listeners[type] = listener; },
    replaceChildren() { this.innerHTML = ""; },
    clickAction(action, extra = {}) {
      listeners.click({ target: { closest: (selector) => selector === "[data-guest-action]" ? { dataset: { guestAction: action, projectId: extra.projectId } } : selector === "[data-filter]" && extra.filter ? { dataset: { filter: extra.filter } } : null } });
    },
    clickPage(page) {
      listeners.click({ target: { closest: (selector) => selector === "[data-guest-page]" ? { dataset: { guestPage: page } } : null } });
    },
    chooseSolution(value) {
      listeners.change({ target: { name: "guest-ticket-solution", value } });
    },
  };
}

test("visitor portfolio details use public demos while TK-1001 stays an isolated in-memory simulation", () => {
  const root = createGuestRoot();
  const secondSession = createGuestRoot();
  let exited = false;
  mountGuestDemo({ root, onExit: () => { exited = true; } });
  mountGuestDemo({ root: secondSession, onExit() {} });

  assert.match(root.innerHTML, /把想法做成可体验的产品/);
  assert.match(root.innerHTML, /Daniel Project Hub/);
  assert.match(root.innerHTML, /https:\/\/hub\.danielxu\.cn\//);
  assert.match(root.innerHTML, /隐私说明/);
  assert.match(root.innerHTML, /异常发现[\s\S]*规则判断[\s\S]*SOP[\s\S]*决策[\s\S]*完成/);
  assert.match(root.innerHTML, /data-guest-action="view-ticket"[\s\S]*体验流程演示/);
  assert.doesNotMatch(root.innerHTML, /class="guest-tour"/);
  assert.match(root.innerHTML, /data-guest-action="start-tour">开始导航/);

  root.clickPage("projects");
  assert.match(root.innerHTML, /查看项目用途、已验证成果和线上体验入口/);
  assert.match(root.innerHTML, /查看详情[\s\S]*体验网站/);
  root.clickAction("view-project", { projectId: "flowops" });
  assert.match(root.innerHTML, /FlowOps AI/);
  assert.match(root.innerHTML, /正常批准、审批拒绝和重复事件/);
  assert.match(root.innerHTML, /href="https:\/\/hub\.danielxu\.cn\/flowops"/);
  assert.match(root.innerHTML, /不代表真实客户或生产环境/);
  root.clickAction("back-projects");

  root.clickAction("start-tour");
  assert.match(root.innerHTML, /class="guest-tour"/);
  root.clickAction("skip-tour");
  root.clickAction("view-ticket");
  assert.match(root.innerHTML, /TK-1001/);
  assert.match(root.innerHTML, /规则优先级建议[\s\S]*P1 · 高优先级/);
  assert.match(root.innerHTML, /<fieldset class="guest-ticket-options" disabled>/);

  root.clickAction("open-sop");
  assert.match(root.innerHTML, /SOP：供应商交期异常升级处置/);
  assert.match(root.innerHTML, /TK-1001 关联 SOP/);
  root.clickAction("return-ticket");
  assert.match(root.innerHTML, /<fieldset class="guest-ticket-options">/);

  root.chooseSolution("alternate-supplier");
  assert.match(root.innerHTML, /启用已认证备选供应商/);
  root.clickAction("generate-decision");
  assert.match(root.innerHTML, /已生成模拟 Decision/);
  assert.match(root.innerHTML, /启用已认证备选供应商/);
  root.clickPage("decisions");
  assert.match(root.innerHTML, /TK-1001：供应商交期异常处置/);
  assert.match(root.innerHTML, /访客模拟 · TK-1001/);

  root.clickPage("tasks");
  root.clickAction("view-ticket");
  assert.match(root.innerHTML, /data-guest-action="complete-ticket"/);
  root.clickAction("complete-ticket");
  assert.match(root.innerHTML, /工单已完成/);
  root.clickAction("filter-tasks", { filter: "done" });
  assert.match(root.innerHTML, /TK-1001 · 供应商交期异常升级处理[\s\S]*已完成/);

  root.clickPage("home");
  root.clickPage("tasks");
  secondSession.clickPage("tasks");
  assert.match(root.innerHTML, /<span class="nav-count">4<\/span>/);
  assert.match(secondSession.innerHTML, /<span class="nav-count">5<\/span>/);
  assert.match(root.innerHTML, /工单、任务、负责人和日期均为虚构样例/);

  root.clickAction("reset");
  root.clickPage("tasks");
  assert.match(root.innerHTML, /<span class="nav-count">5<\/span>/);
  assert.doesNotMatch(root.innerHTML, /class="guest-tour"/);
  root.clickPage("decisions");
  assert.doesNotMatch(root.innerHTML, /TK-1001：供应商交期异常处置/);
  root.clickAction("exit");
  assert.equal(exited, true);
  assert.equal(root.innerHTML, "");
});
