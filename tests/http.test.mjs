import test from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';import {gzipSync} from 'node:zlib';import {mkdtemp,readFile,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {spawn} from 'node:child_process';
import {acquire} from '../build/acquisition.mjs';import {inspectCapture} from '../build/capture.mjs';
import {expectations} from '../build/examples.mjs';
let mode='ok',seen=[];
const server=http.createServer((req,res)=>{seen.push({url:req.url,agent:req.headers['user-agent'],cookie:req.headers.cookie});res.setHeader('Set-Cookie','DO_NOT_CAPTURE=secret');res.setHeader('X-Secret','DO_NOT_CAPTURE');
 if(mode==='timeout'){setTimeout(()=>res.end('slow'),300).unref();return;}
 if(mode==='loop'){res.writeHead(302,{Location:'/robots.txt'});res.end();return;}
 if(mode==='redirect'&&req.url==='/robots.txt'){res.writeHead(302,{Location:'/served.txt'});res.end();return;}
 if(mode==='many'){res.writeHead(302,{Location:'/hop-'+seen.length});res.end();return;}
 if(mode==='credentials'){res.writeHead(302,{Location:'http://user:secret@example.com/robots.txt'});res.end();return;}
 if(['404','429','503'].includes(mode)){res.writeHead(Number(mode));res.end('unavailable');return;}
 if(mode==='html'){res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><h1>Error</h1>');return;}
 if(mode==='invalid-utf8'){res.end(Buffer.from([255,255]));return;}
 if(mode==='oversize'){res.end('x'.repeat(400));return;}
 if(mode==='gzip'){res.writeHead(200,{'Content-Encoding':'gzip','Content-Type':'text/plain'});res.end(gzipSync('User-agent: *\nDisallow: /secret'));return;}
 if(mode==='broken'){res.writeHead(200,{'Content-Length':'2000'});res.write('User-agent: *\n');setTimeout(()=>res.destroy(),15);return;}
 res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8'});res.end(mode==='empty'?'':'User-agent: *\nDisallow: /documents/\n');
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const run=(args)=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,['build/cli.mjs',...args],{stdio:['ignore','pipe','pipe']});let out='';child.stdout.on('data',b=>out+=b);child.stderr.on('data',b=>out+=b);child.on('error',reject);child.on('close',code=>resolve({code,out}));});
test('Acquisition states, bounded redirects, retained bytes, explicit local scope',async t=>{
 try{
  const denied=await acquire(origin);assert.equal(denied.requestCount,0);assert.equal((await inspectCapture(denied)).usable,false);
  for(const scenario of ['ok','empty','404','429','503','timeout','loop','html','oversize','gzip','invalid-utf8','broken','redirect','many','credentials'])await t.test(scenario,async()=>{
   mode=scenario;seen=[];const c=await acquire(origin,{allowLocal:true,timeoutMs:scenario==='timeout'?35:3000,maxBytes:scenario==='oversize'?100:2048});const inspection=await inspectCapture(c);
   assert.equal(inspection.usable,['ok','empty','gzip','redirect'].includes(scenario),JSON.stringify(inspection));
   assert.ok(!JSON.stringify(c).includes('DO_NOT_CAPTURE'));assert.ok(seen.every(r=>r.agent.startsWith('Edikka-Robots-Review/1.0.0')&&!r.cookie));
   assert.ok(seen.every(r=>!r.url.includes('documents')&&!r.url.includes('sitemap')));
   if(scenario==='oversize'){assert.equal(c.truncated,true);assert.equal(c.bytes,100);assert.equal(c.complete,false);}
   if(scenario==='redirect'){assert.equal(c.origin,origin);assert.equal(c.finalURL,origin+'/served.txt');assert.equal(c.requestCount,2);}
   if(scenario==='many'){assert.equal(c.requestCount,6);assert.equal(c.redirects.length,5);}
  });
  const dir=await mkdtemp(join(tmpdir(),'robots-cli-'));const manifest={...expectations,origin};await writeFile(join(dir,'expectations.json'),JSON.stringify(manifest));
  mode='ok';const live=await run(['check-served','--origin',origin,'--planned','examples/before.txt','--expectations',join(dir,'expectations.json'),'--out',join(dir,'live'),'--allow-local']);assert.equal(live.code,1,live.out);
  const replay=await run(['replay','--capture',join(dir,'live/capture.json'),'--planned','examples/before.txt','--expectations',join(dir,'expectations.json'),'--out',join(dir,'replay')]);assert.equal(replay.code,1);
  const liveReport=JSON.parse(await readFile(join(dir,'live/report.json'))),replayReport=JSON.parse(await readFile(join(dir,'replay/report.json')));assert.deepEqual(liveReport.after,replayReport.after);
  mode='503';const incomplete=await run(['check-served','--origin',origin,'--planned','examples/before.txt','--expectations',join(dir,'expectations.json'),'--out',join(dir,'bad'),'--allow-local']);assert.equal(incomplete.code,2);
  const pass=await run(['check','--robots','examples/corrected.txt','--expectations','examples/expectations.json','--out',join(dir,'pass')]);assert.equal(pass.code,0,pass.out);
  const cmp=await run(['compare','--before','examples/before.txt','--after','examples/proposed.txt','--expectations','examples/expectations.json','--out',join(dir,'cmp')]);assert.equal(cmp.code,1,cmp.out);
 }finally{await new Promise(r=>server.close(r));server.closeAllConnections();}
});
