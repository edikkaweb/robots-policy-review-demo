import { readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { review, reportCSV } from './report';
import { acquire } from './acquisition';
import { inspectCapture } from './capture';
import { originURL } from './url';
const HELP=`Revue robots.txt 1.0.0 — Node 22.12+
check --robots FILE --expectations FILE --out DIR
compare --before FILE --after FILE --expectations FILE --out DIR
check-served --origin https://example.com --planned FILE --expectations FILE --out DIR [--allow-local]
replay --capture FILE --planned FILE --expectations FILE --out DIR
check/compare/replay hors ligne. check-served : GET /robots.txt et redirections seulement.
Codes : 0 complet conforme ; 1 complet avec écarts ; 2 invalide/incomplet/indéterminé (prioritaire).
Les rapports ne sont jamais publiés automatiquement.`;
async function read(path:string,limit=2*1024*1024){if((await stat(path)).size>limit)throw new Error('Fichier trop volumineux : '+path);return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(await readFile(path));}
async function main(){
 const [command,...args]=process.argv.slice(2);if(!command||command==='--help'||command==='help'){console.log(HELP);return;}
 if(!['check','compare','check-served','replay'].includes(command))throw new Error('Commande inconnue.\n'+HELP);
 const flags=new Map<string,string>();let allowLocal=false;
 for(let i=0;i<args.length;i++){const key=args[i];if(key==='--allow-local'){allowLocal=true;continue;}if(!['--robots','--expectations','--out','--before','--after','--origin','--planned','--capture'].includes(key)||!args[i+1]||flags.has(key))throw new Error('Option invalide/dupliquée : '+key);flags.set(key,args[++i]);}
 const need=(key:string)=>{const s=flags.get('--'+key);if(!s)throw new Error('Option --'+key+' requise.');return s;};
 const manifest=JSON.parse(await read(need('expectations'),8*1024*1024));let capture,delivery;
 let after='',before:string|undefined;
 if(command==='check')after=await read(need('robots'));
 if(command==='compare'){before=await read(need('before'));after=await read(need('after'));}
 if(command==='check-served'||command==='replay'){
  before=await read(need('planned'));
  if(command==='check-served'){const origin=originURL(need('origin'));if(originURL(manifest.origin)!==origin)throw new Error('Origine du manifeste différente de l’acquisition demandée.');capture=await acquire(origin,{allowLocal});}
  else capture=JSON.parse(await read(need('capture'),4*1024*1024));
  const inspection=await inspectCapture(capture);
  if(inspection.capture&&originURL(manifest.origin)!==inspection.capture.origin)throw new Error('Origine de la capture différente du manifeste.');
  after=inspection.text;delivery={capture:inspection.capture,usable:inspection.usable,diagnostics:inspection.diagnostics,ruleCalculation:'Exploration distincte de l’état de réception.'};
 }
 const report=await review(manifest,after,before);
 if(delivery&&!delivery.usable)report.exitCode=2;
 const out=need('out');await mkdir(out,{recursive:true});
 await writeFile(join(out,'report.json'),JSON.stringify({...report,delivery},null,2)+'\n');await writeFile(join(out,'report.csv'),reportCSV(report));
 if(capture)await writeFile(join(out,'capture.json'),JSON.stringify(capture,null,2)+'\n');
 console.log(`${report.after.summary.evaluated} attentes évaluées, ${report.after.summary.fail} écarts, ${report.after.summary.uncertain} incertains. Code ${report.exitCode}.`);
 if(delivery)console.log(`Réception ${delivery.usable?'exploitable':'non concluante'} ; ${capture.requestCount??'?'} requête(s). Cause des différences non établie.`);
 console.log('Rapports : '+out);process.exitCode=report.exitCode;
}
main().catch(error=>{console.error('Contrôle invalide : '+error.message);process.exitCode=2;});
