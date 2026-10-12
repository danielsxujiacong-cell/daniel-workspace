export function snapshotGitHubActivityCacheKey(startDate, endDate, repositoryNames) {
  const repositories = [...new Set((Array.isArray(repositoryNames) ? repositoryNames : [])
    .filter((name) => typeof name === "string" && name.trim())
    .map((name) => name.trim().toLowerCase()))].sort();
  return `${startDate}|${endDate}|${repositories.join(",")}`;
}

export function missingCompleteRepositories(repositories, requiredNames) {
  const complete = new Set((Array.isArray(repositories) ? repositories : [])
    .filter((repo) => repo?.complete === true && repo?.truncated !== true)
    .map((repo) => String(repo.fullName || "").toLowerCase()));
  return [...new Set((Array.isArray(requiredNames) ? requiredNames : [])
    .filter((name) => typeof name === "string" && name.trim()))]
    .filter((name) => !complete.has(name.toLowerCase()));
}

export function reusablePublicRepositorySnapshot(snapshot, repositoryName, fresh) {
  if (!snapshot || snapshot.source === "github-app" || snapshot.isPublic !== true || fresh !== true
    || typeof snapshot.repositoryName !== "string" || typeof repositoryName !== "string"
    || snapshot.repositoryName.toLowerCase() !== repositoryName.toLowerCase()) return null;
  return snapshot;
}

export function withSnapshotPreviewTimeout(label, timeoutMs, operation) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`${label}读取超时（${Math.ceil(timeoutMs / 1000)} 秒），本次未完成；可安全重试。`);
      error.code = "snapshot_stage_timeout";
      controller.abort(error);
      reject(error);
    }, timeoutMs);
  });
  const work = Promise.resolve().then(() => operation(controller.signal));
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}
