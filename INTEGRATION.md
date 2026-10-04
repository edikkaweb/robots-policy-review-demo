# Intégration publique Edikka — 4 octobre 2026

La démonstration V1.0.0 est publiée sur [GitHub Pages](https://edikkaweb.github.io/robots-policy-review-demo/). Une extension de mission autorisée le 4 octobre 2026 l’a reliée aux parcours Edikka français et anglais. Aucun robots.txt de production n’a été modifié.

- [Insight FR](https://www.edikka.com/insights/seo/bloquer-robots-ia#robots-policy-review-demo) · [Insight EN](https://www.edikka.com/en/insights/seo/block-ai-crawlers#robots-policy-review-demo)
- [Bibliothèque FR](https://www.edikka.com/bibliotheque#github-lab) · [Bibliothèque EN](https://www.edikka.com/en/library#github-lab)
- [Portail FR](https://edikkaweb.github.io/) · [Portail EN](https://edikkaweb.github.io/index-en.html)

Les présentations sont bilingues ; la version anglaise annonce explicitement l’interface et la documentation françaises. Depuis Edikka, la démo, le code et le protocole s’ouvrent dans un nouvel onglet annoncé. La démo propose un retour à l’article de référence.

## FR

**Revue robots.txt — vérifier les effets d’une modification**

Ajouter une restriction à un groupe spécifique peut autoriser un chemin auparavant exclu par le groupe général. Cette démonstration le rend visible, puis permet de comparer deux fichiers avec vos propres attentes. Chaque résultat expose le profil résolu, les groupes et les lignes décisives. Une CLI rejoue les mêmes contrôles sur le fichier reçu.

Analyse locale dans le navigateur, exemples synthétiques et méthode publique. L’instrument vérifie des règles et une intention ; il ne prouve pas qu’un robot les respecte et ne constitue pas une protection d’accès.

Le laboratoire propose neuf démonstrations. Cet ajout ne crée pas un nouvel instrument scientifique versionné et ne change pas l’édition ni les DOI de la bibliothèque.

## EN

**robots.txt review — check what a change actually permits**

Adding a specific crawler group can allow a path previously excluded by the wildcard group. This demonstration shows the change, then lets you compare two files against your own explicit expectations. Each result exposes the resolved profile, selected groups and decisive lines. A local CLI can replay the checks against a captured response.

Files are analysed locally in the browser. Examples are synthetic and the method is public. The tool evaluates a rules model and declared intent; it does not prove crawler compliance or enforce access control. The V1 interface is in French.

## Vérification de l’intégration

Les quatre pages Edikka ont été contrôlées localement puis en production dans Chrome : HTTP 200, liens exacts, `target="_blank"`, `noopener`, langue annoncée, canonicals et alternates FR/EN, JSON-LD parsable, clavier, largeurs 390 et 320 px, visibilité sans JavaScript et en mouvement réduit. Axe ne relève aucune violation dans les nouveaux blocs ; ce contrôle ne constitue pas un audit global ni une certification RGAA. L’aller-retour vers GitHub Pages a été observé avec un nouvel onglet sans `window.opener`.

[Preuve synthétique de publication et de navigation](proofs/integration.json). Le moteur, l’application, les résultats et le tag V1.0.0 restent ceux de la recette de démonstration.
