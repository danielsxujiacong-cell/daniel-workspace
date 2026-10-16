import { PUBLISHED_DELIVERIES } from "./product-deliveries.js";
import { REVIEWED_KNOWLEDGE, REVIEWED_DECISIONS } from "./reviewed-public-materials.js";

const secret = /(?:Bearer\s+\S+|\b(?:gh[pousr]_|github_pat_|sk-)[\w-]{8,}|\beyJ[\w-]+\.[\w-]+\.[\w-]+|-----BEGIN[\s\S]*?PRIVATE KEY-----[\s\S]*?-----END[\s\S]*?PRIVATE KEY-----|(?:\b[A-Za-z]:[\\/]|\\\\)[^\n,;，；]*|\/(?:Users|home|private|Volumes|mnt)\/[^\n,;，；]*|\b(?:api[_-]?key|secret|password|passwd|cookie|set-cookie|access[_-]?token|refresh[_-]?token|authorization|session[_-]?id|token)\b\s*[:=]\s*[^\n,;，；]+|https?:\/\/\S+|\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b)/gi;
const text = (v,n=2000) => typeof v === "string" ? v.replace(secret,"[已隐藏]").replace(/["']?\b(?:api[_-]?key|secret|password|passwd|cookie|set-cookie|access[_-]?token|refresh[_-]?token|authorization|session[_-]?id|token)["']?\s*[:=]\s*["']?[^\n,;，；]+/gi,"[已隐藏]").replace(/(?<!\d)(?:\+?86[-\s]?)?1[3-9]\d{9}(?!\d)|(?<!\d)(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}(?!\d)/g,"[已隐藏]").trim().slice(0,n) : "";
const date = v => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v;
const count = v => Number.isSafeInteger(v) && v >= 0 && v <= 1000000;
function website(v) {
 try { const u=new URL(v), h=u.hostname.toLowerCase();
  if(u.protocol!=="https:"||u.username||u.password||u.port||u.search||u.hash||h.includes(":")||/^\d+(?:\.\d+){3}$/.test(h)||h==="localhost"||/\.(?:local|internal|localhost)$/.test(h)||/(?:^|\.)(?:github\.com|drive\.google\.com|docs\.google\.com|dropbox\.com|notion\.so|linear\.app|figma\.com|1drv\.ms|onedrive\.live\.com|sharepoint\.com|box\.com|slack\.com|atlassian\.net|airtable\.com)$/.test(h))return "";
  return u.href;
 }catch{return "";}
}
const rows = (v,n) => Array.isArray(v) ? v.slice(0,n) : [];
const publicTaskAllowlist = Object.freeze([
 {id:"task-project-materials-history",title:"项目资料完善与历史成果整理",description:"大量 Projects 详情页只有名称、简单介绍和扫描备注，缺乏实际成果、工作记录、下一步及相关资料",status:"todo"},
 {id:"task-workspace-v44-layout",title:"优化 Daniel Workspace V4.4",description:"当前时间线过高、日期节点分布太散，中间存在大量留白，同一天成果上下错开，视觉不协调。",status:"done"},
]);
const reviewedKnowledge = input => rows(input,2000).flatMap(k=>{
 const approved=REVIEWED_KNOWLEDGE.find(r=>['title','content','summary'].every(f=>k?.[f]===r[f]));
 return approved?[{...approved,projectId:k.projectId}]:[];
});

// A pure projection shared by the browser and Worker. No external APIs or raw bodies.
export function sanitizeStaticSnapshot(input, { reviewDeliveries=false } = {}) {
 if(input?.schemaVersion!==2 || !Array.isArray(input.projects) || input.projects.length>200 || !date(input.activity?.startDate)||!date(input.activity?.endDate)||input.activity.startDate>input.activity.endDate||Date.parse(input.activity.endDate)-Date.parse(input.activity.startDate)>365*86400000) throw Error("快照版本、项目或日期范围无效；旧快照保持不变。");
 const projects=[], idMap=new Map();
 for(const p of input.projects){if(!p||!text(p.name,200)||typeof p.id!=="string"||idMap.has(p.id))continue;
  const id=`project-${String(projects.length+1).padStart(3,"0")}`;idMap.set(p.id,id);
  projects.push({id,name:text(p.name,200),description:text(p.description),status:text(p.status,100),stage:text(p.stage,200),next:text(p.next),url:website(p.url),github:"",notes:"",isPinned:p.isPinned===true,publicDetails:{features:rows(p.publicDetails?.features,20).map(v=>text(v,500)),outcomes:rows(p.publicDetails?.outcomes,20).map(v=>text(v,500))}});
 }
 if(!projects.length)throw Error("没有可发布的安全项目；旧快照保持不变。");
 const a=input.activity,inRange=d=>date(d)&&d>=a.startDate&&d<=a.endDate;
 const daily=new Map();for(const d of rows(a.githubDailyCounts,366)){if(inRange(d?.date)&&count(d.count))daily.set(d.date,{date:d.date,count:d.count});}
 const perProject=new Map();for(const d of rows(a.githubProjectDailyCounts,100000)){const projectId=idMap.get(d?.projectId);if(projectId&&inRange(d.date)&&count(d.count))perProject.set(`${projectId}:${d.date}`,{projectId,date:d.date,count:d.count});}
 const hours=rows(a.githubHourlyCounts,24).filter(d=>Number.isInteger(d?.hour)&&d.hour>=0&&d.hour<24&&count(d.count)).map(d=>({hour:d.hour,count:d.count}));
 const hourly=a.githubHourlyComplete===true&&hours.length===24&&new Set(hours.map(d=>d.hour)).size===24;
 const publicProject=projects.find(p=>p.name==="Daniel Workspace"), publicSourceProject=publicProject&&input.projects.find(p=>p.name==="Daniel Workspace");
 const tasks=publicTaskAllowlist.flatMap((approved,i)=>{
  const task=rows(input.tasks,2000).find(t=>t?.title===approved.title&&t?.description===approved.description&&t?.status===approved.status
   &&(!t.projectId||t.projectId===publicSourceProject?.id));
  return task&&publicProject?[{id:`task-${String(i+1).padStart(4,"0")}`,title:approved.title,description:approved.description,projectId:publicProject.id,status:approved.status,priority:"",due:""}]:[];
 });
 const workLogs=rows(input.workLogs,5000).filter(d=>idMap.has(d?.projectId)&&inRange(d.workDate)).map((d,i)=>({id:`work-log-${String(i+1).padStart(4,"0")}`,projectId:idMap.get(d.projectId),workDate:d.workDate,completedItems:"",outcomes:"",nextStep:""}));
 const timestamp=v=>typeof v==="string"&&Number.isFinite(Date.parse(v))?new Date(v).toISOString():"";
 return {schemaVersion:2,generatedAt:timestamp(input.generatedAt)||new Date().toISOString(),publishedAt:timestamp(input.publishedAt),
  ...(typeof input.snapshotVersion === 'string' && /^v48-[a-f0-9]{32}$/.test(input.snapshotVersion) ? {snapshotVersion:input.snapshotVersion} : {}),
  projects,tasks,workLogs,
  knowledge: reviewedKnowledge(input.knowledge).map((k,i)=>({id:`knowledge-${String(i+1).padStart(4,'0')}`,type:text(k.type,100),title:text(k.title,200),content:text(k.content,8000),summary:text(k.summary),tags:rows(k.tags,20).map(v=>text(v,100)),projectId:idMap.get(k.projectId)||''})),
  decisions: rows(input.decisions,2000).filter(k=>REVIEWED_DECISIONS.some(r=>Object.keys(r).every(f=>JSON.stringify(k?.[f])===JSON.stringify(r[f])))).map((k,i)=>({id:`decision-${String(i+1).padStart(4,'0')}`,question:text(k.question,500),options:rows(k.options,10).map(v=>text(v,500)),goal:text(k.goal),time:text(k.time),cost:text(k.cost),risk:text(k.risk),recommendation:text(k.recommendation),final:text(k.final),reason:text(k.reason),projectId:idMap.get(k.projectId)||''})),
  summaries:{dailyBrief:"",weeklySummary:""},
  activity:{startDate:a.startDate,endDate:a.endDate,githubDailyCounts:[...daily.values()].sort((a,b)=>a.date.localeCompare(b.date)),githubProjectDailyCounts:[...perProject.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.projectId.localeCompare(b.projectId)),githubRepositoryCount:count(a.githubRepositoryCount)?Math.min(200,a.githubRepositoryCount):0,githubComplete:a.githubComplete===true,workLogsComplete:a.workLogsComplete===true,githubHourlyCounts:hourly?hours:[],githubHourlyComplete:hourly,githubWeekdayHourCounts:[],githubWeekdayHourlyComplete:false},
  // Read stored releases independently of future source-code release edits.
  deliveries: rows(reviewDeliveries ? PUBLISHED_DELIVERIES.items : input.deliveries,50).filter(d=>date(d?.date)).map(d=>({
    id:text(d.id,100),date:d.date,projectName:text(d.projectName,200),workspaceName:text(d.workspaceName,200),title:text(d.title,200),status:text(d.status,100),detail:text(d.detail),demo:website(d.demo),
    evidence:typeof d.evidence==="string" && /^https:\/\/workspace\.danielxu\.cn\/docs\/DELIVERY_EVIDENCE\.md#[A-Za-z0-9-]+$/.test(d.evidence) ? d.evidence : ""
  })),
  publication:{projectCount:projects.length,skippedProjectCount:input.projects.length-projects.length+(count(input.publication?.skippedProjectCount)?input.publication.skippedProjectCount:0),omittedRepositoryFields:projects.length,activityPartial:a.githubComplete!==true||a.workLogsComplete!==true}
 };
}
function canonical(value) {
 if(Array.isArray(value)) return value.map(canonical);
 if(value && typeof value==="object") return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
 return value;
}
export function validateStaticSnapshot(input) {
 try { return JSON.stringify(canonical(input))===JSON.stringify(canonical(sanitizeStaticSnapshot(input))); }catch{return false;}
}

export function createStaticSnapshot({data,activityModel,now=new Date().toISOString()}) {
 const model=activityModel||{}, endDate=now.slice(0,10),start=new Date(`${endDate}T00:00:00Z`);start.setUTCDate(start.getUTCDate()-29);
 const projects=data.projects.map(p=>({id:p.id,name:p.name,description:p.description,status:p.status,stage:p.stage,next:p.next,url:p.url,isPinned:p.isPinned,publicDetails:p.publicDetails}));
 const byName=new Map(projects.map(p=>[p.name,p.id])), workLogs=[],githubProjectDailyCounts=[];
 for(const day of model.days||[]){for(const entry of day.githubProjectCounts||[]){const projectId=byName.get(entry.name);if(projectId)githubProjectDailyCounts.push({projectId,date:day.date,count:entry.count});}
  for(const entry of day.workLogProjects||[]){const projectId=byName.get(entry.name);if(projectId&&count(entry.count)){const available=Math.min(entry.count,5000-workLogs.length);for(let i=0;i<available;i++)workLogs.push({projectId,workDate:day.date});}}
 }
 return sanitizeStaticSnapshot({schemaVersion:2,generatedAt:now,publishedAt:"",projects,tasks:data.tasks||[],workLogs,knowledge:data.knowledge||[],decisions:data.decisions||[],deliveries:PUBLISHED_DELIVERIES.items,
  activity:{startDate:model.startDate||start.toISOString().slice(0,10),endDate:model.endDate||endDate,githubDailyCounts:(model.days||[]).map(d=>({date:d.date,count:d.githubCommits})),githubProjectDailyCounts,githubRepositoryCount:model.coverage?.githubRequested||0,githubComplete:model.coverage?.githubComplete===true,workLogsComplete:model.coverage?.workLogsComplete===true,githubHourlyCounts:model.hourlyCounts||[],githubHourlyComplete:model.coverage?.hourlyComplete===true}});
}
