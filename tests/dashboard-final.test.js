import test from "node:test";
import assert from "node:assert/strict";
import { universeLabels, topActivity, syncLabel } from "../src/dashboard-final.js";
import { buildProjectUniverse, buildOutcomeTimeline } from "../src/dashboard-v4.js";

test("five flagship labels fit compact scenes without colliding with labels or planets",()=>{
 const names=["Daniel Workspace","AI Investment Dashboard","Daniel Project Hub","Daniel website","n8n AI Automation Lab"];
 for(const width of [390,500]) {
  const m=buildProjectUniverse({projects:Array.from({length:26},(_,i)=>({id:`p${i}`,name:names[i]||`Project ${i}`})),width,height:360});
  const labels=universeLabels(m.nodes,width,360);assert.equal(labels.length,5);
  for(const a of labels){assert.ok(a.x>=0&&a.y>=0&&a.x+a.width<=width&&a.y+a.height<=360);
   for(const b of labels.filter(b=>a!==b)) assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y);
   for(const n of m.nodes){const x=Math.max(a.x,Math.min(n.x,a.x+a.width)),y=Math.max(a.y,Math.min(n.y,a.y+a.height));assert.ok(Math.hypot(n.x-x,n.y-y)>=n.radius+5);}
  }
 }
});
test("Top 5 sorts real counts without filling gaps or counting invalid values",()=>{
 const rows=Array.from({length:8},(_,i)=>({projectId:String(i),projectName:`P${i}`,githubCommits:i,workLogs:1}));
 assert.deepEqual(topActivity(rows).map(r=>r.projectId),["7","6","5","4","3"]);
 assert.equal(topActivity([{githubCommits:null,workLogs:0},{githubCommits:0,workLogs:0}]).length,0);
 assert.equal(topActivity(rows.slice(0,1)).length,1);
});
test("only explicit sync errors show failure; successful recovery clears the label",()=>{
 assert.match(syncLabel({status:"error"}),/失败/);assert.match(syncLabel({status:"offline"}),/离线/);
 for(const status of ["loading","syncing","migrating","migration","idle","unknown"])assert.doesNotMatch(syncLabel({status}),/失败/);
 assert.match(syncLabel({status:"synced",lastSyncedAt:"2026-10-16T03:00:00Z",error:"old failure"}),/已同步/);
});
test("timeline includes saved outcomes and safe evidence only, never arbitrary commit events",()=>{
 const events=buildOutcomeTimeline({now:new Date("2026-10-16T12:00:00+08:00"),projects:[{id:"p",name:"P"}],workLogs:[{projectId:"p",workDate:"2026-10-15",completedItems:"Delivered",evidenceLinks:["https://example.com/proof","javascript:alert(1)","https://user:password@example.com"]}]});
 assert.deepEqual(events.find(e=>e.kind==="成果").evidenceLinks,["https://example.com/proof"]);
 assert.ok(events.every(e=>["成果","上线","版本"].includes(e.kind)));
});
