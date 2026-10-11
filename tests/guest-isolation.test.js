import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolveEntryMode } from "../src/auth/entry-mode.js";
import { mountGuestDemo } from "../src/guest-demo.js";

const gate = await readFile(new URL("../src/auth/gate.js", import.meta.url), "utf8");
const guest = await readFile(new URL("../src/guest-demo.js", import.meta.url), "utf8");
const index = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("guest and explicit-login routes skip session restoration", () => {
  assert.equal(resolveEntryMode("?mode=guest"), "guest");
  assert.equal(resolveEntryMode("?mode=login"), "login");
  assert.equal(resolveEntryMode("?unrelated=1"), "auth");
  assert.match(gate, /if \(entryMode === "guest"\)[\s\S]*?void startGuestDemo\(\);[\s\S]*?else if \(entryMode === "login"\)[\s\S]*?showLogin\(\);[\s\S]*?else \{\s*void boot\(\);/);
  assert.ok(gate.indexOf('if (entryMode === "guest")') < gate.lastIndexOf("void boot()"));
  assert.doesNotMatch(gate, /import\s*\{[^}]*SUPABASE_[^}]*\}\s*from\s*["']\.\/config\.js["']/);
  assert.match(gate, /function getSupabaseConfig\(\)[\s\S]*?import\("\.\/config\.js"\)/);
});

test("visitor UI has no imports or private data and service interfaces", () => {
  assert.doesNotMatch(guest, /\bimport\s*(?:\(|\{)/);
  assert.doesNotMatch(guest, /\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/);
  assert.doesNotMatch(guest, /\b(?:localStorage|sessionStorage|indexedDB)\b/);
  assert.doesNotMatch(guest, /127\.0\.0\.1|\/api\/|DANIEL_WORKSPACE_AUTH|supabase-js|AI_API_KEY|action_runner|local_companion/i);
  assert.match(guest, /远岚科技集团/);
  assert.match(guest, /function mountGuestDemo/);
});

test("public entry loads only the gate module", () => {
  const scripts = [...index.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)].map((match) => match[1]);
  assert.deepEqual(scripts, ["./src/auth/gate.js?v=3.3.1"]);
});

test("private login still signs in, verifies the user, and checks the allowlist before opening app", () => {
  assert.match(gate, /name="email" type="email"[\s\S]*name="password" type="password"[\s\S]*>登录<\/button>/);
  const loginFlow = gate.slice(gate.indexOf("async function handleLogin"), gate.indexOf("async function handleLogout"));
  const signInAt = loginFlow.indexOf("signInWithPassword");
  const getUserAt = loginFlow.indexOf("client.auth.getUser()");
  const allowlistAt = loginFlow.indexOf("isAllowedUser(user)");
  const workspaceAt = loginFlow.indexOf("enterWorkspace(user)");
  assert.ok(signInAt >= 0 && signInAt < getUserAt && getUserAt < allowlistAt && allowlistAt < workspaceAt);
  assert.match(gate, /async function enterWorkspace\(user\)\s*\{\s*if \(workspaceVisible\) return;\s*if \(!isAllowedUser\(user\)\) throw new Error\("Unauthorized user"\);[\s\S]*?import\("\.\.\/app\.js\?v=3\.4\.0"\)/);

  const sessionRestore = gate.slice(gate.indexOf("async function boot"), gate.indexOf("async function startGuestDemo"));
  const getSessionAt = sessionRestore.indexOf("authClient.auth.getSession()");
  const restoreUserAt = sessionRestore.indexOf("authClient.auth.getUser()");
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
      listeners.click({ target: { closest: (selector) => selector === "[data-guest-action]" ? { dataset: { guestAction: action } } : selector === "[data-filter]" && extra.filter ? { dataset: { filter: extra.filter } } : null } });
    },
    clickPage(page) {
      listeners.click({ target: { closest: (selector) => selector === "[data-guest-page]" ? { dataset: { guestPage: page } } : null } });
    },
    chooseSolution(value) {
      listeners.change({ target: { name: "guest-ticket-solution", value } });
    },
  };
}

test("TK-1001 flow links rule, SOP, simulated Decision, completion, live stats, and reset in session memory", () => {
  const root = createGuestRoot();
  const secondSession = createGuestRoot();
  let exited = false;
  mountGuestDemo({ root, onExit: () => { exited = true; } });
  mountGuestDemo({ root: secondSession, onExit() {} });

  assert.match(root.innerHTML, /企业 AI 自动化工作台/);
  assert.match(root.innerHTML, /异常处理，从发现到闭环/);
  assert.match(root.innerHTML, /固定规则驱动，不调用真实 AI；内容为模拟数据，不代表真实企业案例/);
  assert.match(root.innerHTML, /异常发现[\s\S]*规则判断[\s\S]*SOP[\s\S]*决策[\s\S]*完成/);
  assert.match(root.innerHTML, /data-guest-action="view-ticket"[\s\S]*立即体验 TK-1001/);
  assert.doesNotMatch(root.innerHTML, /class="guest-tour"/);
  assert.match(root.innerHTML, /data-guest-action="start-tour">开始导航/);
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
  assert.match(root.innerHTML, /data-guest-stat="open-tasks">4<\/strong>/);
  assert.match(root.innerHTML, /data-guest-stat="completed-tasks">9<\/strong>/);
  assert.match(secondSession.innerHTML, /data-guest-stat="open-tasks">5<\/strong>/);
  assert.match(secondSession.innerHTML, /data-guest-stat="completed-tasks">8<\/strong>/);

  root.clickAction("reset");
  assert.match(root.innerHTML, /data-guest-stat="open-tasks">5<\/strong>/);
  assert.match(root.innerHTML, /data-guest-stat="completed-tasks">8<\/strong>/);
  assert.doesNotMatch(root.innerHTML, /class="guest-tour"/);
  root.clickPage("decisions");
  assert.doesNotMatch(root.innerHTML, /TK-1001：供应商交期异常处置/);
  root.clickAction("exit");
  assert.equal(exited, true);
  assert.equal(root.innerHTML, "");
});
