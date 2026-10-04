import { CATALOG } from './catalog';
import { LIMITS, validToken } from './engine';
import { originURL, prepareURL } from './url';
export type Case={id:string;profile:string;dimension:'crawl'|'usage';url:string;expected:'allow'|'disallow';reason:string;genericToken?:string; [key:string]:unknown};
export type Manifest={schemaVersion:1;origin:string;cases:Case[]};
export type Problem={row?:number;field:string;message:string};
export type Validated={manifest:Manifest;issues:Problem[];invalidRows:number[]};
export function validateManifest(input:unknown):Validated {
 const issues:Problem[]=[], invalidRows:number[]=[], fallback:Manifest={schemaVersion:1,origin:'',cases:[]};
 if(!input || typeof input!=='object' || Array.isArray(input)) return {manifest:fallback,issues:[{field:'manifest',message:'Objet JSON attendu.'}],invalidRows};
 const data=input as Record<string,unknown>;
 if(data.schemaVersion!==1) issues.push({field:'schemaVersion',message:'Version 1 requise.'});
 let origin=''; try {if(typeof data.origin!=='string') throw new Error('Origine obligatoire.');origin=originURL(data.origin);} catch(e){issues.push({field:'origin',message:(e as Error).message});}
 if(!Array.isArray(data.cases) || !data.cases.length) issues.push({field:'cases',message:'Au moins une attente est obligatoire.'});
 const rows=Array.isArray(data.cases)?data.cases:[];
 if(rows.length>LIMITS.cases) issues.push({field:'cases',message:'Maximum 5 000 attentes par revue.'});
 const ids=new Set<string>();
 rows.slice(0,LIMITS.cases).forEach((value,index)=>{
  const row=index+1; const fail=(field:string,message:string)=>{issues.push({row,field,message});invalidRows.push(row);};
  if(!value||typeof value!=='object'||Array.isArray(value)) {fail('case','Ligne objet attendue.');return;}
  const c=value as Record<string,unknown>;
  for(const field of ['id','profile','dimension','url','expected','reason']) if(typeof c[field]!=='string' || (!(c[field] as string).trim() && field!=='reason')) fail(field,'Texte obligatoire.');
  if(typeof c.id==='string'){if(ids.has(c.id)) fail('id','Identifiant dupliqué.');ids.add(c.id);}
  if(!['crawl','usage'].includes(String(c.dimension))) fail('dimension','crawl ou usage attendu.');
  if(!['allow','disallow'].includes(String(c.expected))) fail('expected','allow ou disallow attendu.');
  const p=CATALOG.find(p=>p.id===c.profile);
  if(c.profile==='custom') {if(typeof c.genericToken!=='string'||!validToken(c.genericToken)) fail('genericToken','Jeton [a-zA-Z_-] non vide requis.');if(c.dimension!=='crawl') fail('dimension','Le jeton libre simule uniquement crawl.');}
  else if(!p) fail('profile','Profil inconnu.'); else if(c.dimension!==p.dimension) fail('dimension',`Le profil ${p.id} utilise la dimension ${p.dimension}.`);
  if(typeof c.url==='string' && origin) {const u=prepareURL(c.url,origin);if(u.state==='invalid')fail('url',u.reason!);}
 });
 return {manifest:{schemaVersion:1,origin,cases:rows.slice(0,LIMITS.cases) as Case[]},issues,invalidRows:[...new Set(invalidRows)]};
}
export function readManifest(text:string):Validated {try {return validateManifest(JSON.parse(text));} catch(e){return {manifest:{schemaVersion:1,origin:'',cases:[]},issues:[{field:'JSON',message:'JSON invalide : '+(e as Error).message}],invalidRows:[]};}}
export type CsvImport={rows:Record<string,string>[];issues:Problem[];delimiter:string;originalHeaders:string[]};
export function parseCSV(text:string, chosen?:','|';'):CsvImport {
 const issues:Problem[]=[]; const source=text.replace(/^\uFEFF/,'');
 if(source.length>4*1024*1024) return {rows:[],issues:[{field:'CSV',message:'CSV supérieur à 4 Mio.'}],delimiter:chosen??'',originalHeaders:[]};
 const header=source.split(/\r?\n/,1)[0];
 const count=(ch:string)=>{let n=0,q=false;for(let i=0;i<header.length;i++){if(header[i]==='"')q=!q;else if(header[i]===ch&&!q)n++;}return n;};
 const comma=count(','),semi=count(';');
 const delimiter=chosen??(comma&&!semi?',':semi&&!comma?';':'');
 if(!delimiter) return {rows:[],issues:[{field:'delimiter',message:'Séparateur ambigu ou absent : choisir virgule ou point-virgule.'}],delimiter:'',originalHeaders:[]};
 const records:string[][]=[]; let record:string[]=[], cell='', quoted=false, afterQuote=false, atStart=true;
 for(let i=0;i<source.length;i++) {
  const ch=source[i];
  if(quoted){if(ch==='"'){if(source[i+1]==='"'){cell+='"';i++;}else {quoted=false;afterQuote=true;}}else cell+=ch;continue;}
  if(ch==='"'&&atStart){quoted=true;atStart=false;continue;}
  if(ch===delimiter){record.push(cell);cell='';afterQuote=false;atStart=true;continue;}
  if(ch==='\r'||ch==='\n'){if(ch==='\r'&&source[i+1]==='\n')i++;record.push(cell);records.push(record);record=[];cell='';afterQuote=false;atStart=true;continue;}
  if(ch==='"'||afterQuote) issues.push({row:records.length+1,field:'CSV',message:'Guillemet inattendu ou texte après fermeture.'});
  cell+=ch;atStart=false;
 }
 if(quoted)issues.push({row:records.length+1,field:'CSV',message:'Champ cité non fermé.'});
 if(cell||record.length) {record.push(cell);records.push(record);}
 const originalHeaders=records.shift()??[];
 if(new Set(originalHeaders).size!==originalHeaders.length)issues.push({field:'headers',message:'Colonnes dupliquées.'});
 for(const h of ['id','profile','dimension','url','expected','reason'])if(!originalHeaders.includes(h))issues.push({field:h,message:'Colonne obligatoire absente.'});
 const rows=records.map((fields,index)=>{
  if(fields.length!==originalHeaders.length)issues.push({row:index+2,field:'CSV',message:`${fields.length} cellules au lieu de ${originalHeaders.length}. Ligne conservée.`});
  return Object.fromEntries(fields.map((value,i)=>[originalHeaders[i]??`extra_${i+1}`,value]));
 });
 return {rows,issues,delimiter,originalHeaders};
}
