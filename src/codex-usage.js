const CACHE_VERSION = 1;
const CACHE_PREFIX = "daniel_workspace_codex_usage_v1";
const DAY_MS = 86_400_000;

function validDateKey(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function nonnegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

export function validateCodexUsage(payload) {
  if (!payload || payload.version !== CACHE_VERSION || payload.timezone !== "Asia/Shanghai"
    || !validDateKey(payload.startDate) || !validDateKey(payload.endDate) || payload.startDate > payload.endDate
    || typeof payload.complete !== "boolean" || !Array.isArray(payload.days) || !payload.fieldAvailability) return false;
  const count = (Date.parse(`${payload.endDate}T00:00:00Z`) - Date.parse(`${payload.startDate}T00:00:00Z`)) / DAY_MS + 1;
  if (count > 366 || payload.days.length !== count) return false;
  for (const key of ["inputTokens", "outputTokens", "cachedInputTokens"]) {
    if (typeof payload.fieldAvailability[key] !== "boolean") return false;
  }
  const seen = new Set();
  for (const day of payload.days) {
    if (!day || !validDateKey(day.date) || day.date < payload.startDate || day.date > payload.endDate
      || seen.has(day.date) || typeof day.available !== "boolean") return false;
    seen.add(day.date);
    for (const field of ["inputTokens", "outputTokens", "cachedInputTokens"]) {
      if (day[field] !== null && !nonnegativeInteger(day[field])) return false;
      if (!day.available && day[field] !== null) return false;
    }
  }
  return true;
}

export async function fetchCodexUsage(endpoint, range, { fetchImpl = fetch, signal } = {}) {
  if (!endpoint || !range?.valid || !validDateKey(range.startDate) || !validDateKey(range.endDate)) {
    throw new Error("Codex 用量日期范围无效。");
  }
  const url = new URL(endpoint);
  url.searchParams.set("startDate", range.startDate);
  url.searchParams.set("endDate", range.endDate);
  const response = await fetchImpl(url, {
    method: "GET",
    mode: "cors",
    credentials: "omit",
    cache: "no-store",
    referrerPolicy: "no-referrer",
    signal: signal || AbortSignal.timeout(15_000),
    headers: { Accept: "application/json" },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof payload?.error === "string" ? payload.error : `本机 Codex 用量读取失败（HTTP ${response.status}）。`);
  if (!validateCodexUsage(payload)) throw new Error("本机 Codex 用量汇总格式无效。");
  if (!payload.complete) throw new Error("本机 Codex 日志读取不完整；保留上次可信汇总。");
  return payload;
}

function cacheKey(userId) {
  return `${CACHE_PREFIX}_${encodeURIComponent(String(userId || "owner"))}`;
}

export function loadCodexUsageCache(userId, storage = globalThis.localStorage) {
  try {
    const value = JSON.parse(storage?.getItem(cacheKey(userId)) || "null");
    return validateCodexUsage(value) && value.complete ? value : null;
  } catch {
    return null;
  }
}

export function saveCodexUsageCache(userId, value, storage = globalThis.localStorage) {
  if (!validateCodexUsage(value) || !value.complete) return false;
  try {
    storage?.setItem(cacheKey(userId), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function mergeCodexUsageCache(previous, next) {
  if (!validateCodexUsage(next) || !next.complete) return validateCodexUsage(previous) && previous.complete ? previous : null;
  if (!validateCodexUsage(previous) || !previous.complete) return next;
  const byDate = new Map(previous.days.map((day) => [day.date, day]));
  for (const day of next.days) if (day.available) byDate.set(day.date, day);
  const dates = [...byDate.keys()].sort();
  if (!dates.length) return next;
  const startDate = dates[0];
  const endDate = dates.at(-1);
  const days = [];
  for (let date = startDate; date <= endDate;) {
    days.push(byDate.get(date) || { date, available: false, inputTokens: null, outputTokens: null, cachedInputTokens: null });
    const nextDate = new Date(`${date}T00:00:00.000Z`);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    date = nextDate.toISOString().slice(0, 10);
  }
  const previousGenerated = Date.parse(previous.generatedAt || "") || 0;
  const nextGenerated = Date.parse(next.generatedAt || "") || 0;
  return {
    ...next,
    startDate,
    endDate,
    coverageStartDate: [previous.coverageStartDate, next.coverageStartDate].filter(validDateKey).sort()[0] || null,
    coverageEndDate: [previous.coverageEndDate, next.coverageEndDate].filter(validDateKey).sort().at(-1) || null,
    generatedAt: nextGenerated >= previousGenerated ? next.generatedAt : previous.generatedAt,
    latestEventAt: [previous.latestEventAt, next.latestEventAt].filter(Boolean).sort().at(-1) || null,
    fieldAvailability: Object.fromEntries(["inputTokens", "outputTokens", "cachedInputTokens"].map((key) => [
      key, previous.fieldAvailability[key] && next.fieldAvailability[key],
    ])),
    days,
  };
}

export function codexUsageForRange(cached, range) {
  if (!cached || !range?.valid || !Array.isArray(cached.days)) return null;
  const byDate = new Map(cached.days.map((day) => [day.date, day]));
  const days = [];
  for (let date = range.startDate; date <= range.endDate;) {
    const known = byDate.get(date);
    const covered = Boolean(known?.available);
    days.push({
      date,
      available: covered,
      inputTokens: covered ? known.inputTokens : null,
      outputTokens: covered ? known.outputTokens : null,
      cachedInputTokens: covered ? known.cachedInputTokens : null,
    });
    const next = new Date(`${date}T00:00:00.000Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    date = next.toISOString().slice(0, 10);
  }
  return { ...cached, startDate: range.startDate, endDate: range.endDate, days };
}

export function formatTokenCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? new Intl.NumberFormat("zh-CN").format(value) : "不可用";
}

export function publicTokenUsage(cached, range = null) {
  const source = range ? codexUsageForRange(cached, range) : cached;
  if (!validateCodexUsage(source) || !source.complete || !source.coverageStartDate || !source.coverageEndDate) return null;
  const days = source.days.filter((day) => day.available);
  if (!days.length) return null;
  return {
    complete: true,
    coverageStartDate: source.coverageStartDate,
    coverageEndDate: source.coverageEndDate,
    generatedAt: source.generatedAt,
    fieldAvailability: { ...source.fieldAvailability },
    days: days.map(({ date, inputTokens, outputTokens, cachedInputTokens }) => ({ date, available: true, inputTokens, outputTokens, cachedInputTokens })),
  };
}
