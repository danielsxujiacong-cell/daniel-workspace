import test from "node:test";
import assert from "node:assert/strict";
import { localScanEndpointFor, shouldRenderDashboardGitHubActivity } from "../src/local-companion.js";

test("local project scan routes from the deployed Workspace origin", () => {
  assert.equal(localScanEndpointFor({ hostname: "workspace.danielxu.cn", pathname: "/" }), "http://127.0.0.1:4174/api/local-projects");
});

test("local scan keeps its localhost and GitHub Pages routes and rejects other hosts", () => {
  assert.equal(localScanEndpointFor({ hostname: "localhost", pathname: "/" }), "/api/local-projects");
  assert.equal(localScanEndpointFor({ hostname: "danielsxujiacong-cell.github.io", pathname: "/daniel-workspace/" }), "http://127.0.0.1:4174/api/local-projects");
  assert.equal(localScanEndpointFor({ hostname: "evil-workspace.danielxu.cn", pathname: "/" }), null);
  assert.equal(localScanEndpointFor({ hostname: "danielsxujiacong-cell.github.io", pathname: "/other/" }), null);
});

test("local progress replaces an unavailable GitHub placeholder on dashboard cards", () => {
  assert.equal(shouldRenderDashboardGitHubActivity({ hasLocalProgress: true, hasRepository: false }), false);
  assert.equal(shouldRenderDashboardGitHubActivity({ hasLocalProgress: true, hasRepository: true, hasSnapshot: false, requestStatus: "unavailable" }), false);
  assert.equal(shouldRenderDashboardGitHubActivity({ hasLocalProgress: true, hasRepository: true, hasSnapshot: true, requestStatus: "unavailable" }), true);
  assert.equal(shouldRenderDashboardGitHubActivity({ hasLocalProgress: false, hasRepository: false }), true);
});
