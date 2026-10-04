import {writeFile,mkdir} from 'node:fs/promises';
import {before,proposed,corrected,expectations,EXAMPLES} from '../build/examples.mjs';
import {syntheticCapture} from '../build/capture.mjs';
import {review} from '../build/report.mjs';
await mkdir('examples',{recursive:true});
for(const [name,value] of Object.entries({before,proposed,corrected}))await writeFile('examples/'+name+'.txt',value);
await writeFile('examples/expectations.json',JSON.stringify(expectations,null,2)+'\n');
const results=[];
for(const example of EXAMPLES){await mkdir('examples/'+example.id,{recursive:true});await writeFile('examples/'+example.id+'/before.txt',example.before);await writeFile('examples/'+example.id+'/candidate.txt',example.after);await writeFile('examples/'+example.id+'/expectations.json',JSON.stringify(example.manifest,null,2)+'\n');if(example.syntheticDelivery)await writeFile('examples/'+example.id+'/capture.json',JSON.stringify(await syntheticCapture(example.after),null,2)+'\n');results.push({id:example.id,synthetic:true,report:await review(example.manifest,example.after,example.before)});}
await writeFile('examples/delivery/rule-change-capture.json',JSON.stringify(await syntheticCapture(proposed),null,2)+'\n');
await writeFile('proofs/examples.json',JSON.stringify(results,null,2)+'\n');
