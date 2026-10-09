import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolveEntryMode } from "../src/auth/entry-mode.js";

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
  assert.deepEqual(scripts, ["./src/auth/gate.js"]);
});

test("private login still signs in, verifies the user, and checks the allowlist before opening app", () => {
  assert.match(gate, /name="email" type="email"[\s\S]*name="password" type="password"[\s\S]*>登录<\/button>/);
  const loginFlow = gate.slice(gate.indexOf("async function handleLogin"), gate.indexOf("async function handleLogout"));
  const signInAt = loginFlow.indexOf("signInWithPassword");
  const getUserAt = loginFlow.indexOf("client.auth.getUser()");
  const allowlistAt = loginFlow.indexOf("isAllowedUser(user)");
  const workspaceAt = loginFlow.indexOf("enterWorkspace(user)");
  assert.ok(signInAt >= 0 && signInAt < getUserAt && getUserAt < allowlistAt && allowlistAt < workspaceAt);
  assert.match(gate, /async function enterWorkspace\(user\)\s*\{\s*if \(workspaceVisible\) return;\s*if \(!isAllowedUser\(user\)\) throw new Error\("Unauthorized user"\);[\s\S]*?import\("\.\.\/app\.js"\)/);

  const sessionRestore = gate.slice(gate.indexOf("async function boot"), gate.indexOf("async function startGuestDemo"));
  const getSessionAt = sessionRestore.indexOf("authClient.auth.getSession()");
  const restoreUserAt = sessionRestore.indexOf("authClient.auth.getUser()");
  const restoreAllowlistAt = sessionRestore.indexOf("isAllowedUser(user)");
  const restoreWorkspaceAt = sessionRestore.indexOf("enterWorkspace(user)");
  assert.ok(getSessionAt >= 0 && getSessionAt < restoreUserAt && restoreUserAt < restoreAllowlistAt && restoreAllowlistAt < restoreWorkspaceAt);
});
