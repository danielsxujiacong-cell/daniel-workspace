import { sanitizeStaticSnapshot, validateStaticSnapshot } from '../src/static-snapshot.js';
import latest from '../assets/public/latest.json' with { type: 'json' };
import previous from '../assets/public/previous.json' with { type: 'json' };

const origin='https://workspace.danielxu.cn';
const base='https://vjqsorzsilxblufpdxxc.supabase.co';
const apikey='sb_publishable_SzoEakfquA7EbxILyhFnpg_lOhq20fg';
const owner='9dd41e63-bdbd-405c-8243-ebe7de99fcf9';
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Workspace-Publisher':'4.8-node'}});

// Timers cover response bodies as well as response headers. No upstream bodies,
// account identifiers or credentials enter diagnostics.
async function upstream(path,{token,body,timeout=6000,trace=[],stage}={}) {
 const start=Date.now(),controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeout);let status=null;
 try {
  const response=await fetch(base+path,{method:body?'POST':'GET',headers:{apikey,...(token?{Authorization:token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:controller.signal});
  status=response.status;
  const value=await response.json();
  if(!response.ok)throw Error('upstream_http');
  trace.push({stage,ms:Date.now()-start,httpStatus:status,outcome:'ok'});return value;
 }catch(error){
  const reason=controller.signal.aborted?'timeout':status?'upstream_http':'network';
  trace.push({stage,ms:Date.now()-start,httpStatus:status,outcome:reason});
  throw Object.assign(Error(reason),{stage,reason,httpStatus:status});
 }finally{clearTimeout(timer);}
}

export async function readPersistentSnapshot({version,trace=[]}={}) {
 let selected=version;
 if(!selected){const pointer=await upstream('/rest/v1/workspace_public_snapshot_current?select=version&singleton=eq.true',{trace,stage:'read_pointer',timeout:2500});selected=pointer?.[0]?.version;}
 if(!selected)return null;
 if(!/^v48-[a-f0-9]{32}$/.test(selected))throw Error('invalid_version');
 const rows=await upstream('/rest/v1/workspace_public_snapshot_versions?select=snapshot&version=eq.'+selected,{trace,stage:'read_version',timeout:2500});
 const snapshot=rows?.[0]?.snapshot;
 if(!validateStaticSnapshot(snapshot)||snapshot.snapshotVersion!==selected)throw Error('invalid_stored_snapshot');
 return snapshot;
}

export async function currentPublicSnapshot(options={}) {
 try {const snapshot=await readPersistentSnapshot(options);if(snapshot)return snapshot;}catch{}
 for(const snapshot of [latest,previous])if(validateStaticSnapshot(snapshot))return snapshot;
 throw Error('snapshot_unavailable');
}

export async function publicationRoute({request}) {
 const trace=[],start=Date.now();let stage='request';
 const fail=(status,code,message)=>reply({ok:false,error:{code,stage,message},diagnostics:trace,totalMs:Date.now()-start},status);
 if(request.method==='GET'){
  const version=new URL(request.url).searchParams.get('version');
  try {const snapshot=version?await readPersistentSnapshot({version,trace}):await currentPublicSnapshot({trace});return snapshot?reply(snapshot):fail(404,'version_missing','指定快照版本不存在。');}
  catch{return fail(503,'snapshot_unavailable','公开快照读取失败；可使用站点静态备份。');}
 }
 if(request.method!=='POST')return fail(405,'method_not_allowed','请求方法无效。');
 if(request.headers.get('Origin')!==origin||['cross-site','none'].includes(request.headers.get('Sec-Fetch-Site')))return fail(403,'origin_rejected','发布来源无效。');
 const token=request.headers.get('Authorization');
 if(!/^Bearer\s+\S+$/i.test(token||''))return fail(401,'missing_session','请登录后发布。');
 try{
  stage='authenticate';
  const user=await upstream('/auth/v1/user',{token,trace,stage,timeout:6000});
  if(user?.id!==owner)return fail(403,'owner_required','当前账号没有发布权限。');
  stage='validate';const before=Date.now();
  if(Number(request.headers.get('Content-Length'))>900000)return fail(413,'snapshot_too_large','快照超过大小限制。');
  const raw=await request.text();
  if(new TextEncoder().encode(raw).length>900000)return fail(413,'snapshot_too_large','快照超过大小限制。');
  const input=JSON.parse(raw);
  if(!validateStaticSnapshot(input)||input.projects.length!==26||input.snapshotVersion||input.publishedAt)return fail(400,'invalid_snapshot','快照校验失败，必须包含 26 个安全项目。');
  const document=sanitizeStaticSnapshot(input,{reviewDeliveries:true});
  trace.push({stage,ms:Date.now()-before,httpStatus:null,outcome:'ok'});
  stage='store_validate_switch';
  const saved=await upstream('/rest/v1/rpc/workspace_publish_public_snapshot',{token,body:{document},trace,stage,timeout:10000});
  stage='confirm';
  if(!validateStaticSnapshot(saved)||!saved.snapshotVersion||saved.projects.length!==document.projects.length)throw Error('invalid_receipt');
  // The transaction returned the exact persisted release after read-back and
  // pointer switch; browser independently checks this immutable version next.
  trace.push({stage,ms:0,httpStatus:200,outcome:'ok'});
  return reply({ok:true,version:saved.snapshotVersion,publishedAt:saved.publishedAt,counts:{projects:saved.projects.length,knowledge:saved.knowledge.length,decisions:saved.decisions.length,tasks:saved.tasks.length,workLogs:saved.workLogs.length},activityPartial:saved.publication.activityPartial,diagnostics:trace,totalMs:Date.now()-start});
 }catch(error){
  const reason=error.reason||'invalid_response',http=error.httpStatus;
  const status=stage==='authenticate'&&(http===401||http===403)?401:stage==='validate'?400:503;
  const label={authenticate:'登录身份验证',validate:'快照完整校验',store_validate_switch:'版本保存、校验与切换',confirm:'发布确认'}[stage]||stage;
  const uncertain=stage==='store_validate_switch'||stage==='confirm';
  return fail(status,`${stage}_${reason}`,`${label}失败（${reason}${http?`，HTTP ${http}`:''}）。${uncertain?'发布结果待确认，请重试同一份快照；不会重复创建版本。':'上一份成功快照未受影响。'}`);
 }
}
