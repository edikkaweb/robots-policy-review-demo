import { ENGINE, REFERENCE, LIMITS, parseRobots, matchRobots, type MatchResult } from './engine';
import { CATALOG, CATALOG_VERSION, resolveProfile } from './catalog';
import { prepareURL } from './url';
import { validateManifest, type Case, type Manifest, type Problem } from './expectations';
export const TOOL='Edikka-Robots-Review/1.0.0';
export async function sha256(value:string|Uint8Array):Promise<string> {const bytes=typeof value==='string'?new TextEncoder().encode(value):value;const hash=await crypto.subtle.digest('SHA-256',new Uint8Array(bytes));return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');}
export type Result={case:Case;row:number;prepared?:ReturnType<typeof prepareURL>;resolution?:ReturnType<typeof resolveProfile>;model?:MatchResult;decision:'allow'|'disallow'|'indeterminate'|'out_of_scope';status:'pass'|'fail'|'inconclusive'|'invalid';code:string;explanation:string};
export type FileReport={sha256:string;bytes:number;diagnostics:ReturnType<typeof parseRobots>['diagnostics'];results:Result[];summary:{pass:number;fail:number;inconclusive:number;invalid:number;evaluated:number;uncertain:number};exitCode:0|1|2};
export type Report={schemaVersion:1;createdAt:string;tool:string;engine:string;reference:string;catalog:{version:string;sha256:string};manifest:Manifest;issues:Problem[];before?:FileReport;after:FileReport;contentIdentical?:boolean;decisionChanges?:number;caseDecisionsIdentical?:boolean;exitCode:0|1|2;note:string};
export async function fileReview(text:string, input:unknown):Promise<FileReport> {
 const validated=validateManifest(input), parsed=parseRobots(text), budget={remaining:LIMITS.operations};
 const cache=new Map<string,MatchResult>();
 const globalInvalid=validated.issues.some(p=>!p.row);
 const results:Result[]=validated.manifest.cases.map((c,index)=>{
  const row=index+1;
  if(globalInvalid || validated.invalidRows.includes(row)) return {case:c,row,decision:'indeterminate',status:'invalid',code:'INVALID_CASE',explanation:validated.issues.filter(p=>!p.row||p.row===row).map(p=>p.message).join(' ')};
  const prepared=prepareURL(c.url,validated.manifest.origin);
  if(prepared.state!=='valid')return {case:c,row,prepared,decision:prepared.state==='out_of_scope'?'out_of_scope':'indeterminate',status:prepared.state==='out_of_scope'?'inconclusive':'invalid',code:prepared.state.toUpperCase(),explanation:prepared.reason!};
  const resolution=resolveProfile(parsed,c.profile,c.genericToken), key=resolution.token+'\0'+prepared.path;
  let model=cache.get(key);if(!model){model=matchRobots(parsed,resolution.token,prepared.path!,budget);cache.set(key,model);}
  const uncertain=resolution.uncertain || (resolution.profile?.operator==='google' && parsed.bytes>500*1024 ? 'Plus de 500 Kio : troncature Google non simulée ; résultat exploratoire seulement.' : undefined);
  const decision=uncertain?'indeterminate':model.decision;
  const status=decision==='indeterminate'?'inconclusive':decision===c.expected?'pass':'fail';
  return {case:c,row,prepared,resolution,model,decision,status,code:uncertain?'PROFILE_UNCERTAIN':decision==='indeterminate'?'MODEL_INCOMPLETE':status==='pass'?'EXPECTATION_MET':'EXPECTATION_MISMATCH',explanation:uncertain??model.reason};
 });
 const counts={pass:0,fail:0,inconclusive:0,invalid:0,evaluated:0,uncertain:0}; for(const r of results)counts[r.status]++;
 counts.evaluated=counts.pass+counts.fail;counts.uncertain=counts.inconclusive+counts.invalid;
 return {sha256:await sha256(text),bytes:parsed.bytes,diagnostics:parsed.diagnostics,results,summary:counts,exitCode:!results.length||validated.issues.length||counts.uncertain||!parsed.supported?2:counts.fail?1:0};
}
export async function review(input:unknown,after:string,before?:string):Promise<Report> {
 const validated=validateManifest(input);const a=await fileReview(after,input);const b=before===undefined?undefined:await fileReview(before,input);
 const changes=b?a.results.filter((r,i)=>r.decision!==b.results[i]?.decision).length:undefined;
 return {schemaVersion:1,createdAt:new Date().toISOString(),tool:TOOL,engine:ENGINE,reference:REFERENCE,catalog:{version:CATALOG_VERSION,sha256:await sha256(JSON.stringify(CATALOG))},manifest:validated.manifest,issues:validated.issues,before:b,after:a,contentIdentical:b?b.sha256===a.sha256:undefined,decisionChanges:changes,caseDecisionsIdentical:changes===undefined?undefined:changes===0,exitCode:a.exitCode===2||b?.exitCode===2?2:a.exitCode,note:'Bilan de la version candidate. Une attente nouvelle non satisfaite auparavant n’est pas automatiquement une régression. Le modèle ne prouve ni respect des règles ni protection d’accès.'};
}
export const csvCell=(value:unknown)=>{let s=String(value??'');if(/^[\s]*[=+@-]|^[\t\r\n]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
export function reportCSV(report:Report):string {
 const keys=[...new Set(report.manifest.cases.flatMap(c=>c&&typeof c==='object'?Object.keys(c):[]))];
 const extra=['result_before','result_after','expectation_status','justification','resolved_token','group_lines','decisive_lines'];
 const header=[...keys,...extra.map(k=>'edikka_'+k)];
 const rows=report.after.results.map((r,i)=>[...keys.map(k=>r.case?.[k]),report.before?.results[i]?.decision??'',r.decision,r.status,r.explanation,r.resolution?.token??'',r.model?.groups.flatMap(g=>g.agents.map(a=>a.line)).join('|')??'',r.model?.decisive.map(rule=>rule.line).join('|')??''].map(csvCell).join(','));
 return '\uFEFF'+[header.map(csvCell).join(','),...rows].join('\r\n');
}
