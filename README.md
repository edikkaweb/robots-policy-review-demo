# Revue robots.txt

**Vous modifiez votre robots.txt. Quelles URL changent de règle ?**

Un instrument Edikka : comparez deux fichiers, déclarez des attentes, expliquez chaque décision et rejouez les mêmes contrôles sur une capture de livraison. L’interface est française. Les jeux publics sont synthétiques.

Le cas principal montre comment ajouter `User-agent: GPTBot` pour interdire `/blog/` peut rendre `/documents/` autorisé dans le modèle : le groupe spécifique ne cumule pas automatiquement les restrictions du groupe `*`. La correction répond à l’intention déclarée, sans préconiser une politique universelle.

## Utiliser

Node **22.12 minimum** (CI : Node 22), npm, aucune clé API.

```sh
npm ci
npm run build
npm run preview
```

Ouvrir `http://127.0.0.1:4187/robots-policy-review-demo/`. L’interface importe les deux robots.txt et des attentes JSON ou CSV, explique groupes/règles, filtre, pagine et exporte. Les attentes peuvent être éditées en JSON. Les documents de méthode et le catalogue sont des pages HTML rendues.

**Analyse dans votre navigateur. Vos fichiers ne sont pas envoyés à un serveur.** Après le chargement initial des ressources, aucune requête n’est nécessaire aux imports, calculs et exports. Aucun compte, analytics, LLM, backend ou stockage automatique. Le worker embarqué peut être interrompu. Le reset efface les entrées de session.

## Rejouer en CLI

```sh
npm run review -- check --robots examples/corrected.txt --expectations examples/expectations.json --out reports/local
npm run review -- compare --before examples/before.txt --after examples/proposed.txt --expectations examples/expectations.json --out reports/comparison
npm run review -- check-served --origin https://example.com --planned examples/corrected.txt --expectations examples/expectations.json --out reports/served
npm run review -- replay --capture reports/served/capture.json --planned examples/corrected.txt --expectations examples/expectations.json --out reports/replay
```

`check`, `compare` et `replay` sont hors ligne. `check-served` réalise une acquisition explicite de **/robots.txt et ses redirections seulement**. Il ne visite ni les URL des attentes ni les sitemaps. Les chemins de sortie sont locaux, exclus de Git et jamais publiés automatiquement.

Codes : **0** = contrôle complet conforme ; **1** = contrôle complet avec écart ; **2** = invalide, incomplet ou indéterminé. Le code 2 est prioritaire. La conformité porte sur la candidate ; une nouvelle attente non satisfaite auparavant n’est pas automatiquement une régression. La V1 exige des attentes pour comparer : pas de succès implicite sans critères.

## Ce que cela établit

- Une décision du modèle (`allow`, `disallow`), distincte de l’intention (`pass`, `fail`). Les entrées invalides, autres origines et incertitudes restent visibles.
- L’identité SHA-256 des octets UTF-8 analysés ; les fichiers importés conservent CRLF et BOM en mémoire, même si l’éditeur les affiche avec des fins de ligne normalisées. Après édition, le hash porte sur le texte réellement édité.
- La réception observée par la CLI, distincte des décisions et de leur applicabilité. Une capture réimportée n’est pas une attestation signée du serveur.
- Les replis documentés Googlebot-Image → Googlebot et Applebot → Googlebot sont résolus **hors du matcher brut**.
- Google-Extended et Applebot-Extended sont des contrôles d’usage. ChatGPT-User et l’ambiguïté Applebot restent non concluants. Claude-User est traité selon sa propre documentation.

Cela ne prouve pas le respect de robots.txt par un acteur, ne protège pas un accès, ne désindexe rien, n’efface pas des collectes et ne garantit aucun résultat SEO ou juridique.

## Référence et vérifications

Moteur TypeScript de production unique, utilisé dans navigateur et CLI. Oracle **C++ réellement distinct**, source Google inchangée au commit `22b355ff855419e6a3ff8ff09c0ad7fdb17116f9`. Dépendance Abseil figée. Aucun moteur réseau n’entre dans le bundle navigateur.

```sh
npm run check
npm test
cmake -S oracle -B .cache/oracle -DCMAKE_BUILD_TYPE=Release
cmake --build .cache/oracle -j 4
npm run test:oracle
npm run build
npm run preview
# Dans un autre terminal, après installation des navigateurs :
npx playwright install chromium firefox
npm run test:browser
```

Voir [la procédure de reproduction](REPRODUCTION.md), [le rapport réel de concordance](proofs/oracle.json), [le corpus exécuté](proofs/oracle-corpus.json), [la mesure de performance](proofs/performance.json) et [la recette navigateur](proofs/browser.json). Un accord sur un corpus fini n’est ni une preuve universelle ni une certification Google.

## Limites acceptées

2 Mio par fichier, 16 663 octets par ligne, 10 000 règles, 8 192 octets par URL, 5 000 attentes. Budget borné de 20 millions d’opérations par fichier. UTF-8 uniquement ; NUL, Unicode invalide et dépassements sont refusés explicitement. Attentes importées dans le navigateur : 4 Mio ; CLI : 8 Mio. Les profils Google deviennent indéterminés au-delà de **500 Kio** : leur troncature n’est pas simulée.

Acquisition : 15 s au total, 5 redirections, 2 Mio **décodés**, aucune relance ni authentification. Les adresses non publiques sont refusées sauf `--allow-local` explicite. Seuls des en-têtes utiles prédéfinis sont retenus ; aucun Set-Cookie. 404/429/503, HTML en 200, interruption, encodage douteux ou troncature ne donnent pas une réception verte. Le cache de l’opérateur reste inconnu.

Les exemples ne doivent jamais être déployés comme le véritable `/robots.txt` du site. Les exports peuvent contenir des chemins sensibles ; ils restent à l’utilisateur. Le CSV neutralise les préfixes de formule avec une apostrophe ; le JSON conserve les données brutes.

## Repères

| Source | Responsabilité |
|---|---|
| `src/engine.ts` | Parsing, groupes, glob borné, règles et preuve |
| `src/url.ts` | Origine et préparation WHATWG explicite |
| `src/catalog.ts` | Profils sourcés, couverture, replis |
| `src/expectations.ts` | JSON, validation, CSV et erreurs de lignes |
| `src/report.ts` | Intentions, provenance, rapport et CSV |
| `src/acquisition.ts` | GET Node borné et capture |
| `src/capture.ts` | Intégrité, état de capture et relecture hors ligne |
| `src/app.ts`, `src/worker.ts`, `src/render.ts` | Interface, worker et HTML initial calculé |
| `examples/`, `schemas/` | Données synthétiques et formats versionnés |
| `vendor/`, `oracle/`, `proofs/` | Référence, adaptateur et preuves exécutées |

Voir aussi [méthode](METHOD.md), [catalogue et sources](CATALOG.md), [intégration éditoriale préparée](INTEGRATION.md), [licences tierces](THIRD_PARTY.md) et [changements](CHANGELOG.md).

Licence MIT pour le projet ; Apache-2.0 pour la référence Google et Abseil. Edikka / Bertrand Morel, 2026.
