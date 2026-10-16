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

test('only the two approved Daniel Workspace tasks retain their real public fields and stable IDs',()=>{
 const input=fixture(),projectId=input.projects[0].id;
 input.projects[0].name='Daniel Workspace';
 input.tasks=[
  {id:'private-one',projectId,title:'项目资料完善与历史成果整理',description:'大量 Projects 详情页只有名称、简单介绍和扫描备注，缺乏实际成果、工作记录、下一步及相关资料',status:'todo'},
  {id:'private-two',projectId,title:'优化 Daniel Workspace V4.4',description:'当前时间线过高、日期节点分布太散，中间存在大量留白，同一天成果上下错开，视觉不协调。',status:'done'},
  {id:'private-three',projectId,title:'不可公开的任务',description:'private detail',status:'todo'},
  {id:'wrong-status',projectId,title:'优化 Daniel Workspace V4.4',description:'当前时间线过高、日期节点分布太散，中间存在大量留白，同一天成果上下错开，视觉不协调。',status:'todo'},
 ];
 const s=createStaticSnapshot({now:'2026-10-16T10:00:00Z',data:input,activityModel:{startDate:'2026-09-17',endDate:'2026-10-16'}});
 assert.deepEqual(s.tasks,[
  {id:'task-0001',title:'项目资料完善与历史成果整理',description:'大量 Projects 详情页只有名称、简单介绍和扫描备注，缺乏实际成果、工作记录、下一步及相关资料',projectId:'project-001',status:'todo',priority:'',due:''},
  {id:'task-0002',title:'优化 Daniel Workspace V4.4',description:'当前时间线过高、日期节点分布太散，中间存在大量留白，同一天成果上下错开，视觉不协调。',projectId:'project-001',status:'done',priority:'',due:''},
 ]);
 assert.ok(validateStaticSnapshot(s));
});

test('actual publisher freezes already cached counts while Home is loading without a network precheck',async()=>{
 const {readFile}=await import('node:fs/promises'),{runInNewContext}=await import('node:vm');
 const {buildHomeActivity}=await import('../src/home-activity.js');const {parsePublicGitHubRepository}=await import('../src/github/public-api.js');
 const source=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
 const start=source.indexOf('async function generateAndPublishVisitorSnapshot()'),end=source.indexOf('\nfunction render() {',start);
 let published;
 const context={publicSnapshotMode:false,workspaceActive:true,snapshotPreviewRequestId:0,workspaceAuth:{client:{},userId:'owner'},db:{projects:[{id:'private-id',name:'Cached project',github:'https://github.com/acme/project',description:'Public purpose'}],tasks:[]},
 ui:{publicSnapshotPreview:{status:'idle'},homeActivity:{status:'loading',model:null},universeActivities:{},dashboardWorkLogs:{status:'ready',items:[{projectId:'private-id',workDate:'2026-10-12'}]}},
 cloudWorkspaceAvailable:()=>true,render:()=>{},toast:()=>{},Date,buildHomeActivity,createStaticSnapshot,parsePublicGitHubRepository,projectIntroduction:p=>p.description,projectShowcase:()=>({features:[],outcomes:[]}),GITHUB_ACTIVITY_CACHE_TTL_MS:900000,
 currentHomeActivityRange:()=>({valid:true,startDate:'2026-09-17',endDate:'2026-10-16'}),
 loadGitHubActivityCacheForRange:()=>({repositories:[{fullName:'acme/project',complete:true,truncated:false,dailyCounts:[{date:'2026-10-12',count:7}]}]}),
 publishPublicSnapshot:async s=>{published=s;return {counts:{projects:s.projects.length},publishedAt:'2026-10-16T10:00:00.000Z'};}};
 runInNewContext(source.slice(start,end)+';globalThis.run=generateAndPublishVisitorSnapshot;',context);
 await context.run();assert.equal(context.ui.publicSnapshotPreview.status,'published');assert.equal(published.activity.githubDailyCounts.find(d=>d.date==='2026-10-12').count,7);assert.equal(published.workLogs.length,1);assert.equal(published.projects[0].github,'');
});
