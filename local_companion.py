"""Read-only local companion for Daniel Workspace V2.4.1.

Serves this app on loopback and exposes a single read-only project inventory
endpoint. It never writes to scanned repositories or runs network Git commands.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit


APP_ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = Path(r"D:\_Codex project")
HOST = "127.0.0.1"
PORT = 4174
ALLOWED_CROSS_ORIGIN = {"https://danielsxujiacong-cell.github.io"}
IGNORED_DIRS = {
    ".git", "node_modules", ".venv", "venv", "env", "dist", "build",
    "coverage", ".next", ".cache", "cache", "outputs", "logs",
}
PROJECT_MARKERS = {
    "readme", "readme.md", "project_status.md", "project-status.md",
    "handoff.md", "todo.md", "todo.txt", "package.json", "pyproject.toml",
    "cargo.toml", "go.mod", "index.html",
}
DOC_NAMES = {
    "readme": ("readme", "readme.md", "readme.txt"),
    "handoff": ("handoff", "handoff.md", "handoff.txt"),
    "projectStatus": ("project_status.md", "project-status.md", "project_status.txt"),
    "todo": ("todo", "todo.md", "todo.txt"),
    "projectContext": ("project_context.md", "project-context.md"),
    "changelog": ("changelog.md", "changelog"),
}
STATIC_TOP_LEVEL = {"index.html", "assets", "src"}
STATIC_SUFFIXES = {".html", ".css", ".js", ".svg", ".png", ".webp", ".ico"}


def git(path: Path, *args: str) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env["GIT_OPTIONAL_LOCKS"] = "0"
    return subprocess.run(
        ["git", "-c", "core.fsmonitor=false", "-C", str(path), *args],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=5,
        check=False,
        env=env,
    )


def github_repository(remote: str) -> str | None:
    remote = remote.strip()
    parsed = urlsplit(remote)
    owner_repository: str | None = None
    if parsed.hostname and parsed.hostname.lower() == "github.com":
        owner_repository = parsed.path.strip("/")
    else:
        match = re.fullmatch(r"(?:[^@]+@)?github\.com:([^/]+)/([^/]+)", remote, re.I)
        if match:
            owner_repository = "/".join(match.groups())
    if not owner_repository:
        return None
    parts = owner_repository.split("/", 2)
    if len(parts) != 2:
        return None
    owner, repository = parts
    repository = repository.removesuffix(".git")
    if not re.fullmatch(r"[A-Za-z0-9_.-]+", owner) or not re.fullmatch(r"[A-Za-z0-9_.-]+", repository):
        return None
    return f"https://github.com/{owner}/{repository}"


def documents_at(path: Path) -> dict[str, str | None]:
    found: dict[str, str | None] = {key: None for key in DOC_NAMES}
    for base in (path, path / "docs"):
        try:
            entries = {item.name.lower(): item.name for item in base.iterdir() if item.is_file()}
        except OSError:
            continue
        for key, candidates in DOC_NAMES.items():
            if found[key] is None:
                name = next((entries[candidate] for candidate in candidates if candidate in entries), None)
                if name:
                    found[key] = ("docs/" if base.name.lower() == "docs" else "") + name
    return found


def project_roots() -> list[Path]:
    if not PROJECT_ROOT.is_dir():
        return []
    result: list[Path] = []
    for current, directories, files in os.walk(PROJECT_ROOT, topdown=True, followlinks=False):
        directories[:] = sorted(
            name for name in directories
            if name.lower() not in IGNORED_DIRS and not name.startswith((".", "$"))
        )
        folder = Path(current)
        names = {name.lower() for name in files}
        is_git = ".git" in names or any(name.lower() == ".git" for name in directories)
        docs = documents_at(folder)
        has_project_marker = any(name in PROJECT_MARKERS for name in names) or any(docs.values())
        if is_git or has_project_marker:
            result.append(folder)
            directories.clear()
    return result


def last_modified(path: Path) -> str | None:
    newest = 0.0
    try:
        newest = path.stat().st_mtime
    except OSError:
        pass
    for current, directories, files in os.walk(path, topdown=True, followlinks=False):
        directories[:] = [
            name for name in directories
            if name.lower() not in IGNORED_DIRS and not name.startswith((".", "$"))
        ]
        for name in files:
            try:
                modified = (Path(current) / name).stat(follow_symlinks=False).st_mtime
                newest = max(newest, modified)
            except OSError:
                continue
    if not newest:
        return None
    return datetime.fromtimestamp(newest, timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def scan_project(path: Path) -> dict[str, object]:
    try:
        names = {entry.name.lower() for entry in path.iterdir()} if path.is_dir() else set()
    except OSError:
        names = set()
    is_git = ".git" in names
    docs = documents_at(path)
    result: dict[str, object] = {
        "id": str(path.resolve()).lower(),
        "name": path.name,
        "path": str(path.resolve()),
        "hasGit": is_git,
        "branch": None,
        "clean": None,
        "head": None,
        "originMain": None,
        "ahead": None,
        "behind": None,
        "lastLocalCommit": None,
        "githubRepository": None,
        "documents": docs,
        "modifiedAt": last_modified(path),
        "gitError": None,
    }
    if is_git:
        try:
            branch = git(path, "rev-parse", "--abbrev-ref", "HEAD")
            status = git(path, "status", "--porcelain=v1", "--untracked-files=normal")
            head = git(path, "rev-parse", "--verify", "HEAD")
            origin_main = git(path, "rev-parse", "--verify", "refs/remotes/origin/main")
            last_commit = git(path, "log", "-1", "--format=%H%x1f%s%x1f%cI")
            origin = git(path, "config", "--get", "remote.origin.url")

            if branch.returncode == 0:
                result["branch"] = branch.stdout.strip()
            if status.returncode == 0:
                result["clean"] = not status.stdout.strip()
            if head.returncode == 0:
                result["head"] = head.stdout.strip()
            if origin_main.returncode == 0:
                result["originMain"] = origin_main.stdout.strip()
                counts = git(path, "rev-list", "--left-right", "--count", "HEAD...refs/remotes/origin/main")
                if counts.returncode == 0:
                    ahead_behind = counts.stdout.split()
                    if len(ahead_behind) == 2:
                        result["ahead"], result["behind"] = map(int, ahead_behind)
            if last_commit.returncode == 0 and last_commit.stdout.strip():
                fields = last_commit.stdout.strip().split("\x1f", 2)
                if len(fields) == 3:
                    result["lastLocalCommit"] = {
                        "sha": fields[0],
                        "message": fields[1],
                        "committedAt": fields[2],
                    }
            if origin.returncode == 0:
                result["githubRepository"] = github_repository(origin.stdout.strip())
            if any(command.returncode not in (0, 1) for command in (branch, status, head, last_commit, origin)):
                result["gitError"] = "部分 Git 状态读取失败"
        except (OSError, subprocess.TimeoutExpired) as error:
            result["gitError"] = "Git 状态读取超时或失败"
    return result


def project_inventory() -> dict[str, object]:
    items = [scan_project(path) for path in project_roots()]
    items.sort(key=lambda item: (str(item["name"]).casefold(), str(item["path"]).casefold()))
    return {
        "root": str(PROJECT_ROOT),
        "scannedAt": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "items": items,
    }


class Handler(SimpleHTTPRequestHandler):
    server_version = "DanielWorkspaceLocal/2.4.1"

    def log_message(self, _format: str, *_args: object) -> None:
        return

    def translate_path(self, path: str) -> str:
        parts = [part for part in urlsplit(path).path.split("/") if part]
        return str(APP_ROOT.joinpath(*parts))

    def loopback_host(self) -> bool:
        host = self.headers.get("Host", "").split(":", 1)[0].strip("[]").lower()
        return host in {"localhost", "127.0.0.1"}

    def allowed_origin(self) -> str | None:
        origin = self.headers.get("Origin")
        if not origin:
            return None
        if origin in ALLOWED_CROSS_ORIGIN:
            return origin
        parsed = urlsplit(origin)
        host = self.headers.get("Host", "").lower()
        if parsed.scheme == "http" and parsed.netloc.lower() == host:
            return origin
        return None

    def send_api_cors_headers(self, origin: str | None) -> None:
        if origin:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Private-Network", "true")

    def do_GET(self) -> None:
        if not self.loopback_host():
            self.send_error(403, "Loopback host required")
            return
        request_path = unquote(urlsplit(self.path).path)
        if request_path == "/api/local-projects":
            origin = self.allowed_origin()
            if self.headers.get("Origin") and not origin:
                self.send_error(403, "Origin not allowed")
                return
            try:
                payload = json.dumps(project_inventory(), ensure_ascii=False).encode("utf-8")
            except (OSError, ValueError) as error:
                payload = json.dumps({"error": "本地项目目录读取失败"}, ensure_ascii=False).encode("utf-8")
                self.send_response(500)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Cache-Control", "no-store")
                self.send_api_cors_headers(origin)
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
                return
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_api_cors_headers(origin)
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        raw_parts = [part for part in request_path.split("/") if part]
        if not raw_parts or raw_parts[0] not in STATIC_TOP_LEVEL or any(part.startswith(".") or part in {".", ".."} for part in raw_parts):
            if request_path in ("/", "/index.html"):
                raw_parts = ["index.html"]
            else:
                self.send_error(404)
                return
        if raw_parts[0] not in {"index.html", "assets", "src"}:
            self.send_error(404)
            return
        target = APP_ROOT.joinpath(*raw_parts).resolve()
        try:
            target.relative_to(APP_ROOT)
        except ValueError:
            self.send_error(404)
            return
        if not target.is_file() or target.suffix.lower() not in STATIC_SUFFIXES:
            self.send_error(404)
            return
        self.path = "/" + "/".join(raw_parts)
        super().do_GET()

    def do_OPTIONS(self) -> None:
        if not self.loopback_host():
            self.send_error(403, "Loopback host required")
            return
        if unquote(urlsplit(self.path).path) != "/api/local-projects":
            self.send_error(404)
            return
        origin = self.allowed_origin()
        if not origin or self.headers.get("Access-Control-Request-Method", "GET") != "GET":
            self.send_error(403, "Preflight not allowed")
            return
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Max-Age", "600")
        self.send_header("Vary", "Origin")
        if self.headers.get("Access-Control-Request-Private-Network") == "true":
            self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_HEAD(self) -> None:
        self.send_error(405, "GET only")

    def do_POST(self) -> None:
        self.send_error(405, "Read-only companion")

    do_PUT = do_POST
    do_PATCH = do_POST
    do_DELETE = do_POST


if __name__ == "__main__":
    if not PROJECT_ROOT.is_dir():
        raise SystemExit(f"项目根目录不存在：{PROJECT_ROOT}")
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    if sys.stdout is not None:
        print(f"Daniel Workspace V2.4.1: http://127.0.0.1:{PORT}")
        print(f"只读扫描目录：{PROJECT_ROOT}")
        print("按 Ctrl+C 停止本地 companion。")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
