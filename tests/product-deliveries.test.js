import test from "node:test";
import assert from "node:assert/strict";
import {PUBLISHED_DELIVERIES,ARCHIVED_HOME_DELIVERIES,PENDING_DELIVERIES,deliveryWindow,layoutDeliveryDays,deliveryView,readDeliveryEdits,saveDeliveryEdit,deliveryStorageKey,validDelivery} from "../src/product-deliveries.js";
const now=new Date("2026-10-16T12:00:00+08:00");
test("ten verified deliveries exclude the mini program without deleting its record",()=>{
 const rows=deliveryView({publicMode:true,now});assert.equal(rows.length,10);
 assert.equal(rows.filter(r=>r.projectName==="Daniel Workspace").length,0);
 assert.deepEqual(rows.map(r=>r.date),rows.map(r=>r.date).sort());
 assert.equal(rows.find(r=>r.id==="mini"),undefined);assert.equal(ARCHIVED_HOME_DELIVERIES[0].date,"2026-09-29");
 assert.ok(rows.every(r=>r.evidence.startsWith("https://workspace.danielxu.cn/docs/DELIVERY_EVIDENCE.md#")));
 assert.ok(Object.isFrozen(PUBLISHED_DELIVERIES.items)&&Object.isFrozen(PUBLISHED_DELIVERIES.items[0]));
});
test("private account-local edits survive reload but cannot change published visitor deliveries",()=>{
 const values=new Map();const storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
 const original=JSON.stringify(deliveryView({publicMode:true,now}));
 const changed={...PUBLISHED_DELIVERIES.items[0],date:"2026-10-15",title:"Owner confirmed correction"};
 const edits=saveDeliveryEdit(storage,"owner-a",[],changed);
 assert.equal(readDeliveryEdits(storage,"owner-a")[0].date,"2026-10-15");assert.deepEqual(readDeliveryEdits(storage,"owner-b"),[]);
 assert.equal(deliveryView({edits,now}).find(r=>r.id==="content-prototype").title,changed.title);
 assert.equal(JSON.stringify(deliveryView({publicMode:true,edits,now})),original);
 assert.equal(values.size,1);assert.ok(values.has(deliveryStorageKey("owner-a")));
});
test("only confirmed valid private entries are accepted, unsafe links are stripped",()=>{
 assert.equal(validDelivery({...PUBLISHED_DELIVERIES.items[0],date:"2026-02-30"}),null);
 const value=validDelivery({...PUBLISHED_DELIVERIES.items[0],demo:"javascript:alert(1)",evidence:"https://a:b@example.com"});assert.equal(value.demo,"");assert.equal(value.evidence,"");
 assert.deepEqual(readDeliveryEdits({getItem:()=>'{invalid'},"a"),[]);
 assert.deepEqual(readDeliveryEdits({getItem:()=>JSON.stringify([{...value,ownerConfirmed:false}])},"a"),[]);
 assert.throws(()=>saveDeliveryEdit({setItem(){throw Error("full")}},"a",[],value));
});
test("project detail IDs come from actual current-mode records, never fixed private IDs",()=>{
 const projects=[{id:"guest-investment",name:"AI Investment Dashboard"},{id:"guest-pomodoro",name:"番茄 · 专注空间"}];
 const guest=deliveryView({publicMode:true,projects,now});
 assert.equal(guest.find(r=>r.id==="pomodoro").projectId,"guest-pomodoro");assert.equal(guest.find(r=>r.id==="investment").projectId,"guest-investment");
 assert.equal(guest.find(r=>r.id==="daily").projectId,"");
 assert.equal(deliveryView({now:new Date("2027-01-01")}).length,0);
 assert.equal(deliveryView({publicMode:true,now:new Date("2027-01-01")}).length,10);
});

test("compact axis sorts dates and keeps same-day milestones independent",()=>{
 const rows=deliveryView({publicMode:true,now}),layout=layoutDeliveryDays([...rows].reverse());
 assert.deepEqual(layout.groups.flatMap(g=>g.items),rows);
 assert.equal(layout.groups.length,rows.length);
 assert.ok(layout.groups.every(g=>g.items.length===1&&g.date===g.items[0].date));
 const sameDay=layout.groups.filter(g=>g.date==="2026-10-12");
 assert.equal(sameDay.length,2);
 assert.equal(layout.groups.indexOf(sameDay[1])-layout.groups.indexOf(sameDay[0]),1);
});

test("pending candidates and archived mini record cannot auto-promote into visitor deliveries",()=>{
 const mini={...ARCHIVED_HOME_DELIVERIES[0],ownerConfirmed:true};
 assert.ok(!deliveryView({now,edits:[mini,...PENDING_DELIVERIES.map(p=>({...p,ownerConfirmed:true}))]}).some(r=>r.id==="mini"||r.id.startsWith("candidate-")));
 assert.ok(!deliveryView({publicMode:true,now,edits:[{...PENDING_DELIVERIES[0],ownerConfirmed:true,status:"测试通过"}]}).some(r=>r.id.startsWith("candidate-")));
});
