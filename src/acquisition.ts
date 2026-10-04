/** Node-only bounded acquisition. Never imported by browser code. */
import http from 'node:http';
import https from 'node:https';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { createGunzip, createInflate, createBrotliDecompress } from 'node:zlib';
import type { Readable } from 'node:stream';
import { originURL } from './url';
import { sha256, TOOL } from './report';
import { encodeBase64, type Capture } from './capture';
const SAFE=['content-type','content-length','content-encoding','last-modified','etag','cache-control','date','age','vary'];
function publicAddress(ip:string):boolean {
 if(isIP(ip)===4){const p=ip.split('.').map(Number);return !(p[0]===0||p[0]===10||p[0]===127||p[0]>=224||(p[0]===169&&p[1]===254)||(p[0]===172&&p[1]>=16&&p[1]<=31)||(p[0]===192&&p[1]===168)||(p[0]===100&&p[1]>=64&&p[1]<=127));}
 const v=ip.toLowerCase();return isIP(ip)===6&&!/^(?:::|fc|fd|fe[89ab]|ff)/.test(v);
}
export async function acquire(origin:string,options:{allowLocal?:boolean;timeoutMs?:number;maxBytes?:number}={}):Promise<Capture> {
 const o=originURL(origin), maxBytes=Math.min(options.maxBytes??2*1024*1024,2*1024*1024), timeoutMs=Math.min(options.timeoutMs??15000,15000);
 const capture:Capture={schemaVersion:1,synthetic:false,capturedAt:new Date().toISOString(),tool:TOOL,origin:o,requestedURL:o+'/robots.txt',redirects:[],finalURL:o+'/robots.txt',status:null,requestCount:0,userAgent:TOOL+' (+https://github.com/edikkaweb/robots-policy-review-demo)',headers:{},bodyBase64:'',bytes:0,sha256:'',complete:false,truncated:false,encoding:'utf-8',diagnostics:[]};
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(new Error('Délai total dépassé.')),timeoutMs);
 const chunks:Buffer[]=[];let count=0;
 try {
  let url=new URL(capture.requestedURL);const seen=new Set<string>();
  for(let hop=0;hop<=5;hop++){
   if(seen.has(url.href))throw new Error('Boucle de redirection.');seen.add(url.href);
   if(!/^https?:$/.test(url.protocol)||url.username||url.password)throw new Error('Destination HTTP(S) sans identifiants requise.');
   capture.finalURL=url.href;
   const hostname=url.hostname.replace(/^\[|\]$/g,'');
   const addresses=await Promise.race([lookup(hostname,{all:true,verbatim:true}),new Promise<never>((_,reject)=>{if(controller.signal.aborted)reject(controller.signal.reason);else controller.signal.addEventListener('abort',()=>reject(controller.signal.reason),{once:true});})]);
   if(!addresses.length||(!options.allowLocal&&addresses.some(a=>!publicAddress(a.address))))throw new Error('Adresse locale ou non publique refusée. Utiliser --allow-local explicitement pour une préproduction contrôlée.');
   if(controller.signal.aborted)throw controller.signal.reason;
   const address=addresses[0];capture.requestCount++;
   const response=await new Promise<http.IncomingMessage>((resolve,reject)=>{
    const req=(url.protocol==='https:'?https:http).get(url,{signal:controller.signal,headers:{'User-Agent':capture.userAgent,'Accept':'text/plain','Accept-Encoding':'gzip, deflate, br'},lookup:(_hostname,opts,cb)=>{if(opts.all)(cb as Function)(null,[address]);else cb(null,address.address,address.family);}},resolve);req.on('error',reject);
   });
   capture.status=response.statusCode??null;
   capture.headers=Object.fromEntries(SAFE.filter(h=>response.headers[h]!==undefined).map(h=>[h,String(response.headers[h])]));
   if([301,302,303,307,308].includes(capture.status??0)){
    const location=response.headers.location;response.destroy();
    if(!location)throw new Error('Redirection sans Location.');
    const next=new URL(location,url);if(!/^https?:$/.test(next.protocol)||next.username||next.password)throw new Error('Redirection invalide ou avec identifiants refusée.');next.hash='';
    if(hop===5)throw new Error('Limite de 5 redirections atteinte.');
    capture.redirects.push({url:url.href,status:capture.status!,location:next.href});url=next;continue;
   }
   const encoding=response.headers['content-encoding'];let stream:Readable=response;
   if(encoding&&encoding!=='identity') {
    const decoder=encoding==='gzip'?createGunzip():encoding==='deflate'?createInflate():encoding==='br'?createBrotliDecompress():undefined;
    if(!decoder){response.destroy();throw new Error('Content-Encoding non pris en charge.');}
    response.on('error',e=>decoder.destroy(e));stream=response.pipe(decoder);
   }
   try {
    for await(const data of stream){const b=Buffer.from(data);const available=maxBytes-count;
     if(b.length>available){chunks.push(b.subarray(0,available));count+=available;capture.truncated=true;stream.destroy();response.destroy();throw new Error('Corps décodé supérieur à la limite de capture.');}
     chunks.push(b);count+=b.length;
    }
    capture.complete=true;
   } finally {response.destroy();}
   break;
  }
 } catch(error){capture.diagnostics.push(controller.signal.aborted?'Délai total dépassé ou acquisition interrompue.':(error as Error).message);}
 finally{clearTimeout(timer);}
 const bytes=Buffer.concat(chunks);capture.bytes=bytes.length;capture.bodyBase64=encodeBase64(bytes);capture.sha256=await sha256(bytes);
 return capture;
}
