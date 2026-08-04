# @rezics/about

The static brand and product site for `about.rezics.com`, built with Astro,
React islands, SharkUI, and Tailwind CSS.

## Publication scope

The site publishes six locale-prefixed editions:

```text
/{locale}/
/{locale}/how-it-works/
/{locale}/uses/
/{locale}/products/
/{locale}/products/[slug]/
```

The supported locales are `zh-hant`, `zh-hans`, `en`, `ja`, `de`, and `ko`.
The v1 `/zh-hant/contact-us/` route remains supported. Missing non-default
product translations and contact editions redirect to the default `zh-hant`
content. Cloudflare Pages middleware negotiates `Accept-Language` only for
supported routes without a locale prefix.

## Architecture

- `src/content/locales/contract.ts` owns the typed About copy contract.
- `src/content/locales/{locale}/content.ts` owns each locale's complete site copy.
- `src/content/locales/{locale}/products/*.mdx` owns localized product documents.
- `src/content/productRegistry.ts` owns stable product identities and relations.
- `src/content/productDocuments.ts` validates document path, locale, uniqueness,
  default-locale completeness, and localized availability.
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
