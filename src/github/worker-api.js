const WORKER_BASE = "https://daniel-workspace-api.ai-investment-dashboard.workers.dev";
const DEFAULT_WORKER_TIMEOUT_MS = 30_000;

export async function requestGitHubWorker(path, auth, { method = "GET", body, signal, timeoutMs = DEFAULT_WORKER_TIMEOUT_MS } = {}) {
  const { data, error } = await auth?.client?.auth?.getSession?.() || {};
  const token = data?.session?.access_token;
  if (error || !token) throw new Error("Supabase 登录已失效，请重新登录后重试。");
  if (signal?.aborted) throw new Error("GitHub Worker 请求已取消。");

  const controller = new AbortController();
  let timedOut = false;
  const abortFromParent = () => controller.abort(signal.reason);
  signal?.addEventListener("abort", abortFromParent, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, Math.max(1, Number(timeoutMs) || DEFAULT_WORKER_TIMEOUT_MS));
  try {
    const response = await fetch(`${WORKER_BASE}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const failure = new Error(result?.error?.message || `GitHub Worker 请求失败（HTTP ${response.status}）。`);
      failure.code = result?.error?.code || "github_unavailable";
      failure.status = response.status;
      failure.upstreamStatus = result?.error?.httpStatus;
      throw failure;
    }
    return result;
  } catch (error) {
    if (timedOut) {
      const failure = new Error(`GitHub Worker 请求超时（${Math.ceil(timeoutMs / 1000)} 秒），请重试。`);
      failure.code = "github_worker_timeout";
      throw failure;
    }
    if (signal?.aborted) {
      const failure = new Error("GitHub Worker 读取阶段超时或已取消。");
      failure.code = "github_request_aborted";
      throw failure;
    }
    if (error?.name === "AbortError") {
      const failure = new Error("GitHub Worker 请求超时，请重试。");
      failure.code = "github_worker_timeout";
      throw failure;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abortFromParent);
  }
}
