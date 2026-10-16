const START = "<!-- workspace-project-profile:v1 -->";
const END = "<!-- /workspace-project-profile -->";

export function readProjectProfile(notes) {
  const text = typeof notes === "string" ? notes : "";
  const start = text.indexOf(START);
  const end = text.indexOf(END, start + START.length);
  if (start < 0 || end < 0) return { profile: null, notes: text };
  try {
    const value = JSON.parse(text.slice(start + START.length, end));
    if (value.version !== 1 || !Array.isArray(value.features) || !Array.isArray(value.resources)) throw new Error("Invalid profile");
    const strings = (items) => (Array.isArray(items) ? items : []).filter((item) => typeof item === "string").slice(0, 4);
    const resources = value.resources.filter((item) => {
      try { const url = new URL(item.url); return typeof item.label === "string" && ["http:", "https:"].includes(url.protocol) && !url.username && !url.password; }
      catch { return false; }
    }).slice(0, 10);
    return { profile: { features: strings(value.features), outcomes: strings(value.outcomes), resources }, notes: (text.slice(0, start) + text.slice(end + END.length)).trim() };
  } catch { return { profile: null, notes: text }; }
}

export function appendProjectProfile(notes, profile) {
  if (readProjectProfile(notes).profile) throw new Error("Existing project profile must be reviewed before replacement.");
  return `${notes || ""}\n\n${START}\n${JSON.stringify({ ...profile, version: 1 })}\n${END}`.trim();
}

export function projectNotesAfterEdit(previous, edited) {
  const { profile } = readProjectProfile(previous);
  return profile ? appendProjectProfile(edited, profile) : edited;
}
