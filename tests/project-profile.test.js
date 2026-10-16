import assert from "node:assert/strict";
import test from "node:test";
import { appendProjectProfile, readProjectProfile, projectNotesAfterEdit } from "../src/project-profile.js";
import { buildEnrichmentSql, historicalLogId } from "../scripts/project-enrichment.mjs";

test("profiles preserve original notes, reject unsafe resources, and survive manual-note edits", () => {
  const notes = appendProjectProfile("Original human note", { features: ["A", "B"], outcomes: ["Done"], resources: [{ label: "Guide", url: "https://example.com/docs" }, { label: "Unsafe", url: "javascript:alert(1)" }] });
  const parsed = readProjectProfile(notes);
  assert.equal(parsed.notes, "Original human note");
  assert.equal(parsed.profile.resources.length, 1);
  assert.deepEqual(readProjectProfile(projectNotesAfterEdit(notes, "Edited note")).profile, parsed.profile);
  assert.equal(readProjectProfile(projectNotesAfterEdit(notes, "Edited note")).notes, "Edited note");
  assert.throws(() => appendProjectProfile(notes, parsed.profile));
  assert.equal(readProjectProfile("Malformed notes").profile, null);
});

function fixture() {
  const projects = Array.from({ length: 26 }, (_, i) => ({ id: `p${i}`, before: { notes: "old", updated_at: "2026-10-16T00:00:00Z" }, changes: { notes: "new" } }));
  const source = "https://example.com/change";
  return { projectRef: "vjqsorzsilxblufpdxxc", ownerId: "owner", projects, logs: [{ id: historicalLogId("p0", source), project_id: "p0", work_date: "2026-10-10", completed_items: "Completed item", evidence_links: [source] }] };
}

test("enrichment SQL is transactional, scoped, optimistic, and repeatable without overwriting log edits", () => {
  const plan = fixture();
  plan.projects[0].changes.notes = "Owner's note $enrichment$";
  const sql = buildEnrichmentSql(plan);
  assert.match(sql, /^BEGIN;/);
  assert.match(sql, /Owner''s note \$enrichment\$/);
  assert.match(sql, /user_id = 'owner'/);
  assert.match(sql, /updated_at IS NOT DISTINCT FROM '2026-10-16T00:00:00Z'/);
  assert.match(sql, /IF NOT EXISTS[\s\S]*RAISE EXCEPTION 'Project changed/);
  assert.match(sql, /evidence_links \? 'https:\/\/example.com\/change'/);
  assert.match(sql, /ON CONFLICT \(user_id,id\) DO NOTHING/);
  assert.match(sql, /COMMIT;$/);
  assert.match(buildEnrichmentSql(plan, { rollback: true }), /ROLLBACK;$/);
  assert.doesNotMatch(sql, /DELETE|TRUNCATE|CREATE TABLE|ALTER TABLE/);
});

test("invalid bindings, IDs, fields and evidence fail before SQL execution", () => {
  for (const mutate of [p => p.projectRef = "wrong", p => p.projects.pop(), p => p.projects[1].id = "p0", p => p.projects[0].changes.status = "changed", p => p.logs[0].project_id = "unknown", p => p.logs[0].evidence_links = ["javascript:bad"]]) {
    const plan = fixture(); mutate(plan); assert.throws(() => buildEnrichmentSql(plan));
  }
  assert.equal(historicalLogId("p0", "https://example.com/change"), historicalLogId("p0", "https://example.com/change"));
});
