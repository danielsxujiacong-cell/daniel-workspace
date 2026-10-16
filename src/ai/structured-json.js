// Accept a complete JSON object, optionally surrounded by prose/code fences.
// Never repair a truncated object or invent missing fields.
export function parseStructuredJSON(content) {
  if (typeof content !== 'string' || content.length > 40000) throw Error('GLM 未返回完整 JSON 内容，请重试。');
  const value = content.trim().replace(/^\uFEFF/,'');
  try { const parsed = JSON.parse(value); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed; } catch {}
  let depth=0,start=-1,inString=false,escape=false;
  for (let i=0;i<value.length;i++) {
    const c=value[i];
    if (inString) { if (escape) escape=false; else if(c==='\\')escape=true; else if(c==='"')inString=false; continue; }
    if(c==='"'&&depth>0){inString=true;continue;}
    if(c==='{'){if(depth===0)start=i;depth++;}
    if(c==='}'&&depth>0&&--depth===0){try{return JSON.parse(value.slice(start,i+1));}catch{}}
  }
  throw Error('GLM 返回的 JSON 不完整或格式无效，请重试。');
}
