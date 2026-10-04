# Third-party components

- **google/robotstxt** — Copyright 1999 Google LLC, Apache License 2.0. Unmodified `robots.cc`, `robots.h` and LICENSE are in `vendor/google-robotstxt`. Commit: `22b355ff855419e6a3ff8ff09c0ad7fdb17116f9`. Native test oracle only. Our TypeScript implementation and explanatory reporting are separate; no Google endorsement is claimed.
- **Abseil C++** — Apache License 2.0, fetched at immutable commit `d9e4955c65cd4367dd6bf46f4ccb8cd3d100540b`. Used by the native oracle, not the public runtime. Its checkout retains its LICENSE.
- **TypeScript** — Apache-2.0; development type checking.
- **esbuild** — MIT; development bundler.
- **Playwright** — Apache-2.0; browser verification.
- **axe-core / @axe-core/playwright** — MPL-2.0; development accessibility checks, not distributed in the public runtime.
- **Ajv** — MIT; development JSON Schema validation, `$data` disabled.
- **@types/node** — MIT; development types.

Exact dependency versions and integrity records are in package-lock.json. No third-party script, font or service is requested by the public application at runtime.

Primary documentation is linked and summarized in the catalogue/method; it is not copied wholesale into the public site. Source observations are dated in docs/source-observations.json. Example data is synthetic.
