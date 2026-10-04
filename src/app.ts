import { before,proposed,corrected,expectations,EXAMPLES } from './examples';
import { review,reportCSV,type Report } from './report';
import { resultTable,summary,escape } from './render';
import { parseCSV,readManifest,validateManifest,type CsvImport } from './expectations';
import { inspectCapture,type Capture } from './capture';
import { originURL } from './url';
import workerSource from './worker.generated';
const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const field=(id:string)=>$(id) as HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement;
const button=(id:string)=>$(id) as HTMLButtonElement;
const importFailures=new Map<string,string>();
const originals:{before?:string;after?:string}={};
let report:Report|undefined,delivery:unknown,capture:Capture|undefined,pendingCsv:CsvImport|undefined,csvText='',page=0,job=0;
const workerURL=URL.createObjectURL(new Blob([workerSource],{type:'text/javascript'}));
let worker=new Worker(workerURL,{type:'module'});
const setStatus=(s:string)=>{$('analysis-status').textContent=s;};
const setError=(s:string)=>{$('input-errors').textContent=s;};
function idle(){button('analyze').disabled=false;button('cancel').disabled=true;}
function invalidate(){job++;worker.terminate();worker=new Worker(workerURL,{type:'module'});report=undefined;delivery=undefined;$('review-output').hidden=true;idle();}
function display(){if(!report)return;
 const filter=field('filter').value,rows=report.after.results.filter(r=>filter==='all'||r.status===filter),size=25;
 page=Math.max(0,Math.min(page,Math.max(0,Math.ceil(rows.length/size)-1)));
 $('review-table').innerHTML=resultTable(report,rows.slice(page*size,(page+1)*size));
 $('pagination-label').textContent=`${rows.length? page*size+1:0}–${Math.min((page+1)*size,rows.length)} sur ${rows.length} cas`;
 button('prev').disabled=page===0;button('next').disabled=(page+1)*size>=rows.length;
}
button('analyze').addEventListener('click',()=>{
 invalidate();setError('');
 if(importFailures.size){setError([...importFailures.values()].join('\n'));setStatus('Import non résolu : corrigez le fichier concerné avant de rejouer.');return;}
 if(new TextEncoder().encode(field('expect-text').value).length>4*1024*1024){setError('Attentes supérieures à 4 Mio : import refusé.');return;}
 let original:unknown;try{original=JSON.parse(field('expect-text').value);}catch(e){setError('JSON invalide : '+(e as Error).message);setStatus('Entrée invalide : aucun contrôle exécuté.');return;}
 const parsed=validateManifest(original);
 let enteredOrigin='';try{enteredOrigin=originURL(field('origin').value);}catch(e){setError((e as Error).message);return;}
 if(parsed.manifest.origin!==enteredOrigin){setError('L’origine de référence doit être identique à celle du JSON d’attentes.');return;}
 if(pendingCsv){setError('Vérifiez puis appliquez l’aperçu CSV avant l’analyse.');return;}
 if(parsed.issues.length)setError(parsed.issues.map(p=>`${p.row?'Cas '+p.row+' · ':''}${p.field} : ${p.message}`).join('\n'));
 const id=++job;button('analyze').disabled=true;button('cancel').disabled=false;setStatus('Analyse locale en cours…');
 worker.onmessage=(event:MessageEvent)=>{
  if(event.data.id!==job)return;idle();if(event.data.error){setError(event.data.error);setStatus('Analyse non concluante.');return;}
  report=event.data.report;delivery=event.data.delivery;page=0;
  $('review-summary').innerHTML=summary(report!);$('review-output').hidden=false;
  const d=event.data.delivery;
  $('delivery-status').innerHTML=d?`<p class="note"><strong>Capture ${d.capture?.synthetic?'synthétique':'de livraison'} : ${d.usable?'réception exploitable':'réception non concluante'}.</strong> ${escape(d.diagnostics.join(' '))} ${d.capture?.requestCount??0} requête(s) lors de la capture. Origine initiale ${escape(d.capture?.origin)} ; destination ${escape(d.capture?.finalURL)}.</p>`:'';
  $('provenance').textContent=JSON.stringify({engine:report!.engine,reference:report!.reference,catalog:report!.catalog,createdAt:report!.createdAt,before:{sha256:report!.before?.sha256,bytes:report!.before?.bytes,diagnostics:report!.before?.diagnostics},after:{sha256:report!.after.sha256,bytes:report!.after.bytes,diagnostics:report!.after.diagnostics},issues:report!.issues},null,2);
  button('export-capture').hidden=!capture;display();setStatus(`Analyse terminée : ${report!.after.summary.evaluated} attentes évaluées, ${report!.after.summary.fail} écarts, ${report!.after.summary.uncertain} cas incertains. Contrôle ${report!.exitCode===2?'non concluant':report!.exitCode===1?'avec écarts':'complet'}.`);
 };
 worker.onerror=()=>{invalidate();setError('Worker interrompu : aucun résultat confirmé.');};
 worker.postMessage({id,manifest:original,before:originals.before??field('before-text').value,after:originals.after??field('after-text').value,capture});
});
button('cancel').addEventListener('click',()=>{invalidate();setStatus('Analyse interrompue. Aucun résultat partiel confirmé.');});
for(const id of ['before-text','after-text','expect-text'])field(id).addEventListener('input',()=>{if(id==='before-text'){originals.before=undefined;importFailures.delete('before');}if(id==='after-text'){originals.after=undefined;importFailures.delete('after');}if(id==='expect-text')importFailures.delete('expect');invalidate();setStatus('Données modifiées : rejouez les attentes.');});
field('origin').addEventListener('input',()=>{invalidate();try{const m=JSON.parse(field('expect-text').value);m.origin=field('origin').value;field('expect-text').value=JSON.stringify(m,null,2);}catch{}});
async function fileText(file:File,limit:number){if(file.size>limit)throw new Error(`Fichier trop volumineux (limite ${limit} octets).`);return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(await file.arrayBuffer());}
for(const prefix of ['before','after'] as const)field(prefix+'-file').addEventListener('change',async()=>{const file=($(prefix+'-file') as HTMLInputElement).files?.[0];if(!file)return;try {const text=await fileText(file,2*1024*1024);invalidate();if(prefix==='after')clearCapture();field(prefix+'-text').value=text;originals[prefix]=text;importFailures.delete(prefix);setError('');setStatus('Fichier importé localement. Rejouez les attentes.');}catch(e){invalidate();importFailures.set(prefix,'Import '+prefix+' : '+(e as Error).message);setError((e as Error).message);}});
function previewCsv(){
 const delimiter=field('delimiter').value as ','|';'|'';pendingCsv=parseCSV(csvText,delimiter||undefined);
 const preview=$('import-preview');preview.hidden=false;
 const v=validateManifest({schemaVersion:1,origin:field('origin').value,cases:pendingCsv.rows});
 const issues=[...pendingCsv.issues,...v.issues];
 preview.innerHTML=`<strong>Aperçu CSV : ${pendingCsv.rows.length} lignes conservées, ${issues.length} problème(s).</strong><p>${issues.slice(0,30).map(p=>escape(`${p.row?'Ligne/cas '+p.row+' · ':''}${p.field} : ${p.message}`)).join('<br>')||'Structure des attentes valide.'}</p><pre>${escape(JSON.stringify(pendingCsv.rows.slice(0,5),null,2))}</pre><p class="micro">Premières 5 lignes affichées. Le JSON conservera toutes les lignes et colonnes.</p><button id="apply-csv" ${pendingCsv.issues.length?'disabled':''}>Appliquer cet import</button><button id="discard-csv">Annuler cet import</button>`;
 button('apply-csv').addEventListener('click',()=>{field('expect-text').value=JSON.stringify({schemaVersion:1,origin:field('origin').value,cases:pendingCsv!.rows},null,2);pendingCsv=undefined;preview.hidden=true;setStatus('CSV converti en attentes JSON. Les erreurs de lignes restent à corriger avant un contrôle complet.');});
 button('discard-csv').addEventListener('click',()=>{pendingCsv=undefined;csvText='';preview.hidden=true;field('expect-file').value='';});
}
field('expect-file').addEventListener('change',async()=>{const file=($('expect-file') as HTMLInputElement).files?.[0];if(!file)return;try{const text=await fileText(file,4*1024*1024);invalidate();importFailures.delete('expect');setError('');if(/\.csv$/i.test(file.name)){csvText=text;previewCsv();}else{pendingCsv=undefined;csvText='';$('import-preview').hidden=true;field('expect-text').value=text;const parsed=readManifest(text);if(parsed.manifest.origin)field('origin').value=parsed.manifest.origin;setError(parsed.issues.map(p=>`${p.row?'Cas '+p.row+': ':''}${p.message}`).join('\n'));setStatus('Attentes importées. Vérifiez le JSON puis lancez le contrôle.');}}catch(e){invalidate();importFailures.set('expect','Import attentes : '+(e as Error).message);setError((e as Error).message);}});
field('delimiter').addEventListener('change',()=>{if(csvText)previewCsv();});
function clearCapture(){importFailures.delete('capture');capture=undefined;field('capture-file').value='';($('after-text') as HTMLTextAreaElement).readOnly=false;$('capture-state').textContent='Aucune capture importée.';button('export-capture').hidden=true;}
field('capture-file').addEventListener('change',async()=>{const file=($('capture-file') as HTMLInputElement).files?.[0];if(!file)return;try{const text=await fileText(file,4*1024*1024);const parsed=await inspectCapture(JSON.parse(text));if(!parsed.capture)throw new Error(parsed.diagnostics.join(' '));invalidate();importFailures.delete('capture');capture=parsed.capture;originals.after=parsed.text;field('after-text').value=parsed.text;($('after-text') as HTMLTextAreaElement).readOnly=true;$('capture-state').textContent=`${capture.synthetic?'Synthétique':'Acquise le '+capture.capturedAt} · ${capture.status??'sans statut'} · ${capture.bytes} octets. ${parsed.usable?'Réception exploitable.':parsed.diagnostics.join(' ')}`;setError('');setStatus('Capture importée ; origine et attentes restent à vérifier.');}catch(e){invalidate();importFailures.set('capture','Import capture : '+(e as Error).message);setError((e as Error).message);}});
button('clear-capture').addEventListener('click',()=>{invalidate();clearCapture();setStatus('Capture retirée. Le texte reste éditable comme fichier local.');});
field('filter').addEventListener('change',()=>{page=0;display();});button('prev').addEventListener('click',()=>{page--;display();});button('next').addEventListener('click',()=>{page++;display();});
function download(name:string,content:string,type:string){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
button('export-json').addEventListener('click',()=>{if(report)download('robots-review-report.json',JSON.stringify({...report,delivery},null,2),'application/json');});
button('export-csv').addEventListener('click',()=>{if(report)download('robots-review-report.csv',reportCSV(report),'text/csv;charset=utf-8');});
button('export-expect').addEventListener('click',()=>{if(report)download('expectations.json',JSON.stringify(report.manifest,null,2),'application/json');});
button('export-capture').addEventListener('click',()=>{if(capture)download('capture.json',JSON.stringify(capture,null,2),'application/json');});
button('reset').addEventListener('click',()=>{invalidate();clearCapture();importFailures.clear();for(const id of ['review-summary','review-table','delivery-status','provenance','import-preview'])$(id).textContent='';originals.before=undefined;originals.after=undefined;pendingCsv=undefined;csvText='';for(const id of ['before-file','after-file','expect-file','before-text','after-text','origin'])field(id).value='';field('expect-text').value=JSON.stringify({schemaVersion:1,origin:'',cases:[]},null,2);field('delimiter').value='';field('filter').value='all';$('import-preview').hidden=true;setError('');setStatus('État utilisateur effacé. La démonstration synthétique reste disponible au-dessus.');});
let demoRevision=0;
async function demo(mode:'change'|'correction'|'delivery'='change'){
 const rev=++demoRevision,example=EXAMPLES.find(e=>e.id===field('example').value)!;
 const isMain=example.id==='main';const after=isMain&&mode==='correction'?corrected:example.id==='delivery'&&mode==='delivery'?proposed:example.after;
 $('demo-before').textContent=example.before;$('demo-after').textContent=after;
 $('example-intro').textContent=example.intro;
 $('candidate-title').textContent=mode==='correction'?'Correction pédagogique':example.syntheticDelivery?'Servi · capture synthétique':'Modification proposée';
 $('candidate-label').textContent=isMain?(mode==='correction'?'Restrictions explicites':'Groupe spécifique ajouté'):example.syntheticDelivery?'Aucune acquisition réelle':'Résultat du modèle';
 button('show-change').hidden=!isMain;button('show-correction').hidden=!isMain;
 button('show-correction').setAttribute('aria-pressed',String(mode==='correction'));button('show-change').setAttribute('aria-pressed',String(mode!=='correction'));
 button('delivery-rule').hidden=example.id!=='delivery';$('static-correction').hidden=!isMain;
 const result=await review(example.manifest,after,example.before);if(rev!==demoRevision)return;
 $('demo-result').innerHTML=summary(result)+resultTable(result);
}
field('example').addEventListener('change',()=>void demo());button('show-change').addEventListener('click',()=>void demo('change'));button('show-correction').addEventListener('click',()=>void demo('correction'));button('delivery-rule').addEventListener('click',()=>void demo('delivery'));
button('understand').addEventListener('click',()=>{const details=$('demo-result').querySelector('details');if(details){details.open=true;details.querySelector('summary')?.focus();}});
