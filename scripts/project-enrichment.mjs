import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const FIELDS = new Set(["description", "stage", "next_step", "website_url", "notes"]);
const quote = (value) => value === null ? "NULL" : `'${String(value).replaceAll("'", "''")}'`;
const equal = (field, value) => `${field} IS NOT DISTINCT FROM ${quote(value)}`;

export function historicalLogId(projectId, sourceUrl) {
  return `work-log-v47-${createHash("sha256").update(`${projectId}\n${sourceUrl}`).digest("hex").slice(0, 24)}`;
}

export function buildEnrichmentSql(plan, { rollback = false } = {}) {
  if (plan.projectRef !== "vjqsorzsilxblufpdxxc" || !plan.ownerId || plan.projects.length !== 26) throw new Error("Unexpected project binding or catalog size");
  if (new Set(plan.projects.map((p) => p.id)).size !== 26) throw new Error("Duplicate project ID");
  const owner = quote(plan.ownerId);
  const tag = `$enrichment_${createHash("sha256").update(JSON.stringify(plan)).digest("hex")}$`;
  const sql = ["BEGIN;", "SET LOCAL statement_timeout = '30s';", `DO ${tag} DECLARE affected integer; BEGIN`, `IF (SELECT count(*) FROM public.workspace_projects WHERE user_id = ${owner}) <> 26 THEN RAISE EXCEPTION 'Catalog changed'; END IF;`];
  for (const project of plan.projects) {
    const entries = Object.entries(project.changes);
    if (!entries.length || entries.some(([field, value]) => !FIELDS.has(field) || typeof value !== "string")) throw new Error("Invalid update fields");
    for (const [field] of entries) if (!(field in project.before)) throw new Error("Missing baseline");
    const scope = `id = ${quote(project.id)} AND user_id = ${owner}`;
    // Already-applied rows are left untouched; concurrent edits abort the whole batch.
    sql.push(`IF NOT EXISTS (SELECT 1 FROM public.workspace_projects WHERE ${scope} AND ${entries.map(([f, v]) => equal(f, v)).join(" AND ")}) THEN`);
    sql.push(`UPDATE public.workspace_projects SET ${entries.map(([f, v]) => `${f} = ${quote(v)}`).join(", ")}, updated_at = now() WHERE ${scope} AND ${equal("updated_at", project.before.updated_at)} AND ${entries.map(([f]) => equal(f, project.before[f])).join(" AND ")};`);
    sql.push(`GET DIAGNOSTICS affected = ROW_COUNT; IF affected <> 1 THEN RAISE EXCEPTION 'Project changed: %', ${quote(project.id)}; END IF; END IF;`);
  }
  for (const log of plan.logs) {
    if (!plan.projects.some((p) => p.id === log.project_id) || log.id !== historicalLogId(log.project_id, log.evidence_links?.[0]) || !/^\d{4}-\d{2}-\d{2}$/.test(log.work_date) || !log.completed_items || !log.evidence_links?.length) throw new Error("Invalid historical log");
    for (const link of log.evidence_links) { const u = new URL(link); if (!["http:", "https:"].includes(u.protocol) || u.username || u.password) throw new Error("Invalid evidence URL"); }
    const evidence = quote(JSON.stringify(log.evidence_links)) + "::jsonb";
    sql.push(`INSERT INTO public.workspace_work_logs (id,user_id,project_id,work_date,completed_items,outcomes,next_step,evidence_links) SELECT ${quote(log.id)},${owner},${quote(log.project_id)},${quote(log.work_date)},${quote(log.completed_items)},${quote(log.outcomes || "")},'',${evidence} WHERE NOT EXISTS (SELECT 1 FROM public.workspace_work_logs WHERE user_id = ${owner} AND (id = ${quote(log.id)} OR (project_id = ${quote(log.project_id)} AND work_date = ${quote(log.work_date)} AND (btrim(completed_items) = btrim(${quote(log.completed_items)}) OR evidence_links ? ${quote(log.evidence_links[0])})))) ON CONFLICT (user_id,id) DO NOTHING;`);
  }
  sql.push(`END ${tag};`, `SELECT 'projects' AS collection,count(*) AS count FROM public.workspace_projects WHERE user_id=${owner} UNION ALL SELECT 'work_logs',count(*) FROM public.workspace_work_logs WHERE user_id=${owner};`, rollback ? "ROLLBACK;" : "COMMIT;");
  return sql.join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [input, output, mode] = process.argv.slice(2);
  if (!input || !output) throw new Error("Usage: node scripts/project-enrichment.mjs <private-plan.json> <private-output.sql> [--rollback]");
  await writeFile(output, buildEnrichmentSql(JSON.parse(await readFile(input, "utf8")), { rollback: mode === "--rollback" }), "utf8");
  console.log("SQL prepared locally; no database connection or write was performed.");
}
