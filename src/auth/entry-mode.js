export function resolveEntryMode(search = "") {
  const mode = new URLSearchParams(search).get("mode");
  if (mode === "guest") return "guest";
  if (mode === "login") return "login";
  return "auth";
}
