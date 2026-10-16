import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../cloudflare/worker.js';
import {createStaticSnapshot,sanitizeStaticSnapshot,validateStaticSnapshot} from '../src/static-snapshot.js';
import {validatePublicSnapshot,hydratePublicSnapshot,buildSnapshotActivity} from '../src/public-snapshot.js';
const origin='https://workspace.danielxu.cn';
const fixture=()=>createStaticSnapshot({now:'2026-10-16T10:00:00Z',data:{projects:Array.from({length:26},(_,i)=>({id:`private-${i}`,name:`Project ${i}`,description:'Safe display summary',github:'https://github.com/private/secret',notes:'Private raw notes',isPinned:i<5})),tasks:[{projectId:'private-0',title:'Private task body',status:'todo'}]},activityModel:{startDate:'2026-09-17',endDate:'2026-10-16',days:[{date:'2026-10-12',githubCommits:4,githubProjectCounts:[{name:'Project 0',count:4}],workLogProjects:[{name:'Project 0',count:1}]}],coverage:{githubRequested:26,githubComplete:false,workLogsComplete:false}}});
test('static whitelist preserves 26 projects and partial chart counts without raw private records',()=>{
 const s=fixture();assert.equal(s.projects.length,26);assert.equal(s.deliveries.length,10);assert.ok(validateStaticSnapshot(s));assert.ok(validatePublicSnapshot(s));assert.equal(hydratePublicSnapshot(s).projects.length,26);
 const serialized=JSON.stringify(s);for(const value of ['private-0','private/secret','Private raw notes','Private task body'])assert.ok(!serialized.includes(value));
 const model=buildSnapshotActivity(s,{valid:true,startDate:'2026-09-17',endDate:'2026-10-16'});assert.equal(model.totals.githubCommits,4);assert.equal(model.totals.workLogs,1);assert.equal(model.coverage.complete,false);assert.equal(model.projectActivity[0].projectId,'project-001');
});
test('server projection strips unknown keys, unsafe links, secret strings and original content',()=>{
 const input=fixture();input.secret='keep-out';input.projects[0].cookie='private-cookie';input.projects[0].description='password=topsecret; Bearer abcdefghijklmnop; D:\\Private\\folder; owner@example.com';input.projects[0].github='https://github.com/acme/private';input.projects[0].url='https://drive.google.com/secret';input.workLogs[0].completedItems='Private original';input.summaries.dailyBrief='Unreviewed AI';
 const s=sanitizeStaticSnapshot(input),json=JSON.stringify(s);for(const forbidden of ['topsecret','abcdefghijklmnop','Private\\\\folder','owner@example.com','private-cookie','Unreviewed AI','Private original','acme/private','keep-out'])assert.ok(!json.includes(forbidden),forbidden);assert.ok(validateStaticSnapshot(s));assert.equal(s.projects[0].url,'');assert.equal(s.projects[0].github,'');
});
test('publisher uses one authenticated write, no GitHub calls, keeps prior snapshot on auth or storage failures',async()=>{
 let stored=fixture(),writes=0,fail=false;const original=globalThis.fetch;
 globalThis.fetch=async(url,init)=>{assert.equal(String(url),'https://auth.example/auth/v1/user');return Response.json({id:init.headers.Authorization==='Bearer owner'?'owner-id':'other-id'});};
 const env={ALLOWED_ORIGINS:origin,SUPABASE_URL:'https://auth.example',SUPABASE_ANON_KEY:'public-test-key',WORKSPACE_USER_ID:'owner-id',PUBLIC_WORKSPACE_SNAPSHOTS:{async get(){return stored;},async put(key,value){assert.equal(key,'latest');if(fail)throw Error('storage unavailable');writes++;stored=JSON.parse(value);}}};
 const req=(token,body=fixture())=>new Request('https://worker.example/api/public/snapshot',{method:'POST',headers:{Origin:origin,Authorization:`Bearer ${token}`,'CF-Connecting-IP':crypto.randomUUID()},body:JSON.stringify(body)});
 try{const before=JSON.stringify(stored);assert.equal((await worker.fetch(req('other'),env)).status,401);assert.equal(JSON.stringify(stored),before);
 const result=await worker.fetch(req('owner'),env);assert.equal(result.status,200);assert.equal(writes,1);const r=await result.json();assert.equal(r.counts.projects,26);assert.equal(r.skippedProjects,0);assert.equal(r.activityPartial,true);assert.ok(stored.publishedAt);assert.ok(validateStaticSnapshot(stored));
 const published=JSON.stringify(stored);const invalid=fixture();invalid.projects=[];assert.equal((await worker.fetch(req('owner',invalid),env)).status,400);assert.equal(JSON.stringify(stored),published);
 fail=true;assert.equal((await worker.fetch(req('owner'),env)).status,503);assert.equal(JSON.stringify(stored),published);
 const get=await worker.fetch(new Request('https://worker.example/api/public/snapshot',{headers:{Origin:origin,'CF-Connecting-IP':crypto.randomUUID()}}),env);assert.equal(get.status,200);assert.equal((await get.json()).projects.length,26);
 }finally{globalThis.fetch=original;}
});
test('invalid project is skipped and the filtered snapshot remains readable and idempotent',()=>{
 const input=fixture();input.projects.push({id:'unpublishable',name:'',secret:'never public'});
 const s=sanitizeStaticSnapshot(input);assert.equal(s.projects.length,26);assert.equal(s.publication.skippedProjectCount,1);assert.ok(validateStaticSnapshot(s));assert.deepEqual(sanitizeStaticSnapshot(s),s);
 const reordered=Object.fromEntries(Object.entries(s).reverse());assert.ok(validateStaticSnapshot(reordered));
});
test('frozen release deliveries ignore unreviewed private edits and contain only reviewed links',()=>{
 const input=fixture();input.deliveries=[{title:'private draft',evidence:'https://drive.google.com/secret'}];
 const s=sanitizeStaticSnapshot(input,{reviewDeliveries:true});assert.equal(s.deliveries.length,10);assert.ok(!JSON.stringify(s).includes('private draft'));assert.ok(s.deliveries.every(d=>d.evidence.startsWith('https://workspace.danielxu.cn/docs/DELIVERY_EVIDENCE.md#')));
});

test('stored reviewed deliveries remain readable independently of the current release list',()=>{
 const s=fixture();s.deliveries=s.deliveries.slice(0,3);assert.ok(validateStaticSnapshot(s));
});
