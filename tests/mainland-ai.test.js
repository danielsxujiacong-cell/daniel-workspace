import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fetchPublishedSnapshot} from '../src/public-snapshot.js';
import {chatRoute, snapshotRoute} from '../server/edge-workspace.js';
import {postChat} from '../cloudflare/worker.js';
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
