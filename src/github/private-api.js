const WORKER_BASE = "https://daniel-workspace-api.ai-investment-dashboard.workers.dev";

async function request(path, auth, { method = "GET", body } = {}) {
  const { data, error } = await auth.client.auth.getSession();
  const token = data?.session?.access_token;
  if (error || !token) throw new Error("Supabase 登录已失效，请重新登录后重试。");
  const response = await fetch(`${WORKER_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "omit",
    cache: "no-store",
    referrerPolicy: "no-referrer",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const failure = new Error(result?.error?.message || `GitHub Worker 请求失败（HTTP ${response.status}）。`);
    failure.code = result?.error?.code || "github_unavailable";
    failure.status = response.status;
    throw failure;
  }
  return result;
}

export async function beginGitHubAppConnection(auth) {
  const result = await request("/api/github/connect", auth, { method: "POST", body: { returnOrigin: location.origin, returnPath: `${location.pathname}${location.search}` } });
  if (typeof result.url !== "string" || !result.url.startsWith("https://github.com/apps/")) throw new Error("GitHub App 授权地址无效。");
  location.assign(result.url);
}

export async function getPrivateGitHubStatus(auth) {
  return request("/api/github/status", auth);
}

export async function listPrivateGitHubRepositories(auth) {
  return request("/api/github/repositories", auth);
}

export async function fetchPrivateGitHubSnapshots(auth, repositories) {
  return request("/api/github/snapshots", auth, { method: "POST", body: { repositories } });
}

export async function disconnectGitHubApp(auth) {
  return request("/api/github/disconnect", auth, { method: "POST", body: {} });
}
