# @rezics/about

The static brand and product site for `about.rezics.com`, built with Astro,
React islands, SharkUI, and Tailwind CSS.

## Publication scope

The site publishes six locale-prefixed editions:

```text
/{locale}/
/{locale}/uses/
/{locale}/products/
/{locale}/products/[slug]/
/{locale}/contact-us/
/{locale}/legal/[slug]/
/{locale}/docs/[...slug]/
```

The supported locales are `zh-hant`, `zh-hans`, `en`, `ja`, `de`, and `ko`.
The default locale is `en`, and the Unit content license is currently published
in English. Contact content is currently published in `zh-hant` and `en`.
Missing non-default product, legal, and contact editions redirect to the
default English content. Cloudflare Pages middleware negotiates
`Accept-Language` only for
supported routes without a locale prefix.

`/{locale}/how-it-works/` is a retired route that redirects to the matching
localized Products page. The unprefixed `/how-it-works` entry also negotiates
the visitor's language and redirects directly to localized Products. Keep these
redirects until maintainers deliberately complete a later cutover.

## Architecture

- `src/content/locales/contract.ts` owns the typed About copy contract.
- `src/content/locales/{locale}/content.ts` owns each locale's complete site copy.
- `src/content/locales/{locale}/products/*.mdx` owns localized product documents.
- `src/content/locales/{locale}/docs/**/*.mdx` owns localized documentation.
- `src/content/productRegistry.ts` owns stable product identities, relations,
  stages, and the manually maintained editorial presentation order.
- `src/content/productDocuments.ts` validates document path, locale, uniqueness,
  default-locale completeness, and localized availability.
- `src/content/documentationDocuments.ts` validates documentation paths, locales,
  uniqueness, and localized availability.
- `src/pages/[locale]` contains canonical Astro routes.
- `functions/_middleware.ts` handles request-time locale negotiation for
  unprefixed public routes.
- `public/_routes.json` limits Functions invocations to those unprefixed routes;
  localized pages and assets remain static requests.

Astro's i18n configuration owns locale-prefixed routing. Because automatic
fallback generation targets physical locale directories, dynamic `[locale]`
routes explicitly emit static fallback redirects when localized content is
unavailable.

## Commands

Run from the repository root:

```bash
task apps-about:dev
task apps-about:check
task apps-about:test
task apps-about:build
task apps-about:test:dist
task apps-about:preview
```

Cloudflare Pages deploys `apps/about/dist`.

## Deployment

About has an independent release boundary. A reviewed `about/v*` tag or a manual
dispatch starts `.github/workflows/deploy-about-cloudflare-pages.yml`; platform
`v*` tags do not deploy this site. Deployments use the About-specific
`about-production` concurrency group and the shared `production` environment.
