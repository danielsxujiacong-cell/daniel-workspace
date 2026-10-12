import { requestGitHubWorker } from "./worker-api.js?v=3.8-j";

export const GITHUB_CACHE_TTL_MS = 60 * 60 * 1000;
export const GITHUB_ACTIVITY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_REPOSITORIES_PER_REQUEST = 30;

export function isGitHubSnapshotFresh(snapshot, now = Date.now()) {
  const refreshedAt = new Date(snapshot?.refreshedAt || "").getTime();
  const age = now - refreshedAt;
  return Number.isInteger(snapshot?.recentSevenDayCommitCount)
    && snapshot.recentSevenDayCommitCount >= 0
    && Number.isFinite(refreshedAt)
    && age >= 0
    && age < GITHUB_CACHE_TTL_MS;
}

export function parsePublicGitHubRepository(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password || !["github.com", "www.github.com"].includes(url.hostname.toLowerCase())) return null;
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length < 2) return null;
    const owner = decodeURIComponent(segments[0]);
    const repository = decodeURIComponent(segments[1]).replace(/\.git$/i, "");
    if (!/^[A-Za-z0-9-]{1,39}$/.test(owner) || owner.startsWith("-") || owner.endsWith("-")) return null;
    if (!/^[A-Za-z0-9_.-]{1,100}$/.test(repository) || repository === "." || repository === "..") return null;
    return {
      owner,
      repository,
      fullName: `${owner}/${repository}`,
      url: `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`,
    };
  } catch {
    return null;
  }
}

function createRepositoryError(value) {
  const error = new Error(value?.message || "GitHub Worker 无法读取此公开仓库。");
  error.code = value?.code || "github_unavailable";
  error.status = Number.isInteger(value?.httpStatus) ? value.httpStatus : 502;
  error.upstreamStatus = Number.isInteger(value?.httpStatus) ? value.httpStatus : undefined;
  error.operation = value?.operation;
  throw error;
}

export async function fetchPublicGitHubRepositories(githubUrls, auth, { signal } = {}) {
  const repositories = (Array.isArray(githubUrls) ? githubUrls : [])
    .map((url) => parsePublicGitHubRepository(url))
    .filter(Boolean);
  const unique = repositories.filter((repo, index) => repositories.findIndex((item) => item.fullName.toLowerCase() === repo.fullName.toLowerCase()) === index);
  const snapshots = [];
  const errors = [];
  for (let index = 0; index < unique.length; index += MAX_REPOSITORIES_PER_REQUEST) {
    const chunk = unique.slice(index, index + MAX_REPOSITORIES_PER_REQUEST);
    const result = await requestGitHubWorker("/api/github/public-snapshots", auth, {
      method: "POST",
      body: { repositories: chunk.map(({ fullName }) => ({ fullName })) },
      signal,
    });
    if (Array.isArray(result.snapshots)) snapshots.push(...result.snapshots);
    if (Array.isArray(result.errors)) errors.push(...result.errors);
  }
  return { snapshots, errors };
}

export async function fetchPublicGitHubRepository(githubUrl, { auth } = {}) {
  const repository = parsePublicGitHubRepository(githubUrl);
  if (!repository) throw new Error("请填写有效的公开 github.com 仓库地址。");
  const result = await fetchPublicGitHubRepositories([githubUrl], auth);
  const snapshot = result.snapshots.find((item) => item?.repositoryName?.toLowerCase() === repository.fullName.toLowerCase());
  if (snapshot) return snapshot;
  const error = result.errors.find((item) => item?.fullName?.toLowerCase() === repository.fullName.toLowerCase());
  if (error) createRepositoryError(error);
  throw new Error("GitHub Worker 未返回此公开仓库快照。");
}
