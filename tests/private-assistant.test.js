import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../assets/styles.css", import.meta.url), "utf8");
const sendChat = app.slice(app.indexOf("async function sendChat(message)"), app.indexOf("function submitRecord(form)"));

test("priority task buttons reset browser defaults and keep list hover feedback", () => {
  assert.match(styles, /\.cloud-task-row\s*\{[^}]*appearance:\s*none;[^}]*border:\s*0;[^}]*background:\s*transparent;/);
  assert.match(styles, /\.cloud-task-row:hover\s*\{\s*background:\s*var\(--panel-hover\);\s*\}/);
  assert.match(styles, /\.dashboard-alert, \.dashboard-change\s*\{[^}]*padding:\s*10px 0;/);
});

test("assistant submit and quick prompts reach a guarded request flow", () => {
  assert.match(app, /app\.addEventListener\("click", \(event\) =>[\s\S]*?handleAction\(element\.dataset\.action, element, event\);/);
  assert.match(app, /if \(action === "send-prompt"\) sendChat\(element\.dataset\.prompt \|\| ""\);/);
  assert.match(app, /else if \(event\.target\.id === "assistant-form"\)[\s\S]*?sendChat\(message\);/);
  assert.ok(sendChat.indexOf("try {") < sendChat.indexOf("const companionContextAvailable"), "context creation must be inside the visible error handler");
  assert.match(sendChat, /catch \(error\)[\s\S]*?pendingMessage\.isError = true;[\s\S]*?finally[\s\S]*?ui\.chatBusy = false;/);
});
