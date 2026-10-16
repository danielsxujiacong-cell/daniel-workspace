// Presentation helpers: no network, storage, authentication or business writes.
export function universeLabels(nodes, width, height) {
  const placed = [];
  const intersects = (a,b) => a.x < b.x+b.width+5 && a.x+a.width+5 > b.x && a.y < b.y+b.height+5 && a.y+a.height+5 > b.y;
  for (const node of nodes.filter(n=>n.flagship).slice(0,7)) {
    const labelWidth = [...node.project.name].reduce((w,c)=>w+(/[^\x00-\xff]/.test(c)?9.5:5.1),0)+4;
    const candidates = [];
    for (const dy of [node.radius+12,-node.radius-22,30,-38,52,-60]) {
      for (const dx of [-labelWidth/2,12,-labelWidth-12]) candidates.push({x:node.x+dx,y:node.y+dy,width:labelWidth,height:12});
    }
    for(let y=42;y<height-18;y+=18) for(let x=10;x<width-labelWidth-10;x+=16) candidates.push({x,y,width:labelWidth,height:12});
    const free = candidates.filter(r=>r.x>=8 && r.y>=38 && r.x+r.width<=width-8 && r.y+r.height<=height-8
      && !placed.some(p=>intersects(r,p))
      && !nodes.some(n=>{const x=Math.max(r.x,Math.min(n.x,r.x+r.width)),y=Math.max(r.y,Math.min(n.y,r.y+r.height));return Math.hypot(n.x-x,n.y-y)<n.radius+5;}));
    free.sort((a,b)=>Math.hypot(a.x+a.width/2-node.x,a.y+6-node.y)-Math.hypot(b.x+b.width/2-node.x,b.y+6-node.y));
    if(free[0]) placed.push({...free[0],id:node.id});
  }
  return placed;
}

export function localRhythm(now = new Date()) {
  const hour = now.getHours()+now.getMinutes()/60;
  return {time:`${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`,
    angle:hour*15, bars:Array.from({length:24},(_,i)=>({angle:i*15,opacity:.18+.72*(1+Math.cos((i-hour)/24*Math.PI*2))/2}))};
}

export function topActivity(rows=[]) {
  return rows.filter(r=>Number.isSafeInteger(r.githubCommits)&&r.githubCommits>=0&&Number.isSafeInteger(r.workLogs)&&r.workLogs>=0)
    .filter(r=>r.githubCommits+r.workLogs>0).slice().sort((a,b)=>(b.githubCommits+b.workLogs)-(a.githubCommits+a.workLogs)||String(a.projectName).localeCompare(String(b.projectName))).slice(0,5);
}

export function syncLabel(state) {
  if(state.status==="synced") {
    const date=new Date(state.lastSyncedAt);
    return Number.isNaN(date.getTime())?"已同步":`已同步 ${date.toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit"})}`;
  }
  return ({syncing:"正在同步…",migrating:"正在迁移…",loading:"正在读取…",offline:"离线 · 保留缓存",migration:state.migrationDismissed?"本机保存":"待迁移",error:"同步失败 · 重试"})[state.status] || "等待同步";
}
