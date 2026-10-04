# Reproduction et portée de la validation

## Environnement

Node 22.12+, npm, CMake 3.20+ et compilateur C++17. `npm ci` utilise le lockfile. CMake récupère Abseil au commit `d9e4955c65cd4367dd6bf46f4ccb8cd3d100540b` (Apache-2.0). Le code Google est conservé inchangé sous `vendor/google-robotstxt/` ; identités dans `vendor/manifest.json`.

```sh
npm ci
npm run build
npm run check
npm test
cmake -S oracle -B .cache/oracle -DCMAKE_BUILD_TYPE=Release
cmake --build .cache/oracle -j 4
npm run test:oracle
npm run build
npx playwright install chromium firefox
npm run preview
# autre terminal :
npm run test:browser
```

Pour une copie locale d’Abseil déjà vérifiée, ajouter `-DFETCHCONTENT_SOURCE_DIR_ABSEIL=/chemin/abseil`. `ROBOTS_ORACLE` permet de choisir le binaire compilé. L’adaptateur `oracle/main.cc` ne fait que convertir l’I/O hexadécimale ; il ne réimplémente aucune règle.

Le premier build C++ local a échoué car les en-têtes standard n’étaient pas trouvés par le SDK sélectionné. La recette a utilisé CMake 3.31.6 installé dans un venv temporaire et ajouté `-DCMAKE_CXX_FLAGS='-isystem /Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk/usr/include/c++/v1'`. Ce correctif d’environnement n’est pas requis en CI Ubuntu. Le build final a un avertissement de lien de bibliothèque dupliquée, sans erreur.

## Corpus et exclusions

Graine **20261004**, budget **1 000 triplets générés** plus fixtures explicites. Le nombre effectif vient de `proofs/oracle.json`, pas d’un taux codé dans la page. Les fichiers, jetons et URL préparées de chaque cas sont sauvegardés dans `proofs/oracle-corpus.json`. Le rapport inclut les divergences (même si elles sont vides), environnement, date réelle, moteur, SHA et empreintes des sources natives.

Parsing/matching seulement. URL préparée, résolution de profils, dimension d’usage et réception HTTP ne sont pas des responsabilités du binaire. Ils ont des tests séparés. La V1 refuse explicitement NUL, Unicode invalide, fichier >2 Mio, ligne >16 663 octets ; elle ne simule pas les troncatures de la référence. Ces limites ne sont pas des exclusions ajoutées après coup pour masquer des divergences.

## Parcours et acquisition

`tests/core.test.mjs` : scénario principal, preuves, groupes, priorité, encodage, URL, profils, imports, incertitudes, exports, captures et lot 5 000 cas.

`tests/http.test.mjs` : serveur local synthétique, 200 vide, erreurs 404/429/503, timeout, boucle, limite de redirections, corps tronqué, gzip, HTML, encodage invalide, connexion interrompue ; puis CLI et relecture de capture. Aucun site client ni origine Edikka contacté.

`tests/browser.mjs` : sous-chemin, correction et cinq exemples, imports JSON/CSV, export/reimport, exactitude des octets CRLF, parité avec le module utilisé par la CLI, capture, injection HTML/formule, invalidité, annulation du worker, pagination, reset et absence de stockage. Réseau désactivé après chargement pour les opérations ; nombre de requêtes contrôlé. Clavier, mobile, sans JS, mouvement réduit, axe, Chromium et Firefox.

Les captures d’écran sont écrites localement dans `test-results/`. Les preuves publiées ne contiennent que des données synthétiques. Le contrôle automatique n’est pas un audit exhaustif d’accessibilité.

## Publication

Le workflow construit et teste, compile l’oracle puis exige son succès, rejoue les tests navigateur et enfin téléverse **dist uniquement**. Le job de déploiement dépend du job de vérification et ne s’exécute que sur la branche principale. Pages doit être configuré avec la source GitHub Actions. Aucun workflow ne committe de rapport utilisateur.

Un oracle absent échoue avec le code 2. Il n’est jamais remplacé par le moteur TypeScript pour fabriquer une preuve verte.
