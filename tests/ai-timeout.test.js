import assert from "node:assert/strict";
import test from "node:test";
import worker from "../cloudflare/worker.js";
import { httpProviderChat } from "../src/ai/providers/http-provider.js";

const env = {
  AI_BASE_URL: "https://glm.test/v4",
  AI_MODEL: "glm-4-flash-250414",
  AI_API_KEY: "test-only-not-a-real-key",
  ALLOWED_ORIGINS: "https://workspace.danielxu.cn",
};

function request(currentPage = "home-daily-brief") {
  return new Request("https://worker.test/api/chat", {
    method: "POST",
    headers: { Origin: "https://workspace.danielxu.cn", "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Create a concise brief", currentPage, relevantContext: { dailyBriefProjects: [] }, history: [] }),
  });
}

test("brief Worker uses bounded output and retries one GLM response-body timeout", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let attempts = 0;
  let upstreamBody;
  globalThis.fetch = async (_url, init) => {
    attempts += 1;
    upstreamBody = JSON.parse(init.body);
    assert.ok(init.signal instanceof AbortSignal);
    if (attempts === 1) return { ok: true, json: async () => { throw new DOMException("timed out", "TimeoutError"); } };
    return { ok: true, json: async () => ({ model: env.AI_MODEL, choices: [{ message: { content: "{}" } }] }) };
  };

  const response = await worker.fetch(request(), env);
  assert.equal(response.status, 200);
  assert.equal(attempts, 2);
  assert.equal(upstreamBody.max_tokens, 900);
});

test("other Worker requests retain the existing output budget", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let upstreamBody;
  globalThis.fetch = async (_url, init) => {
    upstreamBody = JSON.parse(init.body);
    return { ok: true, json: async () => ({ model: env.AI_MODEL, choices: [{ message: { content: "ok" } }] }) };
  };
  const response = await worker.fetch(request("assistant"), env);
  assert.equal(response.status, 200);
  assert.equal(upstreamBody.max_tokens, 1_200);
});

test("brief Worker returns a specific timeout after only one safe retry", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts += 1;
    return { ok: true, json: async () => { throw new DOMException("timed out", "TimeoutError"); } };
  };
  const response = await worker.fetch(request(), env);
  const body = await response.json();
  assert.equal(attempts, 2);
  assert.equal(response.status, 504);
  assert.equal(body.error.code, "ai_timeout");
  assert.match(body.error.message, /安全重试一次仍未完成/);
});

test("browser HTTP timeout covers reading the Worker response body", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (_url, { signal }) => ({
    status: 200,
    json: () => new Promise((_resolve, reject) => {
      if (signal.aborted) reject(signal.reason);
      else signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    }),
  });
  await assert.rejects(httpProviderChat({ currentPage: "home-daily-brief" }, "https://worker.test/api/chat", { timeoutMs: 10 }), (error) => {
    assert.equal(error.code, "ai_timeout");
    assert.match(error.message, /响应内容读取超时/);
    return true;
  });
});
