# @rezics/about

Static, multilingual product site for `about.rezics.com`, built with Astro 6,
Tailwind CSS 4, and vanilla browser interactions.

## Product model

The public site is generated from one typed product registry:

- `surface`: Catalog, Book, Media, Post, Zone, and other carrier products.
- `capability`: Content Structure, History, Entity & Attribution, and other
  shared platform products.
- `manifestation`: GameBook, Wiki, Picture, Review, and Library.
- `protocol`: internal concepts such as Unit, Chapter, and Block Schema;
  protocols do not generate public product pages.

Important relationships are encoded in `src/content/productRegistry.ts`.
For example, GameBook belongs to Book, GameContentStructure is a Content
Structure mode, and Entity & Attribution is an implemented independent
capability containing Entity, CreditAttribution, and SubjectAttribution.

## Content architecture

- `src/content/productRegistry.ts`: non-translatable product facts,
  relationships, status, claims, and media manifests.
- `src/content/siteCopy.ts`: six-language global, directory, and page copy.
- `src/content/productCopy.ts`: explicit localized copy for every product.
- `src/content/productPageFacts.ts`: detailed scenarios, workflows, and
  product boundaries.
- `src/content/interfaceCopy.ts`: localized homepage details and
  accessibility labels.
- `src/components/products/`: code-native product stages and page sections.

The supported locales are Traditional Chinese, Simplified Chinese, English,
Japanese, German, and Korean. Product slugs and domain relationships are
defined once; localized files contain copy only.

## Routes

Public routes use the plural form:

```text
/[locale]/
/[locale]/products/
/[locale]/products/[slug]/
```

The sitemap contains the homepage, product directory, and all product pages for
all six locales. Each page emits canonical and alternate-language links,
including `x-default`.

Legacy singular routes and the former `entity-source` route are permanent
redirects. Cloudflare Pages receives both a middleware implementation and
ordered `public/_redirects` fallback rules.

## Media and interaction

Product stages prefer real screenshots. Until those assets are available,
replaceable HTML/CSS concept interfaces provide stable dimensions without
abstract illustrations, generated interface text, or decorative relationship
graphs.

Interactions are implemented without a client framework:

- manual homepage product switching;
- product-directory previews;
- Structure Tree/Game modes;
- GameBook choices;
- History scopes;
- Credit/Subject Attribution modes;
- FAQ accordions;
- theme selection and mobile navigation.

Reduced-motion preferences disable entrance movement and animated drawer
height changes.

## Commands

From the repository root:

```bash
yarn install --immutable
yarn task about:dev
yarn task about:check
yarn task about:test
yarn task about:build
yarn task about:preview
```

## Cloudflare Pages

- Root build command: `yarn task about:build`
- Application directory: `apps/about`
- Build output directory: `apps/about/dist`
- Custom domain: `about.rezics.com`

Deployment is handled by
`.github/workflows/deploy-about-cloudflare-pages.yml` with Cloudflare Pages Direct
Upload. The workflow requires `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID`; `CLOUDFLARE_PAGES_PROJECT_NAME` is optional and
defaults to `rezics-about`. Release tags use the `about-v*` namespace so other
monorepo releases cannot deploy this site accidentally.

This project remains static-first. It does not request Outline at production
runtime and does not require authentication, database bindings, or a client
framework.
