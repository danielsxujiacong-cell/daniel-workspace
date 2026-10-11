export function localScanEndpointFor(locationLike) {
  const hostname = String(locationLike?.hostname || "").toLowerCase();
  const pathname = String(locationLike?.pathname || "/");
  if (hostname === "localhost" || hostname === "127.0.0.1") return "/api/local-projects";
  if (hostname === "workspace.danielxu.cn") return "http://127.0.0.1:4174/api/local-projects";
  if (hostname === "danielsxujiacong-cell.github.io" && /^\/daniel-workspace(?:\/|$)/.test(pathname)) {
    return "http://127.0.0.1:4174/api/local-projects";
  }
  return null;
}

export function shouldRenderDashboardGitHubActivity({ hasLocalProgress, hasRepository, hasSnapshot, requestStatus }) {
  return !(hasLocalProgress && (!hasRepository || (!hasSnapshot && ["unavailable", "error"].includes(requestStatus))));
}
