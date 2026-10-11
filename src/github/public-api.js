const GITHUB_API = "https://api.github.com";
const REQUEST_TIMEOUT_MS = 12000;
export const GITHUB_CACHE_TTL_MS = 60 * 60 * 1000;
export const GITHUB_ACTIVITY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

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

async function getJson(url, signal) {
  const response = await fetch(url, {
    method: "GET",
    mode: "cors",
    headers: { Accept: "application/vnd.github+json" },
    credentials: "omit",
    cache: "no-store",
    referrerPolicy: "no-referrer",
    signal,
  });
  if (!response.ok) {
    const error = new Error(response.status === 404 ? "仓库或资源不存在" : `GitHub API 返回 HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

async function getCommitPage(url, signal) {
  try {
    const commits = await getJson(url, signal);
    return Array.isArray(commits) ? commits : [];
  } catch (error) {
    if (error.status === 409) return [];
    throw error;
  }
}

function publicPagesUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function defaultPagesUrl(owner, repository) {
  const userSite = repository.toLowerCase() === `${owner.toLowerCase()}.github.io`;
  return `https://${owner.toLowerCase()}.github.io/${userSite ? "" : `${encodeURIComponent(repository)}/`}`;
}

function commitDate(commit) {
  return commit?.commit?.committer?.date || commit?.commit?.author?.date || "";
}

function commitSummary(commit, repository) {
  if (!commit) return null;
  const sha = typeof commit.sha === "string" && /^[a-f0-9]{7,40}$/i.test(commit.sha) ? commit.sha : "";
  return {
    sha: sha.slice(0, 7),
    message: typeof commit.commit?.message === "string" ? commit.commit.message.split(/\r?\n/, 1)[0].slice(0, 240) : "",
    url: sha ? `${repository.url}/commit/${sha}` : "",
    committedAt: commitDate(commit),
  };
}

export async function fetchPublicGitHubRepository(githubUrl, { now = Date.now() } = {}) {
  const repository = parsePublicGitHubRepository(githubUrl);
  if (!repository) throw new Error("请填写有效的公开 github.com 仓库地址。");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const base = `${GITHUB_API}/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repository)}`;
    const [repo, firstRecentPage] = await Promise.all([
      getJson(base, controller.signal),
      getCommitPage(`${base}/commits?per_page=100&since=${encodeURIComponent(new Date(now - GITHUB_ACTIVITY_WINDOW_MS).toISOString())}&page=1`, controller.signal),
    ]);
    if (repo.private !== false || repo.visibility === "private") {
      const error = new Error("当前只支持读取公开仓库。");
      error.status = 404;
      throw error;
    }

    let recentCommitCount = 0;
    let latest = null;
    const recentCommits = [];
    let page = 1;
    let commits = firstRecentPage;
    while (commits.length) {
      if (!latest) latest = commits[0];
      const withinSevenDays = commits.filter((commit) => {
        const timestamp = new Date(commitDate(commit)).getTime();
        return Number.isFinite(timestamp) && timestamp >= now - GITHUB_ACTIVITY_WINDOW_MS;
      });
      recentCommitCount += withinSevenDays.length;
      for (const commit of withinSevenDays) {
        if (recentCommits.length >= 20) break;
        recentCommits.push(commitSummary(commit, repository));
      }
      if (commits.length < 100) break;
      page += 1;
      commits = await getCommitPage(`${base}/commits?per_page=100&since=${encodeURIComponent(new Date(now - GITHUB_ACTIVITY_WINDOW_MS).toISOString())}&page=${page}`, controller.signal);
    }
    if (!latest) {
      const latestCommits = await getCommitPage(`${base}/commits?per_page=1`, controller.signal);
      latest = latestCommits[0] || null;
    }

    let pagesUrl = "";
    let pagesUrlEstimated = false;
    if (repo.has_pages) {
      try {
        const pages = await getJson(`${base}/pages`, controller.signal);
        pagesUrl = publicPagesUrl(pages.html_url);
      } catch (error) {
        if (error.status !== 404) throw error;
      }
      if (!pagesUrl) {
        pagesUrl = defaultPagesUrl(repository.owner, repo.name || repository.repository);
        pagesUrlEstimated = true;
      }
    }

    return {
      repositoryName: repo.full_name || repository.fullName,
      repositoryUrl: publicPagesUrl(repo.html_url) || repository.url,
      defaultBranch: typeof repo.default_branch === "string" ? repo.default_branch : "",
      updatedAt: typeof repo.updated_at === "string" ? repo.updated_at : "",
      latestCommit: commitSummary(latest, repository),
      recentCommits,
      recentSevenDayCommitCount: recentCommitCount,
      pagesUrl,
      pagesUrlEstimated,
      isPublic: true,
      refreshedAt: new Date(now).toISOString(),
    };
  } finally {
    clearTimeout(timeout);
  }
}
