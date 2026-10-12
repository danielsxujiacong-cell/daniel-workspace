import assert from "node:assert/strict";
import test from "node:test";
import { requestGitHubWorker } from "../src/github/worker-api.js";

test("GitHub Worker fetch is aborted and reported after its request deadline", async (t) => {
  const originalFetch = globalThis.fetch;
  let requestSignal;
  globalThis.fetch = async (_url, init) => {
    requestSignal = init.signal;
    return new Promise((_, reject) => {
      init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  await assert.rejects(requestGitHubWorker("/api/github/activity", {
    client: { auth: { getSession: async () => ({ data: { session: { access_token: "test-token" } }, error: null }) } },
  }, { method: "POST", body: {}, timeoutMs: 5 }), (error) => error.code === "github_worker_timeout");
  assert.equal(requestSignal.aborted, true);
});
