import { sha256, TOOL } from './report';
import { originURL } from './url';
export type Capture={schemaVersion:1;synthetic:boolean;capturedAt:string;tool:string;origin:string;requestedURL:string;redirects:{url:string;status:number;location:string}[];finalURL:string;status:number|null;requestCount:number;userAgent:string;headers:Record<string,string>;bodyBase64:string;bytes:number;sha256:string;complete:boolean;truncated:boolean;encoding:'utf-8';diagnostics:string[]};
export function decodeBase64(s:string):Uint8Array {const raw=atob(s);return Uint8Array.from(raw,c=>c.charCodeAt(0));}
export function encodeBase64(bytes:Uint8Array):string {let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);}
export async function inspectCapture(input:unknown):Promise<{capture?:Capture;text:string;usable:boolean;diagnostics:string[]}> {
 const diagnostics:string[]=[];let text='';
 try {
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Objet capture attendu.');
  const c=input as Capture;
  if(c.schemaVersion!==1||typeof c.bodyBase64!=='string'||c.bodyBase64.length>3*1024*1024||typeof c.complete!=='boolean'||typeof c.truncated!=='boolean'||typeof c.synthetic!=='boolean'||!Number.isSafeInteger(c.bytes)||c.bytes<0||c.bytes>2*1024*1024||!Array.isArray(c.redirects)||c.redirects.length>5||!Number.isSafeInteger(c.requestCount)||c.requestCount<0||c.requestCount>6||typeof c.sha256!=='string'||!Array.isArray(c.diagnostics)||!c.diagnostics.every(x=>typeof x==='string')||!c.headers||typeof c.headers!=='object'||!Number.isFinite(Date.parse(c.capturedAt))||c.encoding!=='utf-8')throw new Error('Format ou limites de la capture invalides.');
  originURL(c.origin);
  if(c.requestedURL!==c.origin+'/robots.txt')throw new Error('La capture ne vise pas /robots.txt de l’origine initiale.');
  for(const raw of [c.finalURL,...c.redirects.flatMap(r=>[r.url,r.location])]){const u=new URL(raw);if(!/^https?:$/.test(u.protocol)||u.username||u.password)throw new Error('URL de capture non admissible.');}
  const bytes=decodeBase64(c.bodyBase64);
  if(bytes.length!==c.bytes||await sha256(bytes)!==c.sha256)throw new Error('Empreinte ou nombre d’octets incorrect : capture refusée.');
  text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
  if(!c.complete||c.truncated)diagnostics.push('Réception incomplète ou tronquée : aucune conformité de livraison.');
  if(c.status!==200)diagnostics.push(`Statut HTTP ${c.status??'absent'} : comportement et cache d’un crawler non déductibles de cette capture.`);
  if(/html/i.test(c.headers['content-type']??'')||/^\s*(?:<!doctype\s+html|<html\b)/i.test(text))diagnostics.push('HTML reçu en réponse : fichier robots non exploitable.');
  const charset=(c.headers['content-type']??'').match(/charset\s*=\s*["']?([^;"'\s]+)/i)?.[1];
  if(charset&&!/^utf-?8$/i.test(charset))diagnostics.push(`Encodage déclaré ${charset} non pris en charge.`);
  diagnostics.push(...c.diagnostics);
  return {capture:c,text,usable:diagnostics.length===0,diagnostics};
 } catch(error) {diagnostics.push((error as Error).message);return {text,usable:false,diagnostics};}
}
export async function syntheticCapture(text:string):Promise<Capture> {const bytes=new TextEncoder().encode(text);return {schemaVersion:1,synthetic:true,capturedAt:'2026-10-04T00:00:00Z',tool:TOOL,origin:'https://example.com',requestedURL:'https://example.com/robots.txt',redirects:[],finalURL:'https://example.com/robots.txt',status:200,requestCount:0,userAgent:TOOL,headers:{'content-type':'text/plain; charset=utf-8'},bodyBase64:encodeBase64(bytes),bytes:bytes.length,sha256:await sha256(bytes),complete:true,truncated:false,encoding:'utf-8',diagnostics:[]};}
