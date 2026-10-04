import test from 'node:test';import assert from 'node:assert/strict';import {readFile,writeFile} from 'node:fs/promises';import os from 'node:os';
import {parseRobots,matchRobots,escapePattern,LIMITS} from '../build/engine.mjs';
import {prepareURL,originURL} from '../build/url.mjs';
import {resolveProfile,CATALOG} from '../build/catalog.mjs';
import {validateManifest,parseCSV} from '../build/expectations.mjs';
import {review,reportCSV,csvCell} from '../build/report.mjs';
import {before,proposed,corrected,expectations,EXAMPLES} from '../build/examples.mjs';
import {syntheticCapture,inspectCapture} from '../build/capture.mjs';
const match=(txt,path,agent='GPTBot')=>matchRobots(parseRobots(txt),agent,path);
const one=(changes={})=>({...expectations,cases:[{...expectations.cases[0],...changes}]});
test('Main story: explicit expected transitions and changed candidate, not before verdict',async()=>{
 const init=await review(expectations,before),candidate=await review(expectations,proposed,before),fixed=await review(expectations,corrected,before);
 assert.deepEqual([init,candidate,fixed].map(r=>r.after.results[0].decision),['disallow','allow','disallow']);
 assert.deepEqual([init,candidate,fixed].map(r=>r.after.results[1].decision),['allow','disallow','disallow']);
 assert.equal(candidate.exitCode,1);assert.equal(candidate.decisionChanges,2);assert.equal(fixed.exitCode,0);assert.equal(fixed.before.summary.fail,1);assert.equal(fixed.after.summary.fail,0);
 assert.deepEqual(candidate.after.results[0].model.groups.map(g=>g.agents[0].line),[4]);assert.equal(candidate.after.results[0].model.decisive.length,0);
});
test('Syntax: CRLF/CR/BOM/case/comments/groups/empty/directive diagnostics',()=>{
 for(const eol of ['\n','\r','\r\n'])assert.equal(match('\uFEFFUsEr-aGeNt: gPtBoT'+eol+'dIsAlLoW: /Case # comment'+eol,'/Case/a').decision,'disallow');
 assert.equal(match('User-agent: GPTBot\nDisallow: /Case','/case').decision,'allow');
 assert.equal(match('User-agent: *\nDisallow: /\nUser-agent: GPTBot','/').decision,'allow');
 assert.equal(match('User-agent: GPTBot\nUser-agent: OAI-SearchBot\nDisallow: /\nUser-agent: GPTBot\nAllow: /public','/public').decision,'allow');
 assert.equal(match('User-agent: GPTBot\nCrawl-delay: 10\nUser-agent: Other\nDisallow: /','/').decision,'disallow');
 const p=parseRobots('Disallow: /first\nUser-agent: *\nSitemap: https://example.com/map.xml\nCrawl-delay: 5\nno directive here');assert.equal(p.diagnostics.length,4);assert.equal(matchRobots(p,'GPTBot','/first').decision,'allow');
});
test('Specific match exact token, no substring inheritance; repeated groups combined',()=>{
 const t='User-agent: GPT\nDisallow: /\nUser-agent: GPTBot\nDisallow: /a\nUser-agent: GPTBot\nDisallow: /b';
 assert.equal(match(t,'/c').decision,'allow');assert.equal(match(t,'/b').decision,'disallow');assert.equal(match(t,'/c','Other').decision,'allow');
});
test('Longest pattern/tied set/Allow win; order does not decide; wildcard and query',()=>{
 for(const rules of ['Disallow: /a\nAllow: /a','Allow: /a\nDisallow: /a']){const r=match('User-agent: *\n'+rules,'/a');assert.equal(r.decision,'allow');assert.equal(r.decisive.length,2);}
 assert.equal(match('User-agent: *\nDisallow: /a*b$','/axxb').decision,'disallow');assert.equal(match('User-agent: *\nDisallow: /a*b$','/axxb?q=1').decision,'allow');
 assert.equal(match('User-agent: *\nDisallow: /*?q=secret','/a?q=secret').decision,'disallow');
 assert.equal(match('User-agent: *\nDisallow: /\nAllow: /index.html','/').decision,'allow');
 assert.equal(match('User-agent: *\nDisallow:','/').decision,'allow');
});
test('Unicode escapes and reserved bytes remain distinct',()=>{
 assert.equal(escapePattern('/café/%2f'),'/caf%C3%A9/%2F');
 assert.equal(match('User-agent: *\nDisallow: /café','/caf%C3%A9').decision,'disallow');
 assert.equal(match('User-agent: *\nDisallow: /a%2fb','/a/b').decision,'allow');assert.equal(match('User-agent: *\nDisallow: /a%23b','/a%23b').decision,'disallow');
});
test('Boundaries fail explicitly; operation budget does not return allow',()=>{
 assert.equal(parseRobots('a'.repeat(16664)).supported,false);assert.equal(parseRobots('\0').supported,false);
 assert.equal(matchRobots(parseRobots('User-agent: *\nDisallow: /*a*b*c'), 'GPTBot','/a'.repeat(50),{remaining:10}).decision,'indeterminate');
});
test('URL preparation: independent expectations for origin, IDN, ports, query, dot segments, fragments',()=>{
 assert.equal(originURL('HTTPS://EXAMPLE.com:443'),'https://example.com');
 const a=prepareURL('/a/../B//c?b=2&a=1#section','https://example.com');assert.equal(a.path,'/B//c?b=2&a=1');assert.equal(a.state,'valid');assert.ok(a.transformations.some(t=>t.includes('Fragment')));
 assert.equal(prepareURL('https://EXAMPLE.com:443/%2f%23','https://example.com').path,'/%2F%23');
 assert.equal(prepareURL('https://éxample.com/a','https://xn--xample-9ua.com').state,'valid');
 assert.equal(prepareURL('/café','https://example.com').path,'/caf%C3%A9');
 assert.equal(prepareURL('https://example.com:444/a','https://example.com').state,'out_of_scope');
 assert.equal(prepareURL('https://other.com/a','https://example.com').state,'out_of_scope');
 for(const raw of ['//example.com/a','relative','a/b','https://me:secret@example.com/a','/bad%ZZ','/bad space','/a\\b','javascript:alert(1)',''])assert.equal(prepareURL(raw,'https://example.com').state,'invalid',raw);
});
test('Profile resolution is outside raw engine; Googlebot-Image and Apple fallback',()=>{
 const p=parseRobots('User-agent: Googlebot\nDisallow: /');
 assert.equal(matchRobots(p,'Googlebot-Image','/').decision,'allow');
 assert.equal(resolveProfile(p,'Googlebot-Image').token,'Googlebot');assert.equal(resolveProfile(p,'Applebot').token,'Googlebot');
 assert.equal(resolveProfile(parseRobots(p.text+'\nUser-agent: Googlebot-Image\nAllow: /'),'Googlebot-Image').token,'Googlebot-Image');
 assert.equal(resolveProfile(p,'custom','Applebot').token,'Applebot');assert.ok(resolveProfile(p,'Applebot').uncertain);
});
test('User request profiles differ; usage dimension and unknown custom validation',async()=>{
 assert.equal((await review(one({profile:'ChatGPT-User'}),'User-agent: *\nDisallow: /')).exitCode,2);
 assert.equal((await review(one({profile:'Claude-User'}),'User-agent: *\nDisallow: /')).exitCode,0);
 assert.ok(validateManifest(one({profile:'Google-Extended',dimension:'crawl'})).issues.length);
 assert.equal(validateManifest(one({profile:'Google-Extended',dimension:'usage'})).issues.length,0);
 assert.ok(validateManifest(one({profile:'MysteryBot'})).issues.length);
 assert.equal(validateManifest(one({profile:'custom',genericToken:'MysteryBot'})).issues.length,0);
 assert.equal(CATALOG.length,12);
});
test('Malformed/empty/out-of-origin/incomplete dominate failures',async()=>{
 for(const m of [{},null,{...expectations,schemaVersion:2},{...expectations,cases:[]},{...expectations,cases:[null]},{...expectations,cases:[expectations.cases[0],expectations.cases[0]]}])assert.equal((await review(m,corrected)).exitCode,2);
 const m={...expectations,cases:[...expectations.cases,{...expectations.cases[0],id:'elsewhere',url:'https://other.com/x'}]};const r=await review(m,proposed);assert.equal(r.exitCode,2);assert.equal(r.after.summary.fail,1);assert.equal(r.after.results.at(-1).decision,'out_of_scope');
 assert.equal((await review(one({profile:'Googlebot'}),'#'+ 'x'.repeat(100)+'\n'.repeat(1)+Array(5200).fill('#'+'x'.repeat(100)).join('\n'))).exitCode,2);
});
test('CSV quoted multiline / BOM / semicolon, ambiguity, rejected rows and unknown columns preserved',()=>{
 const p=parseCSV('\uFEFFid;profile;dimension;url;expected;reason;owner\r\n1;GPTBot;crawl;/a;allow;"texte;avec\nligne et ""citation""";=SUM(1)');
 assert.equal(p.issues.length,0);assert.equal(p.rows[0].reason,'texte;avec\nligne et "citation"');assert.equal(p.rows[0].owner,'=SUM(1)');
 assert.equal(parseCSV('a,b;c\n1,2;3').delimiter,'');assert.ok(parseCSV('id,profile,dimension,url,expected,reason\nx,GPTBot').issues.length);
 assert.ok(parseCSV('id,id\na,b').issues.length);assert.ok(parseCSV('id,profile,dimension,url,expected,reason\n"x,a').issues.length);
});
test('CSV formulas escaped, raw JSON untouched; untrusted HTML stays data',async()=>{
 const m=one({reason:'=HYPERLINK("https://evil.invalid")',owner:'\t=1',url:'/a',expected:'allow'});const r=await review(m,corrected);const csv=reportCSV(r);
 assert.ok(csv.includes("'=HYPERLINK"));assert.ok(csv.includes("'\t=1"));assert.equal(r.manifest.cases[0].reason,m.cases[0].reason);assert.ok(csvCell(' +2').startsWith('"\''));
});
test('Saved capture integrity, synthetic identity, empty valid versus bad capture',async()=>{
 const c=await syntheticCapture(corrected);assert.equal((await inspectCapture(c)).usable,true);assert.equal((await inspectCapture({...c,sha256:'0'.repeat(64)})).usable,false);
 assert.equal((await inspectCapture(await syntheticCapture(''))).usable,true);
 for(const change of [{status:404},{complete:false},{truncated:true},{headers:{'content-type':'text/html'}},{requestCount:7}])assert.equal((await inspectCapture({...c,...change})).usable,false);
});
test('Example E separates bytes from case decisions',async()=>{
 const e=EXAMPLES.at(-1),r=await review(e.manifest,e.after,e.before);assert.equal(r.contentIdentical,false);assert.equal(r.caseDecisionsIdentical,true);assert.equal(r.exitCode,0);
 const rule=await review(e.manifest,proposed,e.before);assert.equal(rule.caseDecisionsIdentical,false);assert.equal(rule.exitCode,1);
});
test('Measured useful batch: 5000 distinct cases, realistic synthetic policy',async()=>{
 const rules='User-agent: *\n'+Array.from({length:80},(_,i)=>`Disallow: /private-${i}/`).join('\n')+'\nAllow: /private-0/public/';
 const m={...expectations,cases:Array.from({length:5000},(_,i)=>({id:'perf-'+i,profile:'GPTBot',dimension:'crawl',url:'/private-'+(i%80)+'/item-'+i,expected:'disallow',reason:'Synthetic performance fixture.'}))};
 const start=performance.now(),r=await review(m,rules),elapsedMs=performance.now()-start;assert.equal(r.exitCode,0);assert.equal(r.after.summary.evaluated,5000);
 await writeFile('proofs/performance.json',JSON.stringify({runAt:new Date().toISOString(),environment:{node:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model},cases:5000,rules:81,elapsedMs,scope:'Single synthetic run; not a statistical or universal performance guarantee.'},null,2)+'\n');
});
