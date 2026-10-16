import test from "node:test";
import assert from "node:assert/strict";
import {PUBLISHED_DELIVERIES,deliveryView,readDeliveryEdits,saveDeliveryEdit,deliveryStorageKey,validDelivery} from "../src/product-deliveries.js";
const now=new Date("2026-10-16T12:00:00+08:00");
test("eight frozen cross-project deliveries are date-sorted and Workspace appears once",()=>{
 const rows=deliveryView({publicMode:true,now});assert.equal(rows.length,8);
 assert.equal(rows.filter(r=>r.projectName==="Daniel Workspace").length,1);
 assert.deepEqual(rows.map(r=>r.date),rows.map(r=>r.date).sort());
 assert.equal(rows.find(r=>r.id==="mini").date,"2026-09-29");assert.match(rows.find(r=>r.id==="mini").title,/正式上线/);
 assert.ok(rows.every(r=>r.evidence.startsWith("https://workspace.danielxu.cn/docs/DELIVERY_EVIDENCE.md#")));
 assert.ok(Object.isFrozen(PUBLISHED_DELIVERIES.items)&&Object.isFrozen(PUBLISHED_DELIVERIES.items[0]));
});
test("private account-local edits survive reload but cannot change published visitor deliveries",()=>{
 const values=new Map();const storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
 const original=JSON.stringify(deliveryView({publicMode:true,now}));
 const changed={...PUBLISHED_DELIVERIES.items[0],date:"2026-10-15",title:"Owner confirmed correction"};
 const edits=saveDeliveryEdit(storage,"owner-a",[],changed);
 assert.equal(readDeliveryEdits(storage,"owner-a")[0].date,"2026-10-15");assert.deepEqual(readDeliveryEdits(storage,"owner-b"),[]);
 assert.equal(deliveryView({edits,now}).find(r=>r.id==="mini").title,changed.title);
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
 const projects=[{id:"guest-workspace",name:"Daniel Workspace"},{id:"guest-mini",name:"两室一弹微信小程序"}];
 const guest=deliveryView({publicMode:true,projects,now});
 assert.equal(guest.find(r=>r.id==="mini").projectId,"guest-mini");assert.equal(guest.find(r=>r.id==="workspace").projectId,"guest-workspace");
 assert.equal(guest.find(r=>r.id==="daily").projectId,"");
 assert.equal(deliveryView({now:new Date("2027-01-01")}).length,0);
 assert.equal(deliveryView({publicMode:true,now:new Date("2027-01-01")}).length,8);
});
