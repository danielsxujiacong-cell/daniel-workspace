import { shanghaiDateKey, shiftDateKey } from "./home-activity.js";
const audit = "https://workspace.danielxu.cn/docs/DELIVERY_EVIDENCE.md";
const archivedMini = {id:"mini",date:"2026-09-29",projectName:"《两室一弹》微信小程序",workspaceName:"两室一弹微信小程序",title:"微信小程序正式上线",detail:"正式上线日期由所有者于 2026-10-16 明确确认为 2026-09-29。仅从首页交付时间轴移除，原项目和日期确认记录保留。",status:"正式上线",demo:""};
export const ARCHIVED_HOME_DELIVERIES = Object.freeze([Object.freeze(archivedMini)]);
const records = [
 {id:"content-prototype",date:"2026-09-19",projectName:"AI 内容情报原型",workspaceName:"AI 内容情报系统",title:"热点采集、评分与报告原型代码完成",status:"原型完成",detail:"9 月 19 日源码归档包含采集、热度排序、中文解释与 Markdown 报告管线；无密钥时为规则摘要，尚不能证明完整 AI 筛选改写链路实测跑通。",demo:""},
 {id:"portfolio-mvp",date:"2026-09-26",projectName:"Apple 风个人作品集",workspaceName:"Daniel website",title:"滚动叙事 MVP 恢复并发布",status:"正式上线",detail:"恢复后的 GSAP 滚动页面经桌面、手机断点与回退检查，Pages 返回 200；Spline 地址仍是占位，不能称为完整 Spline 模型交付。",demo:"https://danielsxujiacong-cell.github.io/personal-portfolio/"},
 {id:"investment",date:"2026-09-27",projectName:"AI Investment Dashboard",workspaceName:"AI Investment Dashboard",title:"真实美股行情 MVP 上线",status:"正式上线",detail:"实时 Finnhub 代理与客户端已部署，五个报价接口和公开 Watchlist、NVDA 页面验收通过；9 月 26 日仅有初始界面与部署配置。",demo:"https://invest.danielxu.cn/"},
 {id:"pomodoro",date:"2026-09-28",projectName:"Pomodoro Garden",workspaceName:"番茄 · 专注空间",title:"核心专注状态云同步 MVP 发布",status:"正式上线",detail:"远端发布交接确认统计、周期、植物和设置云同步，以及刷新、重新登录和新 origin 恢复验收；不把隔离浏览器验证扩写为双真机实测。",demo:"https://danielsxujiacong-cell.github.io/pomodoro-focus/"},
 {id:"hub",date:"2026-10-09",projectName:"Daniel Project Hub",workspaceName:"Daniel Project Hub",title:"作品导航与筛选原型完成",status:"原型完成",detail:"V1.1-A 构建与桌面、手机筛选验收已记录；当日检查的是所链接网站，不足以证明 Hub 自身已上线，后续 10 月 11 日有公网发布核验。",demo:"https://hub.danielxu.cn/"},
 {id:"knowledge",date:"2026-10-10",projectName:"企业 AI 知识库",workspaceName:"",title:"飞书私聊制度检索问答测试通过",status:"测试通过",detail:"0.2.0 记录真实飞书私聊经 Dify 检索并返回回答及来源；模型配置目标为 GLM，后续审批链回答仍有准确性缺口。",demo:"https://hub.danielxu.cn/flowops/knowledge"},
 {id:"procurement-test",date:"2026-10-11",projectName:"n8n 采购自动化",workspaceName:"n8n AI Automation Lab",title:"AI 分析写回、读回与防重测试通过",status:"测试通过",detail:"候选流程测试记录确认四个 AI 字段写回、读回及重复执行跳过；候选未发布，正式新版仍待真实新工单端到端复验。",demo:"https://hub.danielxu.cn/flowops"},
 {id:"flowops",date:"2026-10-12",projectName:"FlowOps AI",workspaceName:"Daniel Project Hub",title:"知识库与采购流程体验入口整合上线",status:"正式上线",detail:"独立知识库、历史采购案例与明确标注为模拟的流程回放已部署，页面和公开资源返回 200；网页不触发真实审批。",demo:"https://hub.danielxu.cn/flowops"},
 {id:"daily",date:"2026-10-12",projectName:"AI 运营日报",workspaceName:"",title:"日报生成、归档与网页展示测试通过",status:"测试通过",detail:"两次 n8n 实际执行成功生成 GLM 报告，同日更新历史并完成网页发布；公开内容含标记的测试与虚构项目，飞书群推送未发送。",demo:"https://hub.danielxu.cn/daily-brief"},
 {id:"portfolio",date:"2026-10-16",projectName:"个人作品集",workspaceName:"Daniel website",title:"五段式求职作品集正式发布",status:"正式上线",detail:"真实产品预览替换旧模拟界面，截图压缩及减少动态效果适配完成；发布提交与 Pages 成功部署记录已核对。",demo:"https://danielsxujiacong-cell.github.io/personal-portfolio/"},
];
export const PENDING_DELIVERIES = Object.freeze([
 {id:"candidate-content",date:"2026-09-19",projectName:"AI 内容生产自动化",workspaceName:"AI 内容情报系统",title:"完整 AI 筛选、改写与报告链路跑通",detail:"已有原型代码，但没有找到完整 AI 链路运行验收记录。",status:"待审核"},
 {id:"candidate-spline",date:"2026-09-20",projectName:"Apple 3D 个人作品集",workspaceName:"Daniel website",title:"GSAP + Spline 完整 MVP 完成",detail:"09/20 日期缺少来源；09/26 恢复版本的 Spline 地址仍为占位。",status:"待审核"},
 {id:"candidate-pomodoro-devices",date:"2026-09-28",projectName:"Pomodoro Garden",workspaceName:"番茄 · 专注空间",title:"手机和电脑双真机云同步实测通过",detail:"已核实云同步与新 origin 恢复，但缺少明确的双真机实测记录。",status:"待审核"},
 {id:"candidate-approval",date:"2026-10-09",projectName:"审批自动化 MVP",workspaceName:"n8n AI Automation Lab",title:"申请、审批、记录、通知与防重闭环验证",detail:"未找到支持 10/09 全链路验收的记录；10/11 候选 AI 写回测试不能替代该日期与范围。",status:"待审核"},
].map(r=>Object.freeze({...r,evidence:`${audit}#pending`,demo:""})));
// Explicit release artifact. Owner-local edits never mutate or enter this snapshot.
export const PUBLISHED_DELIVERIES = Object.freeze({publishedAt:"2026-10-16",items:Object.freeze(records.map(r=>Object.freeze({...r,evidence:`${audit}#${r.id}`})))});
export const deliveryStorageKey = userId => `daniel-workspace-deliveries-v1:${userId}`;
export function validDelivery(value) {
 if(!value || !/^[a-z0-9-]{1,90}$/.test(value.id||"") || !/^\d{4}-\d{2}-\d{2}$/.test(value.date||""))return null;
 const d=new Date(value.date+"T12:00:00Z");if(Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==value.date)return null;
 const clean={id:value.id,date:value.date};
 for(const key of ["projectName","workspaceName","title","detail"]) clean[key]=typeof value[key]==="string"?value[key].trim().slice(0,key==="detail"?900:100):"";
 if(!clean.projectName||!clean.title||!clean.detail)return null;
 for(const key of ["demo","evidence"]) {try{const u=new URL(value[key]);clean[key]=["https:","http:"].includes(u.protocol)&&!u.username&&!u.password?u.href:"";}catch{clean[key]="";}}
 clean.status=["原型完成","测试通过","正式上线","待审核","人工确认"].includes(value.status)?value.status:(value.ownerConfirmed?"人工确认":"");
 clean.ownerConfirmed=value.ownerConfirmed===true;
 return clean;
}
export function readDeliveryEdits(storage,userId) {
 if(!userId)return [];
 try{const data=JSON.parse(storage.getItem(deliveryStorageKey(userId))||"[]");return Array.isArray(data)?data.slice(0,40).map(validDelivery).filter(r=>r?.ownerConfirmed):[];}catch{return [];}
}
export function saveDeliveryEdit(storage,userId,edits,value) {
 const item=validDelivery({...value,ownerConfirmed:true});if(!userId||!item)throw new Error("请填写有效日期、项目与成果内容");
 const next=[...edits.filter(r=>r.id!==item.id),item].slice(-40);
 storage.setItem(deliveryStorageKey(userId),JSON.stringify(next));return next;
}
export function deliveryView({publicMode=false,edits=[],now=Date.now(),projects=[]}={}) {
 const end=publicMode?PUBLISHED_DELIVERIES.publishedAt:shanghaiDateKey(now),start=shiftDateKey(end,-29);
 const map=new Map(PUBLISHED_DELIVERIES.items.map(r=>[r.id,{...r}]));
 if(!publicMode)for(const value of edits){const r=validDelivery(value);if(r?.ownerConfirmed&&r.status!=="待审核")map.set(r.id,r);}
 return [...map.values()].filter(r=>r.id!=="mini"&&r.date>=start&&r.date<=end).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id)).slice(-10).map(r=>({...r,projectId:projects.find(p=>p.name===r.workspaceName)?.id||""}));
}

export function deliveryWindow(publicMode=false,now=Date.now()) {
 const endDate=publicMode?PUBLISHED_DELIVERIES.publishedAt:shanghaiDateKey(now);
 return {startDate:shiftDateKey(endDate,-29),endDate};
}
export function layoutDeliveryDays(events) {
 const sorted=[...events].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
 return {groups:sorted.map(e=>({date:e.date,items:[e]}))};
}
