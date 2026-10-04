import { LIMITS } from './engine';
export type Prepared = {raw:string; origin:string; normalized?:string; path?:string; state:'valid'|'invalid'|'out_of_scope'; transformations:string[]; reason?:string};
export function originURL(raw:string):string {
  const u=new URL(raw);
  if(!/^https?:$/.test(u.protocol) || u.username || u.password || u.pathname!=='/' || u.search || u.hash || /[\s\\]/.test(raw)) throw new Error('Origine HTTP(S) seule attendue, sans identifiants, chemin, query ni fragment.');
  return u.origin;
}
export function prepareURL(raw: string, origin: string):Prepared {
  const result:Prepared={raw,origin,state:'invalid',transformations:[]};
  try {
    const o=originURL(origin);
    if(new TextEncoder().encode(raw).length>LIMITS.urlBytes) throw new Error('URL supérieure à 8 192 octets.');
    if(!raw || /[\x00-\x20\x7f\\]/.test(raw) || /%(?![a-f0-9]{2})/i.test(raw)) throw new Error('URL vide, espace/contrôle, antislash ou échappement % invalide.');
    if(!(raw.startsWith('/') && !raw.startsWith('//')) && !/^https?:\/\//i.test(raw)) throw new Error('Utiliser un chemin /absolu ou une URL HTTP(S) absolue.');
    const url=new URL(raw,o);
    if(url.username||url.password) throw new Error('Identifiants dans l’URL refusés.');
    if(url.hash) {result.transformations.push('Fragment retiré (non envoyé au serveur).');url.hash='';}
    if(raw.includes('#') && !result.transformations.length) result.transformations.push('Délimiteur de fragment vide retiré.');
    result.normalized=url.href;
    // WHATWG preserves escape spelling. Uppercase %HH is our explicit comparison contract.
    result.path=(url.pathname+url.search).replace(/%[a-f0-9]{2}/gi,s=>s.toUpperCase());
    if(result.path!==url.pathname+url.search) result.transformations.push('Chiffres hexadécimaux %HH mis en majuscules, sans décodage.');
    if(raw!==url.href) result.transformations.push('Préparation WHATWG : origine/base, IDN, port par défaut, UTF-8 et segments point éventuels. Requête et casse du chemin conservées.');
    result.origin=o;
    if(url.origin!==o) {result.state='out_of_scope';result.reason='Autre origine : aucune décision robots attribuée.';return result;}
    result.state='valid'; return result;
  } catch(error) {result.reason=(error as Error).message; return result;}
}
