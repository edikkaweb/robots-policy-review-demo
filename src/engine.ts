/** Independent TypeScript implementation of the pinned Google matching model.
 * See METHOD.md and vendor/google-robotstxt/LICENSE for reference provenance.
 * URL preparation and operator-specific fallback are deliberately external. */
export const ENGINE = 'edikka-rep/1.0.0';
export const REFERENCE = '22b355ff855419e6a3ff8ff09c0ad7fdb17116f9';
export const LIMITS = { bytes: 2 * 1024 * 1024, lineBytes: 16663, rules: 10000, urlBytes: 8192, cases: 5000, operations: 20_000_000 };
export type Rule = { kind: 'allow'|'disallow'; value: string; pattern: string; line: number; raw: string };
export type Group = { id: number; agents: {token: string; value: string; line: number}[]; rules: Rule[] };
export type Diagnostic = { line?: number; level: 'info'|'warning'|'error'; message: string };
export type Parsed = { text: string; groups: Group[]; diagnostics: Diagnostic[]; bytes: number; supported: boolean };
const encoder = new TextEncoder();
const trim = (s: string) => s.replace(/^[\t\n\v\f\r ]+|[\t\n\v\f\r ]+$/g, '');
export const validToken = (s: string) => /^[a-z_-]+$/i.test(s);
export function escapePattern(value: string): string {
  return value.replace(/%[0-9a-f]{2}|[^\x00-\x7F]/giu, c => c.startsWith('%') ? c.toUpperCase() : Array.from(encoder.encode(c), b => '%' + b.toString(16).toUpperCase().padStart(2,'0')).join(''));
}
export function parseRobots(text: string): Parsed {
  const diagnostics: Diagnostic[] = [], groups: Group[] = [];
  const bytes = encoder.encode(text).length;
  if(bytes > LIMITS.bytes) diagnostics.push({level:'error', message:'Fichier au-delà de 2 Mio : analyse refusée, aucune troncature silencieuse.'});
  if(text.includes('\0') || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(text)) diagnostics.push({level:'error', message:'Octet nul ou Unicode invalide non pris en charge.'});
  if (/^\s*(?:<!doctype\s+html|<html\b)/i.test(text)) diagnostics.push({level:'error',message:'Contenu HTML reçu à la place d’un fichier robots.txt.'});
  if(bytes > LIMITS.bytes) return {text, groups, diagnostics, bytes, supported:false};
  let group: Group | undefined;
  let hasRule = false, rules = 0;
  text.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/).forEach((raw, index) => {
    const line = index + 1;
    if(encoder.encode(raw).length > LIMITS.lineBytes) {diagnostics.push({line,level:'error',message:'Ligne supérieure à 16 663 octets : limite du modèle, non tronquée.'}); return;}
    const clean = trim(raw.split('#',1)[0]); if(!clean) return;
    let sep = clean.indexOf(':');
    if(sep < 0) {
      const pair = clean.match(/^([^ \t]+)[ \t]+([^ \t]+)$/);
      if(!pair) {diagnostics.push({line,level:'warning',message:'Ligne sans directive interprétable, ignorée.'}); return;}
      sep = pair[1].length;
      diagnostics.push({line,level:'warning',message:'Deux-points absent : tolérance du modèle Google.'});
    }
    const key = trim(clean.slice(0,sep)).toLowerCase(), value = trim(clean.slice(sep+1)); if(!key) return;
    let kind: 'user-agent'|'allow'|'disallow'|'sitemap'|'unknown' = 'unknown';
    if(/^(user-agent|useragent|user agent)/.test(key)) kind='user-agent';
    else if(key.startsWith('allow')) kind='allow';
    else if(/^(disallow|dissallow|dissalow|disalow|diasllow|disallaw)/.test(key)) kind='disallow';
    else if(/^(sitemap|site-map)/.test(key)) kind='sitemap';
    if(kind !== 'unknown' && key !== kind) diagnostics.push({line,level:'warning',message:`Clé « ${key} » interprétée comme ${kind} : tolérance Google.`});
    if(kind==='user-agent') {
      if(!group || hasRule) { group={id:groups.length+1, agents:[],rules:[]}; groups.push(group); hasRule=false; }
      const token = /^\*(?:$|\s)/.test(value) ? '*' : (value.match(/^[a-z_-]+/i)?.[0] ?? '').toLowerCase();
      group.agents.push({token,value,line});
      if(!token || (token!=='*' && token!==value.toLowerCase())) diagnostics.push({line,level:'warning',message:'Jeton vide ou suffixe de User-agent ignoré selon le modèle Google.'});
    } else if(kind==='allow' || kind==='disallow') {
      if(!group) {diagnostics.push({line,level:'warning',message:'Règle avant tout User-agent : ignorée.'}); return;}
      hasRule=true; rules++;
      group.rules.push({kind,value,pattern:escapePattern(value),line,raw});
    } else diagnostics.push({line,level:'info',message:kind==='sitemap'?'Sitemap conservé comme diagnostic, jamais récupéré.':`Directive « ${key} » ignorée par ce matcher ; pas une conclusion sur l’opérateur.`});
  });
  if(rules > LIMITS.rules) diagnostics.push({level:'error',message:'Plus de 10 000 règles : analyse refusée.'});
  return {text,groups,diagnostics,bytes,supported:!diagnostics.some(d=>d.level==='error')};
}
export function hasAgent(parsed: Parsed, token: string): boolean {return parsed.groups.some(g=>g.agents.some(a=>a.token===token.toLowerCase()));}
/** Bounded glob automaton, no user-provided regular expression. */
function matches(path: string, pattern: string, budget: {remaining:number}): boolean {
  let positions=[0];
  for(let j=0;j<pattern.length;j++) {
    budget.remaining -= positions.length + 1;
    if(budget.remaining < 0) throw new Error('Budget de calcul dépassé : résultat indéterminé.');
    const c=pattern[j];
    if(c==='$' && j===pattern.length-1) return positions[positions.length-1]===path.length;
    if(c==='*') {budget.remaining-=path.length+1; positions=Array.from({length:path.length-positions[0]+1},(_,i)=>positions[0]+i);}
    else {positions=positions.filter(p=>p<path.length && path[p]===c).map(p=>p+1); if(!positions.length) return false;}
  }
  return true;
}
export type MatchResult = {decision:'allow'|'disallow'|'indeterminate'; groups: Group[]; matched:(Rule & {priority:number; effectivePattern:string})[]; decisive:(Rule & {priority:number; effectivePattern:string})[]; reason:string};
export function matchRobots(parsed: Parsed, token: string, path: string, budget={remaining:LIMITS.operations}): MatchResult {
  const empty = {groups:[],matched:[],decisive:[]} as Pick<MatchResult,'groups'|'matched'|'decisive'>;
  if(!parsed.supported || !validToken(token) || !path.startsWith('/') || encoder.encode(path).length>LIMITS.urlBytes) return {...empty,decision:'indeterminate',reason:'Entrée hors limites ou jeton invalide.'};
  const specific = parsed.groups.filter(g=>g.agents.some(a=>a.token===token.toLowerCase()));
  const groups = specific.length ? specific : parsed.groups.filter(g=>g.agents.some(a=>a.token==='*'));
  const matched: MatchResult['matched']=[];
  try {
    for(const rule of groups.flatMap(g=>g.rules)) {
      let effectivePattern=rule.pattern;
      let match=matches(path,effectivePattern,budget);
      // Pinned Google legacy Allow /index.htm* fallback to the directory root.
      if(!match && rule.kind==='allow') {
        const slash=effectivePattern.lastIndexOf('/');
        if(slash>=0 && effectivePattern.slice(slash).startsWith('/index.htm')) {effectivePattern=effectivePattern.slice(0,slash+1)+'$'; match=matches(path,effectivePattern,budget);}
      }
      if(match) matched.push({...rule,effectivePattern,priority:effectivePattern.length});
    }
  } catch(error) {return {groups,matched,decisive:[],decision:'indeterminate',reason:(error as Error).message};}
  const max=matched.reduce((n,r)=>Math.max(n,r.priority),0), decisive=matched.filter(r=>r.priority===max && max>0);
  const decision=decisive.some(r=>r.kind==='allow') || !decisive.length ? 'allow' : 'disallow';
  return {decision,groups,matched,decisive,reason: !decisive.length ? 'Aucune règle non vide correspondante : autorisation dans le modèle.' : `${decisive.length>1?'Règles ex æquo':'Règle la plus précise'} (${max} octets de motif normalisé, jokers inclus). ${decisive.some(r=>r.kind==='allow')?'Allow prévaut à égalité.':'Disallow prévaut.'}`};
}
