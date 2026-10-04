# Méthode V1

La version rendue et complète est générée dans `dist/methode.html` à partir de `src/render.ts`. La CLI et le navigateur utilisent les mêmes modules ; aucune logique de règles n’est recopiée dans les composants visuels.

## Séparation des responsabilités

1. URL : une origine HTTP(S), un chemin absolu ou une URL absolue de même origine. Identifiants, protocoles différents, formes relatives, `//`, espaces, contrôles et `%` invalides refusés. L’autre origine reste `out_of_scope`.
2. Profil : jeton propre, éventuel repli daté et dimension `crawl` ou `usage`. Le suffixe `User` ne détermine pas à lui seul l’applicabilité.
3. Matcher : sélection exacte des jetons sans casse, groupes répétés combinés, groupe `*` seulement en l’absence du spécifique. Les règles non vides de plus grande priorité l’emportent, avec Allow à égalité. Toutes les règles décisives équivalentes sont conservées.
4. Attente et livraison : une autorisation peut être conforme ou un écart. La réponse HTTP ne devient pas une décision de règles par raccourci.

## Modèle et normalisation

Référence : [google/robotstxt, commit figé](https://github.com/google/robotstxt/tree/22b355ff855419e6a3ff8ff09c0ad7fdb17116f9), lu avec [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309.html), [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986.html) et [l’interprétation Google](https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec).

Le modèle Google figé accepte certaines typos/préfixes de clés et un séparateur sans deux-points à deux termes, extrait le préfixe alphabétique du jeton User-agent, ignore Sitemap et les extensions dans le matching, et possède une tolérance Allow `/index.htm*` vers la racine du répertoire. Les diagnostics exposent les directives ignorées : cela ne signifie pas qu’un opérateur les ignore.

La priorité est la longueur en octets du motif échappé, jokers inclus, conformément au code figé. Le glob est un automate borné, sans expression régulière construite depuis l’entrée. Le `$` n’est spécial qu’en fin de motif.

L’API WHATWG prépare les URL : IDN/hôte, port par défaut et segments point normalisés ; fragment retiré ; hexadécimaux `%HH` majuscules sans décodage. Casse du chemin, doubles slashs, ordre et contenu de la query conservés. Nous ne confondons pas `%2F` et `/`, ni `%23` et `#`. Les transformations sont listées dans chaque résultat. Ce contrat n’est pas une implémentation de toutes les normalisations possibles de RFC 3986.

## États et réception

Décision : `allow`, `disallow`, `indeterminate`, `out_of_scope`. Attente : `pass`, `fail`, `inconclusive`, `invalid`. Le code 2 l’emporte sur le code 1 en présence d’une seule incertitude ou entrée invalide. Un manifeste vide est invalide. Avant et candidate sont rapportés séparément ; le code final porte sur les attentes de la candidate et sur la complétude de l’ensemble.

Les captures enregistrent l’instant, l’outil, l’origine initiale, les redirections, l’URL finale, le statut, les requêtes réellement émises, une liste sûre d’en-têtes et les octets décodés conservés en base64 avec SHA-256. Le hash ne couvre pas des octets abandonnés. Une copie peut être éditée par son détenteur : cohérence du hash ne vaut pas authenticité signée de la provenance.

Différence binaire, différence de décision sur les cas, et respect des attentes restent distincts. Commentaire modifié ≠ différence de décision. Absence de différence sur le manifeste ≠ équivalence sur toutes les URL. Différence reçue ≠ preuve qu’un CDN en est la cause.

## Sources et limites des preuves

Les observations primaires sont datées dans `docs/source-observations.json`. Les copies complètes sont conservées dans la recette privée d’Edikka, pas republiées. Une tentative HTTP d’archivage Anthropic a reçu 429 ; la lecture via l’outil de consultation a réussi. Ce fait est conservé, pas remplacé par une prétendue archive.

Voir README et REPRODUCTION pour les limites de taille, HTTP, le corpus de concordance, les tests indépendants des URL/profils et la recette locale. Les contrôles automatiques d’accessibilité ne sont pas une certification RGAA.
