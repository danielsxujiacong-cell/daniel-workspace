import { shanghaiDateKey, shiftDateKey } from "./home-activity.js";
const audit = "https://workspace.danielxu.cn/docs/DELIVERY_EVIDENCE.md";
const records = [
 {id:"mini",date:"2026-09-29",projectName:"《两室一弹》微信小程序",workspaceName:"两室一弹微信小程序",title:"微信小程序正式上线",detail:"正式上线日期由所有者明确确认为 2026 年 9 月 29 日。多人建房、加入、随机发牌与私密身份查看已实现；同日文档记录了 1.1.3 开发版编译上传。上线日期的依据是所有者确认，不以开发版上传推断正式发布。",demo:""},
 {id:"knowledge",date:"2026-10-11",projectName:"企业 AI 知识库助手",workspaceName:"",title:"飞书制度问答与采购申请入口完成实测",detail:"用户确认飞书私聊收到制度回答，并能打开采购申请表。Dify 已配置采购、人事、运营检索路由；部分审批链回答和运营分类准确性仍需改进，不宣称全部问答验收通过。",demo:"https://hub.danielxu.cn/flowops/knowledge"},
 {id:"hub",date:"2026-10-12",projectName:"Daniel Project Hub",workspaceName:"Daniel Project Hub",title:"三项企业 AI 产品独立体验页上线",detail:"知识库助手、采购流程与运营日报拆为独立体验入口。生产构建、桌面与手机检查通过，部署记录确认首页、三条体验路由及公开数据均返回 200。",demo:"https://hub.danielxu.cn/"},
 {id:"flowops",date:"2026-10-12",projectName:"FlowOps AI 企业流程展示",workspaceName:"Daniel Project Hub",title:"采购历史案例与三种流程回放上线",detail:"展示脱敏采购历史案例，以及批准、拒绝、重复事件三种明确标注为模拟的回放。已核对生产页面与资源部署；网页不触发真实审批，示例金额不作为真实业务金额。",demo:"https://hub.danielxu.cn/flowops"},
 {id:"investment",date:"2026-10-12",projectName:"AI Investment Dashboard",workspaceName:"AI Investment Dashboard",title:"真实行情搜索与市场发现首页上线",detail:"市场搜索、精选股票实时行情、一个月趋势与现有 AI Brief 入口完成部署核验。已验证实时报价、搜索与 20 个历史点；旧版 Brief 仍有跨账号及前日报告标签验收待完成。",demo:"https://invest.danielxu.cn/"},
 {id:"daily",date:"2026-10-12",projectName:"AI 企业运营日报自动化",workspaceName:"",title:"日报生成、历史归档与网页发布跑通",detail:"n8n 两次真实执行完成 GLM 分析，同日更新一条报告历史；网页读取已发布结果，计划任务同步验证成功。公开内容含明确标记的测试与虚构项目；飞书群推送尚未获授权、未发送。",demo:"https://hub.danielxu.cn/daily-brief"},
 {id:"workspace",date:"2026-10-12",projectName:"Daniel Workspace",workspaceName:"Daniel Workspace",title:"26 个项目工作台提供隔离的公开只读视图",detail:"所有者手动发布的脱敏快照已上线，覆盖 26 个项目；核对了公开读取、项目详情与私人数据隔离。这是可运行产品能力交付，不是本轮 Dashboard 版本更新。",demo:"https://workspace.danielxu.cn/"},
 {id:"portfolio",date:"2026-10-16",projectName:"个人作品集",workspaceName:"Daniel website",title:"五段式求职作品集正式发布",detail:"真实产品预览取代旧模拟界面，完成截图压缩、本地动画资源和减少动态效果适配；发布提交及 GitHub Pages 部署任务已核对成功。",demo:"https://danielsxujiacong-cell.github.io/personal-portfolio/"},
];
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
 if(!publicMode)for(const value of edits){const r=validDelivery(value);if(r?.ownerConfirmed)map.set(r.id,r);}
 return [...map.values()].filter(r=>r.date>=start&&r.date<=end).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id)).slice(-8).map(r=>({...r,projectId:projects.find(p=>p.name===r.workspaceName)?.id||""}));
}
