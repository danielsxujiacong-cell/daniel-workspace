export function resolveEntryMode(search = "") {
  const mode = new URLSearchParams(search).get("mode");
  if (mode === "guest") return "public";
  if (mode === "demo") return "demo";
  if (mode === "login") return "login";
  return "public";
}

export function shouldRestoreExistingSession(mode, hasStoredSession) {
  return mode === "login" && Boolean(hasStoredSession);
}
