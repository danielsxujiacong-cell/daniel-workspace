const TABLE = "workspace_work_logs";
const COLUMNS = "id,user_id,project_id,work_date,completed_items,outcomes,next_step,evidence_links,created_at,updated_at";
const ACTIVITY_COLUMNS = "id,project_id,work_date";
const MAX_EVIDENCE_LINKS = 10;
const ACTIVITY_PAGE_SIZE = 1_000;
const MAX_ACTIVITY_ROWS = 5_000;

function cleanText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function normalizeEvidenceLinks(value) {
  const entries = Array.isArray(value) ? value : typeof value === "string" ? value.split(/\r?\n/) : [];
  const links = [];
  for (const entry of entries) {
    const raw = cleanText(entry, 2_048);
    if (!raw) continue;
    let url;
    try { url = new URL(raw); } catch { throw new Error("证据链接必须是完整的 HTTP 或 HTTPS 地址。"); }
    if (!(["http:", "https:"].includes(url.protocol) && !url.username && !url.password)) {
      throw new Error("证据链接只允许不含用户名或密码的 HTTP/HTTPS 地址。");
    }
    const normalized = url.href;
    if (!links.includes(normalized)) links.push(normalized);
    if (links.length > MAX_EVIDENCE_LINKS) throw new Error(`每条工作记录最多添加 ${MAX_EVIDENCE_LINKS} 个证据链接。`);
  }
  return links;
}

export function validateWorkLogDraft(value = {}) {
  const workDate = cleanText(value.workDate ?? value.work_date, 10);
  const completedItems = cleanText(value.completedItems ?? value.completed_items, 8_000);
  const outcomes = cleanText(value.outcomes, 8_000);
  const nextStep = cleanText(value.nextStep ?? value.next_step, 4_000);
  if (!validDate(workDate)) throw new Error("请选择有效的工作日期。");
  if (!completedItems) throw new Error("请填写完成事项。");
  return { workDate, completedItems, outcomes, nextStep, evidenceLinks: normalizeEvidenceLinks(value.evidenceLinks ?? value.evidence_links) };
}

export function workLogFromRow(row) {
  if (!row || typeof row !== "object" || !validDate(row.work_date)) return null;
  const draft = validateWorkLogDraft({
    workDate: row.work_date,
    completedItems: row.completed_items,
    outcomes: row.outcomes,
    nextStep: row.next_step,
    evidenceLinks: row.evidence_links,
  });
  return {
    id: String(row.id || ""),
    projectId: String(row.project_id || ""),
    ...draft,
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || row.created_at || ""),
  };
}

export function workLogToRow(record, userId, projectId, { id = record?.id, now = new Date().toISOString() } = {}) {
  if (!userId || !projectId) throw new Error("工作记录需要当前已验证用户和所属项目。");
  const draft = validateWorkLogDraft(record);
  const recordId = cleanText(id, 120);
  if (!recordId) throw new Error("工作记录 ID 无效。");
  return {
    id: recordId,
    user_id: userId,
    project_id: String(projectId),
    work_date: draft.workDate,
    completed_items: draft.completedItems,
    outcomes: draft.outcomes,
    next_step: draft.nextStep,
    evidence_links: draft.evidenceLinks,
    created_at: cleanText(record?.createdAt ?? record?.created_at, 40) || now,
    updated_at: now,
  };
}

function assertRange(startDate, endDate) {
  if (!validDate(startDate) || !validDate(endDate) || startDate > endDate) {
    throw new Error("工作记录日期范围无效。");
  }
}

function timedQuery(query, timeoutMs = 15_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return query.abortSignal(controller.signal)
    .then((result) => {
      if (result.error) throw result.error;
      return result.data || [];
    })
    .catch((error) => {
      if (controller.signal.aborted) throw new Error("工作记录云端读取超时，请重试。");
      throw error;
    })
    .finally(() => clearTimeout(timeout));
}

export async function loadProjectWorkLogs(client, userId, projectId) {
  if (!userId || !projectId) throw new Error("缺少已验证的账号或项目。");
  const query = client.from(TABLE).select(COLUMNS)
    .eq("user_id", userId).eq("project_id", String(projectId))
    .order("work_date", { ascending: false }).order("updated_at", { ascending: false }).limit(200);
  return (await timedQuery(query)).map(workLogFromRow).filter(Boolean);
}

export async function loadWorkLogsForRange(client, userId, { startDate, endDate, projectIds = [], limit = 150 } = {}) {
  if (!userId) throw new Error("缺少已验证账号。");
  assertRange(startDate, endDate);
  const ids = [...new Set((Array.isArray(projectIds) ? projectIds : []).map(String).filter(Boolean))];
  if (!ids.length) return [];
  const query = client.from(TABLE).select(COLUMNS)
    .eq("user_id", userId).in("project_id", ids)
    .gte("work_date", startDate).lte("work_date", endDate)
    .order("work_date", { ascending: false }).order("updated_at", { ascending: false })
    .limit(Math.max(1, Math.min(200, Number(limit) || 150)));
  return (await timedQuery(query)).map(workLogFromRow).filter(Boolean);
}

export async function loadWorkLogActivityForRange(client, userId, { startDate, endDate, projectIds = [], maxRows = MAX_ACTIVITY_ROWS } = {}) {
  if (!userId) throw new Error("缺少已验证账号。");
  assertRange(startDate, endDate);
  const ids = [...new Set((Array.isArray(projectIds) ? projectIds : []).map(String).filter(Boolean))];
  if (!ids.length) return { items: [], complete: true };

  const boundedMaxRows = Math.max(1, Math.min(MAX_ACTIVITY_ROWS, Number(maxRows) || MAX_ACTIVITY_ROWS));
  const items = [];
  let recordsValid = true;
  let offset = 0;
  while (offset < boundedMaxRows) {
    const pageEnd = Math.min(offset + ACTIVITY_PAGE_SIZE, boundedMaxRows) - 1;
    const query = client.from(TABLE).select(ACTIVITY_COLUMNS)
      .eq("user_id", userId).in("project_id", ids)
      .gte("work_date", startDate).lte("work_date", endDate)
      .order("work_date", { ascending: true }).order("id", { ascending: true })
      .range(offset, pageEnd);
    const rows = await timedQuery(query);
    for (const row of rows) {
      if (!row || !validDate(row.work_date) || typeof row.id !== "string" || !row.id || typeof row.project_id !== "string" || !row.project_id) {
        recordsValid = false;
        continue;
      }
      items.push({ id: row.id, projectId: row.project_id, workDate: row.work_date });
    }
    if (rows.length < pageEnd - offset + 1) return { items, complete: recordsValid };
    offset = pageEnd + 1;
  }
  return { items, complete: false };
}

export async function saveWorkLogRecord(client, userId, projectId, record) {
  const row = workLogToRow(record, userId, projectId);
  const { data, error } = await client.from(TABLE).upsert(row, { onConflict: "user_id,id" }).select(COLUMNS).single();
  if (error) throw error;
  const saved = workLogFromRow(data);
  if (!saved) throw new Error("Supabase 未返回已保存的工作记录。");
  return saved;
}

export function workLogCloudError(error) {
  if (["42P01", "PGRST205"].includes(error?.code) || /workspace_work_logs.*(not exist|schema cache)/i.test(error?.message || "")) {
    return "工作记录表尚未部署；请完成 V3.6 Supabase 迁移后重试。";
  }
  if (["42501", "PGRST301"].includes(error?.code)) return "工作记录权限校验失败；请检查登录状态和 Supabase RLS 策略。";
  return typeof error?.message === "string" ? error.message : "工作记录云端读取失败，请重试。";
}
