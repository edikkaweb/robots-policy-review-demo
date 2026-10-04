import {spawnSync} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import os from 'node:os';
import {parseRobots,matchRobots,ENGINE,REFERENCE} from '../build/engine.mjs';
const seed=20261004;let state=seed;
const random=()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296;};
const pick=a=>a[Math.floor(random()*a.length)];
const fixed=[
 ['User-agent: *\nDisallow: /documents/\n\nUser-agent: GPTBot\nDisallow: /blog/','GPTBot','/documents/a'],
 ['\uFEFFuSeR-aGeNt: GpTbOt\r\nDISALLOW: /Case # note\rAllow: /Case/public','gptbot','/Case/public/a'],
 ['User-agent: GPTBot\nUser-agent: OAI-SearchBot\nDisallow: /\nUser-agent: GPTBot\nAllow: /public','GPTBot','/public'],
 ['User-agent: *\nDisallow: /\nUser-agent: GPTBot','GPTBot','/a'],
 ['User-agent: *\nDisallow: /\nAllow: /index.html','GPTBot','/'],
 ['Useragent GPTBot\nDisalow /x','GPTBot','/x'],
 ['User-agent: GPTBot\nCrawl-delay: 4\nUser-agent: Googlebot\nDisallow: /','GPTBot','/'],
 ['User-agent: *\nDisallow: /café\nAllow: /caf%C3%A9/public','GPTBot','/caf%C3%A9'],
 ['User-agent: *\nDisallow: /a%2fb','GPTBot','/a%2Fb'],
 ['User-agent: GPTBot\nDisallow: /a\nAllow: /a','GPTBot','/a'],
 ['User-agent: GPTBot\nDisallow: /a*b$\nAllow: /ab','GPTBot','/axxb'],
 ['User-agent: *\nDisallow: \nAllow:','GPTBot','/'],
 ['Disallow: /\nUser-agent: GPTBot\nAllow: /','GPTBot','/'],
 ['User-agent: GPTBot/1.0\nDisallow: /a','GPTBot','/a'],
 ['User-agent: *\nDisallow: /a?b=2','GPTBot','/a?b=2&c=1'],
 ['User-agent: GPTBot\nDisallow: /\nUser-agent: Other\nDisallow: /\nUser-agent: GPTBot\nAllow: /a','GPTBot','/a']
];
const patterns=['/','/a','/A','/blog/','/documents/','/a*b','/*?','/a$','/a*b$','/a?x=1','/café','/caf%c3%a9','/x%2fY','/x%23z','/index.html','', '/**','/a*$','/a$b','/blog/index.htm'];
const paths=['/','/a','/A','/ab','/axxb','/a?x=1','/a?x=2','/blog/','/documents/a.pdf','/caf%C3%A9','/x%2FY','/x%23z','/blog/index.html','/blog/','/a$b'];
const tokens=['GPTBot','Googlebot','Other','OAI-SearchBot'];
const cases=fixed.map(([text,token,path],i)=>({id:'fixed-'+i,text,token,path}));
for(let i=0;i<1000;i++){
 const ending=pick(['\n','\r\n','\r']);let lines=[];
 for(let g=0;g<1+Math.floor(random()*4);g++){
  lines.push('User-agent: '+pick([...tokens,'*']));if(random()<.2)lines.push('User-agent: '+pick(tokens));
  for(let j=0;j<Math.floor(random()*7);j++)lines.push(pick(['Allow','Disallow','Disallow'])+': '+pick(patterns)+(random()<.1?' # comment':''));
  if(random()<.3)lines.push('Sitemap: https://example.com/sitemap.xml');if(random()<.3)lines.push('');
 }
 cases.push({id:'seed-'+i,text:(random()<.1?'\uFEFF':'')+lines.join(ending),token:pick(tokens),path:pick(paths)});
}
const hex=s=>Buffer.from(s).toString('hex');
const input=cases.map(c=>[c.text,c.token,'https://example.com'+c.path].map(hex).join('\n')).join('\n')+'\n';
const run=spawnSync(process.env.ROBOTS_ORACLE??'.cache/oracle/robots-oracle',[],{input,encoding:'utf8',maxBuffer:8*1024*1024});
if(run.error||run.status!==0){console.error('Référence non exécutée :',run.error?.message??run.stderr);process.exit(2);}
const outputs=run.stdout.trim().split('\n');if(outputs.length!==cases.length)throw new Error('Nombre de réponses oracle incorrect.');
const divergences=cases.flatMap((c,i)=>{const actual=matchRobots(parseRobots(c.text),c.token,c.path).decision;return actual===outputs[i]?[]:[{...c,expected:outputs[i],actual}];});
const vendorHashes=await Promise.all(['robots.cc','robots.h'].map(async f=>({file:f,sha256:(await import('node:crypto')).createHash('sha256').update(await readFile('vendor/google-robotstxt/'+f)).digest('hex')})));
const report={schemaVersion:1,engine:ENGINE,reference:REFERENCE,runAt:new Date().toISOString(),environment:{node:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model},seed,budget:1000,fixed:fixed.length,total:cases.length,agreement:cases.length-divergences.length,divergences,sourceHashes:vendorHashes,exclusions:['Préparation WHATWG / normalisation d’URL testée séparément : chemins déjà préparés dans ce corpus.','Résolution des profils, usages opérateurs et HTTP hors responsabilité du binaire brut.','Fichiers >2 Mio, lignes >16 663 octets, NUL et UTF-8 invalide refusés explicitement par la V1, non tronqués comme la référence.'],scope:'Parsing et matching pour les triplets admissibles listés ; aucun certificat ni équivalence universelle.',reproduce:'npm run build && cmake -S oracle -B .cache/oracle && cmake --build .cache/oracle -j 4 && npm run test:oracle'};
await mkdir('proofs',{recursive:true});await writeFile('proofs/oracle.json',JSON.stringify(report,null,2)+'\n');await writeFile('proofs/oracle-corpus.json',JSON.stringify(cases,null,2)+'\n');
console.log(`${report.agreement}/${report.total} cas concordants ; ${divergences.length} divergence(s).`);if(divergences.length){console.log(JSON.stringify(divergences.slice(0,10),null,2));process.exitCode=1;}
