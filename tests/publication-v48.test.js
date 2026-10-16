import test from 'node:test';
import assert from 'node:assert/strict';
import {publicationRoute,readPersistentSnapshot} from '../server/publication.js';
import {createStaticSnapshot,validateStaticSnapshot} from '../src/static-snapshot.js';
import {REVIEWED_KNOWLEDGE,REVIEWED_DECISIONS} from '../src/reviewed-public-materials.js';
import {publishPublicSnapshot} from '../src/public-snapshot.js';
const origin='https://workspace.danielxu.cn',version='v48-'+'a'.repeat(32);
const fixture=()=>createStaticSnapshot({now:'2026-10-16T10:00:00.000Z',data:{projects:Array.from({length:26},(_,i)=>({id:'private-'+i,name:'Project '+i,description:'safe',publicDetails:{features:['real feature'],outcomes:['real outcome']}})),knowledge:[...REVIEWED_KNOWLEDGE,{title:'Private note',content:'do not publish'}],decisions:REVIEWED_DECISIONS},activityModel:null});
const req=(s=fixture(),auth=true)=>new Request(origin+'/api/public/snapshot',{method:'POST',headers:{Origin:origin,...(auth?{Authorization:'Bearer synthetic'}:{})},body:JSON.stringify(s)});
const saved=()=>({...fixture(),publishedAt:'2026-10-16T10:01:00.000Z',snapshotVersion:version});

test('reviewed material survives projection; private additions and edits fail closed',()=>{
 const s=fixture();assert.equal(s.knowledge.length,3);assert.equal(s.decisions.length,2);assert.ok(validateStaticSnapshot(s));
 assert.ok(!JSON.stringify(s).includes('do not publish'));
 s.knowledge[0].content+=' private edit';assert.equal(validateStaticSnapshot(s),false);
});
test('Node publication validates owner then performs one atomic persistence RPC with a diagnostic receipt',async t=>{
 const old=fetch;t.after(()=>globalThis.fetch=old);const urls=[];
 globalThis.fetch=async(url,init)=>{urls.push(url);assert.ok(!/github|workers|chat/.test(url));
 if(url.endsWith('/auth/v1/user'))return Response.json({id:'9dd41e63-bdbd-405c-8243-ebe7de99fcf9'});
 assert.ok(url.endsWith('/rpc/workspace_publish_public_snapshot'));assert.equal(JSON.parse(init.body).document.projects.length,26);return Response.json(saved());};
 const r=await publicationRoute({request:req()});const b=await r.json();assert.equal(r.status,200);assert.equal(b.version,version);assert.deepEqual([b.counts.projects,b.counts.knowledge,b.counts.decisions],[26,3,2]);assert.equal(urls.length,2);assert.ok(b.diagnostics.every(x=>Number.isFinite(x.ms)));assert.ok(!JSON.stringify(b).includes('synthetic'));
});
test('auth failure reports actual HTTP and never writes; invalid document never reaches storage',async t=>{
 const old=fetch;t.after(()=>globalThis.fetch=old);let calls=0;
 globalThis.fetch=async()=>{calls++;return Response.json({}, {status:401});};
 let r=await publicationRoute({request:req()});assert.equal(r.status,401);assert.equal((await r.json()).diagnostics[0].httpStatus,401);assert.equal(calls,1);
 globalThis.fetch=async()=>Response.json({id:'9dd41e63-bdbd-405c-8243-ebe7de99fcf9'});
 const s=fixture();s.projects.pop();r=await publicationRoute({request:req(s)});assert.equal(r.status,400);
 assert.equal((await publicationRoute({request:req(fixture(),false)})).status,401);
});
test('storage error is explicit and ambiguous result is never called success',async t=>{
 const old=fetch;t.after(()=>globalThis.fetch=old);
 globalThis.fetch=async url=>url.endsWith('/user')?Response.json({id:'9dd41e63-bdbd-405c-8243-ebe7de99fcf9'}):Response.json({message:'never expose private upstream error'}, {status:503});
 const r=await publicationRoute({request:req()}),b=await r.json();assert.equal(r.status,503);assert.equal(b.error.stage,'store_validate_switch');assert.match(b.error.message,/待确认/);assert.ok(!JSON.stringify(b).includes('private upstream'));
});
test('public version read queries only isolated publication tables',async t=>{
 const old=fetch;t.after(()=>globalThis.fetch=old);
 globalThis.fetch=async url=>{assert.ok(url.includes('/workspace_public_snapshot_versions?'));return Response.json([{snapshot:saved()}]);};
 assert.equal((await readPersistentSnapshot({version})).snapshotVersion,version);
});
test('browser success requires an independent public read of exactly the receipt version',async()=>{
 const auth={client:{auth:{getSession:async()=>({data:{session:{access_token:'synthetic'}}})}}};let calls=0;
 const result=await publishPublicSnapshot(fixture(),auth,{fetchImpl:async(_url,init)=>{calls++;return init.method==='POST'?Response.json({ok:true,version,publishedAt:saved().publishedAt,counts:{projects:26,knowledge:3,decisions:2}}):Response.json(saved());}});
 assert.equal(result.version,version);assert.equal(calls,2);
 await assert.rejects(()=>publishPublicSnapshot(fixture(),auth,{fetchImpl:async(_url,init)=>init.method==='POST'?Response.json({ok:true,version,publishedAt:saved().publishedAt,counts:{projects:26,knowledge:3,decisions:2}}):Response.json({...saved(),snapshotVersion:'v48-'+'b'.repeat(32)})}),/回读确认失败/);
});
