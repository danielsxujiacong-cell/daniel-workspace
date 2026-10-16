import { postChat, authenticateWorkspace } from '../cloudflare/worker.js';
import { sanitizeStaticSnapshot, validateStaticSnapshot } from '../src/static-snapshot.js';
import latestRelease from '../assets/public/latest.json' with { type: 'json' };
import previousRelease from '../assets/public/previous.json' with { type: 'json' };

const ORIGIN = 'https://workspace.danielxu.cn';
const SUPABASE = { SUPABASE_URL: 'https://vjqsorzsilxblufpdxxc.supabase.co', SUPABASE_ANON_KEY: 'sb_publishable_SzoEakfquA7EbxILyhFnpg_lOhq20fg', WORKSPACE_USER_ID: '9dd41e63-bdbd-405c-8243-ebe7de99fcf9' };
export const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const failure = (status, code, message) => json({ error: { code, message } }, status);
const binding = env => env.WORKSPACE_PUBLIC || globalThis.WORKSPACE_PUBLIC;
const settings = env => ({ ...SUPABASE, ...env, ALLOWED_ORIGINS: ORIGIN, AI_BASE_URL: 'https://open.bigmodel.cn/api/paas/v4/', AI_MODEL: 'glm-4-flash-250414' });
function sameOrigin(request) {
  return request.headers.get('Origin') === ORIGIN && !['cross-site', 'none'].includes(request.headers.get('Sec-Fetch-Site'));
}
async function bodyOf(request, limit) {
  if (Number(request.headers.get('Content-Length')) > limit) throw Error('too_large');
  const reader = request.body?.getReader();
  if (!reader) throw Error('invalid_body');
  const chunks = []; let size = 0;
  try {
    for (;;) {
      const {done,value} = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw Error('too_large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
async function storedSnapshot(env) {
  const kv = binding(env);
  for (const key of ['snapshot:latest', 'snapshot:previous']) {
    try { const s = JSON.parse(await kv?.get(key)); if (validateStaticSnapshot(s)) return s; } catch {}
  }
  for (const s of [latestRelease,previousRelease]) if (validateStaticSnapshot(s)) return s;
  throw Error('snapshot_unavailable');
}
export async function snapshotRoute({request, env = {}}) {
  if (request.method === 'GET') {
    try { return json(await storedSnapshot(env)); } catch { return failure(503,'snapshot_unavailable','公开快照暂不可用，请重试。'); }
  }
  if (request.method !== 'POST') return failure(405,'method_not_allowed','Method not allowed');
  if (!sameOrigin(request)) return failure(403,'origin_rejected','来源无效。');
  if (!await authenticateWorkspace(request,settings(env))) return failure(401,'unauthorized','请重新登录。');
  const kv = binding(env);
  if (!kv) return failure(503,'storage_not_configured','公开存储尚未绑定，旧快照保持不变。');
  try {
    const input = await bodyOf(request,1500000);
    if (!validateStaticSnapshot(input)) throw Error('invalid_snapshot');
    const next = sanitizeStaticSnapshot({...input,publishedAt:new Date().toISOString()},{reviewDeliveries:true});
    const previous = await storedSnapshot(env);
    if (next.publishedAt < previous.publishedAt) throw Error('older_snapshot');
    if (next.publishedAt !== previous.publishedAt) await kv.put('snapshot:previous',JSON.stringify(previous));
    await kv.put('snapshot:latest',JSON.stringify(next));
    return json({ok:true,publishedAt:next.publishedAt,counts:{projects:next.projects.length,tasks:next.tasks.length,workLogs:next.workLogs.length}});
  } catch { return failure(503,'publish_failed','发布失败，已发布快照保持不变；请重试。'); }
}

// KV is eventually consistent: these are conservative daily guards, not a
// billing-grade atomic counter. Fail closed on storage failures. Also bound
// bursts and serialize calls inside each isolate to prevent local races.
let quotaTail = Promise.resolve();
const bursts = new Map();
async function quota(env, address, now = Date.now()) {
  const kv = binding(env); if (!kv) throw Error('quota_unavailable');
  const day = new Date(now + 8*3600000).toISOString().slice(0,10);
  const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${day}:${address}`));
  const id = Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  for (const [key,item] of bursts) if (item.until < now) bursts.delete(key);
  const recent = bursts.get(id) || {count:0,until:now+60000};
  if (recent.count >= 3) return false;
  recent.count++; bursts.set(id,recent);
  const keys = [`quota:${day}:all`,`quota:${day}:${id}`];
  const counts = await Promise.all(keys.map(async key => { const value = await kv.get(key); const n = value == null ? 0 : Number(value); if (!Number.isSafeInteger(n) || n < 0) throw Error('quota_invalid'); return n; }));
  if (counts[0] >= 100 || counts[1] >= 15) return false;
  for (let i=0;i<keys.length;i++) await kv.put(keys[i],String(counts[i]+1),{expirationTtl:172800});
  return true;
}
export async function chatRoute(context, publicMode = false) {
  const {request,env = {}} = context;
  if (request.method !== 'POST') return failure(405,'method_not_allowed','Method not allowed');
  if (!sameOrigin(request)) return failure(403,'origin_rejected','来源无效。');
  const config = settings(env);
  if (!config.AI_API_KEY) return failure(503,'ai_not_configured','AI 服务尚未完成服务端配置。');
  try {
    if (!publicMode) {
      let reason='missing_session';
      if (!await authenticateWorkspace(request,config,{onFailure:code=>{reason=code;}})) {
        return failure(reason==='auth_unavailable'?503:reason==='owner_not_allowed'?403:401,reason,
          reason==='auth_unavailable'?'服务端暂时无法验证登录会话，请稍后重试。':reason==='owner_not_allowed'?'当前账号没有私人 AI 权限。':'请重新登录后使用私人 AI。');
      }
    }
    const body = await bodyOf(request,publicMode ? 10000 : 32000);
    if (typeof body.message !== 'string' || !body.message.trim() || body.message.length > (publicMode ? 1000 : 4000)) return failure(400,'ai_invalid_request','问题为空或过长。');
    let payload = body;
    if (publicMode) {
      const address = context.clientIp || request.headers.get('EO-Connecting-IP');
      if (!address) throw Error('quota_unavailable');
      const result = quotaTail.then(()=>quota(env,address));
      quotaTail = result.catch(()=>{});
      if (!await result) return failure(429,'ai_rate_limited','访客 AI 已达频率或今日使用上限，请稍后再试。');
      const snapshot = await storedSnapshot(env);
      // No client context, project IDs, tools, models or endpoint overrides.
      const publicContext = {
        publishedAt:snapshot.publishedAt,
        projects:Object.fromEntries(snapshot.projects.map((p,i)=>[`project${i+1}`,{name:p.name,description:p.description.slice(0,160),status:p.status,stage:p.stage,next:p.next.slice(0,80),features:p.publicDetails?.features?.slice(0,2).map(s=>s.slice(0,80)),outcomes:p.publicDetails?.outcomes?.slice(0,2).map(s=>s.slice(0,80))}])),
        deliveries:snapshot.deliveries.map(d=>({date:d.date,projectName:d.projectName,title:d.title})),
      };
      // Keep all 26 names available despite generic provider array caps.
      payload = { message:body.message,currentPage:'public-projects',relevantContext:publicContext,history:Array.isArray(body.history)?body.history.slice(-6).map(h=>({role:h.role,content:typeof h.content==='string'?h.content.slice(0,600):''})):[] };
    }
    const headers = new Headers({'Content-Type':'application/json',Origin:ORIGIN,'CF-Connecting-IP':context.clientIp || 'edge'});
    return await postChat(new Request(`${ORIGIN}/api/chat`,{method:'POST',headers,body:JSON.stringify(payload)}),config);
  } catch { return failure(503,'ai_unavailable','AI 或用量保护暂不可用，未生成内容，请重试。'); }
}
