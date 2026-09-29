const GITHUB_API = "https://api.github.com";
const REQUEST_TIMEOUT_MS = 12000;

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
    headers: { Accept: "application/vnd.github+json" },
    credentials: "omit",
    cache: "no-store",
    signal,
  });
  if (!response.ok) {
    const error = new Error(response.status === 404 ? "仓库或资源不存在" : `GitHub API 返回 HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
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

export async function fetchPublicGitHubRepository(githubUrl) {
  const repository = parsePublicGitHubRepository(githubUrl);
  if (!repository) throw new Error("请填写有效的公开 github.com 仓库地址。");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const base = `${GITHUB_API}/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repository)}`;
    const [repo, commits] = await Promise.all([
      getJson(base, controller.signal),
      getJson(`${base}/commits?per_page=1`, controller.signal),
    ]);
    if (repo.private !== false || repo.visibility === "private") {
      throw new Error("当前只支持读取公开仓库。");
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

    const latest = Array.isArray(commits) ? commits[0] : null;
    const commitDate = latest?.commit?.author?.date || latest?.commit?.committer?.date || "";
    return {
      repositoryName: repo.full_name || repository.fullName,
      repositoryUrl: publicPagesUrl(repo.html_url) || repository.url,
      defaultBranch: typeof repo.default_branch === "string" ? repo.default_branch : "",
      updatedAt: typeof repo.updated_at === "string" ? repo.updated_at : "",
      latestCommit: latest ? {
        sha: typeof latest.sha === "string" ? latest.sha.slice(0, 7) : "",
        message: typeof latest.commit?.message === "string" ? latest.commit.message.split(/\r?\n/, 1)[0].slice(0, 240) : "",
        url: publicPagesUrl(latest.html_url),
        committedAt: commitDate,
      } : null,
      pagesUrl,
      pagesUrlEstimated,
      isPublic: true,
      refreshedAt: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timeout);
  }
}
