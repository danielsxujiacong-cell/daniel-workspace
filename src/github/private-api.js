import { requestGitHubWorker } from "./worker-api.js";

export function getPrivateGitHubStatus(auth) {
  return requestGitHubWorker("/api/github/status", auth);
}

export function listPrivateGitHubRepositories(auth) {
  return requestGitHubWorker("/api/github/repositories", auth);
}

export function fetchPrivateGitHubSnapshots(auth, repositories) {
  return requestGitHubWorker("/api/github/snapshots", auth, { method: "POST", body: { repositories } });
}
