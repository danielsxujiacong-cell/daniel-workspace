import { requestGitHubWorker } from "./worker-api.js";

export const GITHUB_ACTIVITY_CACHE_TTL_MS = 15 * 60 * 1000;
// Keep each Worker invocation below Cloudflare's outbound subrequest limit
// when it enumerates every branch and paginates recent commits.
const MAX_REPOSITORIES_PER_REQUEST = 4;

function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validRepository(value) {
  return typeof value === "string" && /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9_.-]{1,100}$/.test(value);
}

export function rateLimitedGitHubActivityNames(activity) {
  return [...new Set((Array.isArray(activity?.errors) ? activity.errors : [])
    .filter((error) => error?.reasonCategory === "rate_limited" || error?.code === "github_rate_limited")
    .map((error) => error?.fullName)
    .filter(validRepository))];
}

export function mergeGitHubActivityRetry(previous, refreshed, attemptedNames) {
  const attempted = new Set(attemptedNames.filter(validRepository).map((name) => name.toLowerCase()));
  return {
    repositories: [
      ...(Array.isArray(previous?.repositories) ? previous.repositories : []).filter((repo) =>
        !attempted.has(String(repo?.fullName || "").toLowerCase())),
      ...(Array.isArray(refreshed?.repositories) ? refreshed.repositories : []),
    ],
    errors: [
      ...(Array.isArray(previous?.errors) ? previous.errors : []).filter((error) =>
        !attempted.has(String(error?.fullName || "").toLowerCase())),
      ...(Array.isArray(refreshed?.errors) ? refreshed.errors : []),
    ],
  };
}

export async function fetchGitHubActivity(fullNames, auth, { startDate, endDate } = {}) {
  if (!validDate(startDate) || !validDate(endDate) || startDate > endDate) throw new Error("GitHub 活动日期范围无效。");
  const repositories = [...new Set((Array.isArray(fullNames) ? fullNames : [])
    .filter(validRepository).map((name) => name.trim()))];
  const results = [];
  const errors = [];
  for (let index = 0; index < repositories.length; index += MAX_REPOSITORIES_PER_REQUEST) {
    const chunk = repositories.slice(index, index + MAX_REPOSITORIES_PER_REQUEST);
    const response = await requestGitHubWorker("/api/github/activity", auth, {
      method: "POST",
      body: { repositories: chunk.map((fullName) => ({ fullName })), startDate, endDate },
    });
    if (Array.isArray(response.repositories)) results.push(...response.repositories);
    if (Array.isArray(response.errors)) errors.push(...response.errors);
  }
  return { repositories: results, errors };
}
