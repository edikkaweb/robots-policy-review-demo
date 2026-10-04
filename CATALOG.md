# Catalogue 2026-10-04.1

Source exécutable : `src/catalog.ts`. Version HTML détaillée : `dist/catalogue.html`, construite avec chaque profil, jeton, repli, niveau de couverture, dimension et source datée. Le rapport inclut le SHA-256 du catalogue sérialisé.

| Source primaire | Profils et fait retenu |
|---|---|
| [OpenAI](https://developers.openai.com/api/docs/bots) | GPTBot : collecte pouvant servir à l’entraînement. OAI-SearchBot : recherche. ChatGPT-User : demande utilisateur ; règles pouvant ne pas s’appliquer, résultat final indéterminé. |
| [Google](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers) | Googlebot : exploration Search. Googlebot-Image : repli Googlebot si son groupe est absent. Google-Extended : contrôle d’usage pour entraînement Gemini et grounding documenté, pas robot HTTP ni contrôle de Search. |
| [Apple](https://support.apple.com/en-us/119829) | Applebot : repli Googlebot documenté mais exemple ambigu sur spécifique/général, donc calcul exploratoire. Applebot-Extended : usage des données d’Applebot pour entraînement, sans crawl propre. |
| [Anthropic](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) | ClaudeBot, Claude-SearchBot, Claude-User : entraînement, recherche et demande utilisateur respectivement ; respect de robots.txt déclaré pour les trois. |
| [Perplexity](https://docs.perplexity.ai/docs/resources/perplexity-crawlers) | PerplexityBot : recherche, pas entraînement de modèles fondamentaux ; délai annoncé de prise en compte jusqu’à 24 heures. |

`documented` identifie la famille Google confrontée à sa référence. `modeled` signifie rôle documenté et calcul générique, sans connaissance de l’implémentation interne. `partial` marque l’applicabilité incertaine et rend le résultat non concluant. Aucun respect réel du protocole n’est mesuré.

Le mode `custom` exige `genericToken` et `dimension: crawl` ; lettres ASCII, tiret et underscore. Aucune identité d’opérateur ni repli ne lui est attribué. Les rôles et documentations peuvent évoluer ; la date identifie une consultation, pas une validité perpétuelle.
