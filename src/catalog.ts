import { hasAgent, type Parsed } from './engine';
export const CATALOG_VERSION='2026-10-04.1';
export type Profile={id:string;name:string;operator:string;tokens:string[];nature:'crawler'|'user-request'|'usage-control';dimension:'crawl'|'usage';coverage:'documented'|'modeled'|'partial'|'unknown';source:string;consultedAt:string;note:string;fallback?:string;uncertain?:string};
const sources={google:'https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers',openai:'https://developers.openai.com/api/docs/bots',apple:'https://support.apple.com/en-us/119829',anthropic:'https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler',perplexity:'https://docs.perplexity.ai/docs/resources/perplexity-crawlers'};
const make=(id:string,operator:keyof typeof sources,nature:Profile['nature'],note:string, extra:Partial<Profile>={}):Profile=>({id,name:id,operator,tokens:[id],nature,dimension:nature==='usage-control'?'usage':'crawl',coverage:'modeled',source:sources[operator],consultedAt:operator==='google'?'2026-10-04T06:38:34Z':'2026-10-04T06:38:35Z',note,...extra});
export const CATALOG:Profile[]=[
 make('GPTBot','openai','crawler','Collecte pouvant contribuer à l’entraînement. Simulation de règles, sans preuve de respect effectif.'),
 make('OAI-SearchBot','openai','crawler','Recherche OpenAI. Une autorisation ne garantit pas un affichage dans les résultats.'),
 make('ChatGPT-User','openai','user-request','Requêtes déclenchées par un utilisateur. Le modèle peut calculer une règle sans conclure à son application.',{coverage:'partial',uncertain:'La documentation précise que robots.txt peut ne pas s’appliquer à ces requêtes.'}),
 make('Googlebot','google','crawler','Exploration pour Google Search. Résultat du modèle Google, pas une observation du robot.',{coverage:'documented'}),
 make('Googlebot-Image','google','crawler','Préférence au groupe Googlebot-Image ; repli Googlebot si aucun groupe spécifique.',{coverage:'documented',fallback:'Googlebot',tokens:['Googlebot-Image','Googlebot']}),
 make('Google-Extended','google','usage-control','Contrôle l’utilisation pour entraîner les futurs modèles Gemini et le grounding documenté. Ne contrôle pas Google Search et ne possède pas de User-Agent HTTP distinct.',{coverage:'documented'}),
 make('Applebot','apple','crawler','Repli vers Googlebot si Applebot est absent. L’exemple Apple combine spécifique et général sans préciser son algorithme.',{fallback:'Googlebot',tokens:['Applebot','Googlebot'],coverage:'partial',uncertain:'L’exemple Apple est ambigu sur le cumul des groupes : calcul générique exploratoire seulement.'}),
 make('Applebot-Extended','apple','usage-control','Contrôle l’usage des données collectées par Applebot pour entraîner des modèles. Ne visite pas lui-même les pages.',{coverage:'modeled'}),
 make('ClaudeBot','anthropic','crawler','Collecte pour l’entraînement ; respect de robots.txt déclaré par Anthropic.'),
 make('Claude-SearchBot','anthropic','crawler','Recherche ; respect de robots.txt déclaré par Anthropic.'),
 make('Claude-User','anthropic','user-request','Requêtes à la demande ; Anthropic déclare le respect de robots.txt aussi pour ce profil.'),
 make('PerplexityBot','perplexity','crawler','Recherche Perplexity, pas entraînement des modèles fondamentaux. Prise en compte annoncée jusqu’à 24 h.')
];
export function resolveProfile(parsed:Parsed, id:string, genericToken?:string) {
 const profile=CATALOG.find(p=>p.id===id);
 if(id==='custom') return {profile:undefined,token:genericToken??'',steps:['Jeton libre : modèle générique, sans repli ni garantie d’opérateur.'],uncertain:undefined};
 if(!profile) return {profile:undefined,token:'',steps:['Profil inconnu.'],uncertain:'Profil absent du catalogue.'};
 let token=profile.id;
 const steps=[`Profil ${profile.id} → dimension ${profile.dimension}.`];
 if(profile.fallback && !hasAgent(parsed,profile.id) && hasAgent(parsed,profile.fallback)) {token=profile.fallback;steps.push(`Groupe ${profile.id} absent : repli documenté vers ${token}.`);}
 else steps.push(`Jeton ${token} ; ${hasAgent(parsed,token)?'groupe spécifique présent':'aucun groupe spécifique, sélection générique possible'}.`);
 return {profile,token,steps,uncertain:profile.uncertain};
}
