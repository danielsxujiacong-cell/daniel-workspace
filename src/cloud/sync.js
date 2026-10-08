import { createDemoData } from "../mock-data.js";

const collections = {
  projects: {
    table: "workspace_projects",
    fields: ["name", "description", "status", "stage", "next", "github", "url", "notes"],
    toRow: (item, userId) => ({
      ...baseRow(item, userId),
      name: item.name || "",
      description: item.description || "",
      status: item.status || "计划中",
      stage: item.stage || "",
      next_step: item.next || "",
      github_url: item.github || "",
      website_url: item.url || "",
      notes: item.notes || "",
    }),
    fromRow: (row) => ({
      ...baseRecord(row),
      name: row.name || "",
      description: row.description || "",
      status: row.status || "计划中",
      stage: row.stage || "",
      next: row.next_step || "",
      github: row.github_url || "",
      url: row.website_url || "",
      notes: row.notes || "",
    }),
  },
  tasks: {
    table: "workspace_tasks",
    fields: ["title", "description", "sourceKey", "projectId", "status", "priority", "due"],
    toRow: (item, userId) => {
      const row = {
        ...baseRow(item, userId),
        title: item.title || "",
        project_id: item.projectId || "",
        status: item.status || "todo",
        priority: item.priority || "中",
        due: item.due || "",
      };
      if (item.sourceKey || item.description) {
        row.description = item.description || "";
        if (item.sourceKey) row.source_key = item.sourceKey;
      }
      return row;
    },
    fromRow: (row) => ({
      ...baseRecord(row),
      title: row.title || "",
      description: row.description || "",
      sourceKey: row.source_key || "",
      projectId: row.project_id || "",
      status: row.status || "todo",
      priority: row.priority || "中",
      due: row.due || "",
    }),
  },
  knowledge: {
    table: "workspace_knowledge",
    fields: ["type", "title", "content", "summary", "tags", "projectId"],
    toRow: (item, userId) => ({
      ...baseRow(item, userId),
      type: item.type || "笔记",
      title: item.title || "",
      content: item.content || "",
      summary: item.summary || "",
      tags: Array.isArray(item.tags) ? item.tags : [],
      project_id: item.projectId || "",
    }),
    fromRow: (row) => ({
      ...baseRecord(row),
      type: row.type || "笔记",
      title: row.title || "",
      content: row.content || "",
      summary: row.summary || "",
      tags: Array.isArray(row.tags) ? row.tags : [],
      projectId: row.project_id || "",
    }),
  },
  decisions: {
    table: "workspace_decisions",
    fields: ["question", "options", "goal", "time", "cost", "risk", "recommendation", "final", "reason", "projectId"],
    toRow: (item, userId) => ({
      ...baseRow(item, userId),
      question: item.question || "",
      options: Array.isArray(item.options) ? item.options : [],
      goal: item.goal || "",
      time_estimate: item.time || "",
      cost: item.cost || "",
      risk: item.risk || "",
      recommendation: item.recommendation || "",
      final_decision: item.final || "",
      reason: item.reason || "",
      project_id: item.projectId || "",
    }),
    fromRow: (row) => ({
      ...baseRecord(row),
      question: row.question || "",
      options: Array.isArray(row.options) ? row.options : [],
      goal: row.goal || "",
      time: row.time_estimate || "",
      cost: row.cost || "",
      risk: row.risk || "",
      recommendation: row.recommendation || "",
      final: row.final_decision || "",
      reason: row.reason || "",
      projectId: row.project_id || "",
    }),
  },
};

function baseRow(item, userId) {
  const now = new Date().toISOString();
  return {
    id: String(item.id),
    user_id: userId,
    created_at: item.createdAt || now,
    updated_at: item.updatedAt || now,
  };
}

function baseRecord(row) {
  const now = new Date().toISOString();
  return {
    id: String(row.id),
    createdAt: row.created_at || now,
    updatedAt: row.updated_at || row.created_at || now,
  };
}

function normalizedRecord(kind, item) {
  const spec = collections[kind];
  return Object.fromEntries(["id", ...spec.fields, "createdAt"].map((key) => [key, item[key] ?? (key === "createdAt" ? "" : Array.isArray(item[key]) ? [] : "")]));
}

function contentSignature(kind, item) {
  const normalized = normalizedRecord(kind, item);
  delete normalized.createdAt;
  return JSON.stringify(normalized);
}

function snapshot(workspace) {
  return Object.fromEntries(Object.keys(collections).map((kind) => [
    kind,
    (Array.isArray(workspace?.[kind]) ? workspace[kind] : []).map((item) => normalizedRecord(kind, item)),
  ]));
}

function canonicalEqual(kind, left, right) {
  return JSON.stringify(normalizedRecord(kind, left)) === JSON.stringify(normalizedRecord(kind, right));
}

function demoRecords() {
  const demo = createDemoData();
  return Object.fromEntries(Object.keys(collections).map((kind) => [kind, new Map(demo[kind].map((item) => [item.id, item]))]));
}

function isDemoRecord(kind, item, demos) {
  const sample = demos[kind].get(item.id);
  return Boolean(sample && contentSignature(kind, item) === contentSignature(kind, sample));
}

export function getLocalMigrationCandidates(workspace) {
  const demos = demoRecords();
  return Object.fromEntries(Object.keys(collections).map((kind) => [
    kind,
    (Array.isArray(workspace?.[kind]) ? workspace[kind] : []).filter((item) => item?.id && !isDemoRecord(kind, item, demos)),
  ]));
}

export function countLocalMigrationCandidates(workspace) {
  return Object.fromEntries(Object.entries(getLocalMigrationCandidates(workspace)).map(([kind, items]) => [kind, items.length]));
}

export function hasLocalMigrationCandidates(workspace) {
  return Object.values(countLocalMigrationCandidates(workspace)).some((count) => count > 0);
}

export function hasCloudRecords(workspace) {
  return Object.keys(collections).some((kind) => Array.isArray(workspace?.[kind]) && workspace[kind].length > 0);
}

export async function loadCloudWorkspace(client, userId, shouldContinue = () => true) {
  const entries = await Promise.all(Object.entries(collections).map(async ([kind, spec]) => {
    if (!shouldContinue()) throw new Error("Workspace is no longer active");
    const { data, error } = await client.from(spec.table).select("*").eq("user_id", userId);
    if (error) throw error;
    return [kind, (data || []).map(spec.fromRow)];
  }));
  const data = Object.fromEntries(entries);
  return { data, baseline: snapshot(data) };
}

export async function saveCloudChanges(client, userId, workspace, baseline, shouldContinue = () => true) {
  const nextBaseline = snapshot(workspace);
  for (const [kind, spec] of Object.entries(collections)) {
    if (!shouldContinue()) throw new Error("Workspace is no longer active");
    const before = new Map((baseline?.[kind] || []).map((item) => [item.id, item]));
    const after = new Map(nextBaseline[kind].map((item) => [item.id, item]));
    const changed = nextBaseline[kind].filter((item) => !before.has(item.id) || !canonicalEqual(kind, before.get(item.id), item));
    if (changed.length) {
      const { error } = await client.from(spec.table).upsert(changed.map((item) => spec.toRow(item, userId)), { onConflict: "user_id,id" });
      if (error) throw error;
    }
    if (!shouldContinue()) throw new Error("Workspace is no longer active");
    const removedIds = [...before.keys()].filter((id) => !after.has(id));
    if (removedIds.length) {
      const { error } = await client.from(spec.table).delete().eq("user_id", userId).in("id", removedIds);
      if (error) throw error;
    }
  }
  return nextBaseline;
}

export async function insertCloudProjects(client, userId, projects) {
  const items = (Array.isArray(projects) ? projects : []).filter((item) => item?.id && String(item.name || "").trim());
  if (!items.length) return 0;
  const now = new Date().toISOString();
  const rows = items.map((item) => ({
    id: String(item.id),
    user_id: userId,
    created_at: item.createdAt || now,
    updated_at: item.updatedAt || now,
    name: String(item.name || "").trim(),
    description: String(item.description || ""),
    status: item.status || "计划中",
    stage: item.stage || "",
    next_step: item.next || "",
    github_url: item.github || "",
    website_url: item.url || "",
    notes: item.notes || "",
  }));
  const { error } = await client.from("workspace_projects").upsert(rows, {
    onConflict: "user_id,id",
    ignoreDuplicates: true,
  });
  if (error) throw error;
  return rows.length;
}

export async function migrateLocalWorkspace(client, userId, workspace, shouldContinue = () => true) {
  const candidates = getLocalMigrationCandidates(workspace);
  const counts = Object.fromEntries(Object.entries(candidates).map(([kind, items]) => [kind, items.length]));
  for (const [kind, items] of Object.entries(candidates)) {
    if (!shouldContinue()) throw new Error("Workspace is no longer active");
    if (!items.length) continue;
    const spec = collections[kind];
    const { error } = await client.from(spec.table).upsert(items.map((item) => spec.toRow(item, userId)), {
      onConflict: "user_id,id",
      ignoreDuplicates: true,
    });
    if (error) throw error;
  }
  const cloud = await loadCloudWorkspace(client, userId, shouldContinue);
  return { ...cloud, counts };
}

export function mergePendingCloudChanges(remoteWorkspace, cachedWorkspace, baseline) {
  const merged = Object.fromEntries(Object.keys(collections).map((kind) => [kind, [...(remoteWorkspace?.[kind] || [])]]));
  for (const kind of Object.keys(collections)) {
    const before = new Map((baseline?.[kind] || []).map((item) => [item.id, item]));
    const cached = new Map((cachedWorkspace?.[kind] || []).map((item) => [item.id, item]));
    const remote = new Map(merged[kind].map((item) => [item.id, item]));
    const ids = new Set([...before.keys(), ...cached.keys()]);
    for (const id of ids) {
      const previous = before.get(id);
      const local = cached.get(id);
      const changed = previous ? (!local || !canonicalEqual(kind, previous, local)) : Boolean(local);
      if (!changed) continue;
      if (local) remote.set(id, { ...local });
      else remote.delete(id);
    }
    merged[kind] = [...remote.values()];
  }
  return merged;
}

export function preserveDeviceOnlyData(remoteWorkspace, localWorkspace) {
  const projectsById = new Map((localWorkspace?.projects || []).map((item) => [item.id, item]));
  return {
    version: 1,
    settings: localWorkspace?.settings && typeof localWorkspace.settings === "object" ? { ...localWorkspace.settings } : { theme: "system" },
    projects: (remoteWorkspace?.projects || []).map((item) => {
      const local = projectsById.get(item.id);
      return local ? { ...item, ...(typeof local.path === "string" ? { path: local.path } : {}), ...(local.githubData ? { githubData: local.githubData } : {}) } : { ...item };
    }),
    tasks: (remoteWorkspace?.tasks || []).map((item) => ({ ...item })),
    knowledge: (remoteWorkspace?.knowledge || []).map((item) => ({ ...item, tags: [...(item.tags || [])] })),
    decisions: (remoteWorkspace?.decisions || []).map((item) => ({ ...item, options: [...(item.options || [])] })),
    activities: (localWorkspace?.activities || []).map((item) => ({ ...item })),
  };
}
