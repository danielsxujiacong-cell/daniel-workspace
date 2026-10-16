import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fetchPublishedSnapshot} from '../src/public-snapshot.js';
import {chatRoute, snapshotRoute} from '../server/edge-workspace.js';
import {postChat,authenticateWorkspace} from '../cloudflare/worker.js';
import {parseStructuredJSON} from '../src/ai/structured-json.js';
const snapshot=JSON.parse(await readFile(new URL('../assets/public/latest.json',import.meta.url),'utf8'));
const origin='https://workspace.danielxu.cn';
const req=(path,body)=>new Request(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
const memoryKV=()=>{const values=new Map([['snapshot:latest',JSON.stringify(snapshot)]]);return {get:async k=>values.get(k)??null,put:async(k,v)=>{values.set(k,v);}};};
test('visitor uses same-site latest and previous when persistent API is unavailable',async()=>{
 const urls=[];
 const result=await fetchPublishedSnapshot({fetchImpl:async url=>{urls.push(url);return urls.length===3?Response.json(snapshot):new Response('bad',{status:503});}});
 assert.equal(result.projects.length,26);assert.equal(urls.length,3);
 assert.ok(urls.every(u=>!/workers.dev|supabase|github/.test(u)));assert.ok(urls[2].endsWith('previous.json'));
});
test('Edge snapshot fallback needs no upstream network or KV service',async t=>{
 const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);
 globalThis.fetch=async()=>{throw Error('all upstream networks disabled');};
 const result=await snapshotRoute({request:new Request(origin+'/api/public/snapshot'),env:{}});
 assert.equal(result.status,200);assert.equal((await result.json()).projects.length,26);
});
test('anonymous daily quota rejects before calling GLM',async t=>{
 const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);let called=false;
 globalThis.fetch=async()=>{called=true;throw Error('must not call');};
 const kv={get:async key=>key.endsWith(':all')?'100':null,put:async()=>{throw Error('must not write');}};
 const response=await chatRoute({request:req('/api/public/chat',{message:'hi'}),clientIp:'192.0.2.99',env:{AI_API_KEY:'fake',WORKSPACE_PUBLIC:kv}},true);
 assert.equal(response.status,429);assert.equal(called,false);
});
test('safe parser accepts complete fences and rejects truncation',()=>{
 assert.deepEqual(parseStructuredJSON('```json\n{"a":"brace } inside"}\n```'),{a:'brace } inside'});
 assert.throws(()=>parseStructuredJSON('{"completed":[{"text":"partial"}'),/不完整/);
});
test('anonymous AI ignores client context, retains 26 projects and enforces burst limits',async t=>{
 const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);let sent,calls=0;
 globalThis.fetch=async(url,init)=>{assert.equal(url,'https://open.bigmodel.cn/api/paas/v4/chat/completions');calls++;sent=JSON.parse(init.body);return Response.json({model:'glm-4-flash-250414',choices:[{message:{content:'公开项目回答'},finish_reason:'stop'}]});};
 const env={AI_API_KEY:'fake-test-key',WORKSPACE_PUBLIC:memoryKV()};
 const context=()=>({request:req('/api/public/chat',{message:'介绍项目',relevantContext:{secret:'PRIVATE_INJECTION'}}),clientIp:'192.0.2.10',env});
 for(let i=0;i<3;i++)assert.equal((await chatRoute(context(),true)).status,200);
 assert.equal((await chatRoute(context(),true)).status,429);assert.equal(calls,3);
 assert.ok(!JSON.stringify(sent).includes('PRIVATE_INJECTION'));
 for(const p of snapshot.projects)assert.ok(JSON.stringify(sent).includes(p.name),p.name);
});
test('quota outage fails closed and private endpoints reject anonymous calls',async()=>{
 assert.equal((await chatRoute({request:req('/api/public/chat',{message:'hi'}),clientIp:'192.0.2.11',env:{AI_API_KEY:'fake'}},true)).status,503);
 assert.equal((await chatRoute({request:req('/api/chat',{message:'hi'}),env:{AI_API_KEY:'fake'}},false)).status,401);
 assert.equal((await snapshotRoute({request:req('/api/public/snapshot',snapshot),env:{}})).status,401);
});
test('provider retries truncated JSON only once and reports incomplete output',async t=>{
 const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);let calls=0;
 globalThis.fetch=async()=>{calls++;return Response.json({choices:[{message:{content:'{"completed":[]'},finish_reason:'length'}]});};
 const response=await postChat(req('/api/chat',{message:'JSON',currentPage:'home-daily-brief',relevantContext:{}}),{AI_API_KEY:'fake',AI_MODEL:'glm-4-flash-250414',AI_BASE_URL:'https://glm.test/v4',ALLOWED_ORIGINS:origin});
 assert.equal(calls,2);assert.equal(response.status,502);assert.equal((await response.json()).error.code,'ai_incomplete_response');
});
test('owner validation supports Edge runtimes without AbortSignal.timeout',async t=>{
 const old=AbortSignal.timeout,original=globalThis.fetch;
 t.after(()=>{AbortSignal.timeout=old;globalThis.fetch=original;});
 AbortSignal.timeout=undefined;
 globalThis.fetch=async(url,init)=>{assert.equal(url,'https://auth.test/auth/v1/user');assert.ok(init.signal instanceof AbortSignal);return Response.json({id:'owner'});};
 const request=req('/api/chat',{});request.headers.set('Authorization','Bearer synthetic-token');
 assert.deepEqual(await authenticateWorkspace(request,{SUPABASE_URL:'https://auth.test',SUPABASE_ANON_KEY:'test-public-key',WORKSPACE_USER_ID:'owner'}),{id:'owner'});
});
test('Node public AI uses atomic quota RPC without KV or private database access',async t=>{
 const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);const urls=[];let quotaBody;
 globalThis.fetch=async(url,init)=>{
   urls.push(url);
   if(url.endsWith('/rest/v1/rpc/workspace_reserve_public_ai_quota')){quotaBody=JSON.parse(init.body);return Response.json(true);}
   assert.equal(url,'https://open.bigmodel.cn/api/paas/v4/chat/completions');
   const sent=JSON.stringify(JSON.parse(init.body));assert.ok(!sent.includes('PRIVATE_INJECTION'));
   return Response.json({model:'glm-4-flash-250414',choices:[{message:{content:'真实服务传输测试'},finish_reason:'stop'}]});
 };
 const response=await chatRoute({request:req('/api/public/chat',{message:'介绍公开项目',publishedAt:snapshot.publishedAt,relevantContext:{secret:'PRIVATE_INJECTION'}}),clientIp:'192.0.2.55',env:{AI_API_KEY:'fake-test-key'}},true,{quotaBackend:'postgres'});
 assert.equal(response.status,200);assert.equal(urls.length,2);
 assert.deepEqual(Object.keys(quotaBody),['client_hash']);assert.match(quotaBody.client_hash,/^[a-f0-9]{64}$/);
});
test('atomic quota failure prevents any GLM request',async t=>{
 const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);let calls=0;
 globalThis.fetch=async url=>{calls++;assert.ok(url.endsWith('/rpc/workspace_reserve_public_ai_quota'));return new Response('',{status:503});};
 const response=await chatRoute({request:req('/api/public/chat',{message:'hi'}),clientIp:'192.0.2.56',env:{AI_API_KEY:'fake'}},true,{quotaBackend:'postgres'});
 assert.equal(response.status,503);assert.equal(calls,1);
});
