# @rezics/about

The static brand and product site for `about.rezics.com`, built with React 19, Vike,
`vike-react`, SharkUI, and Tailwind CSS.

## Current publication scope

The site currently publishes region-neutral Traditional Chinese only:

```text
/zh-hant/
/zh-hant/contact-us/
/zh-hant/products/
/zh-hant/products/[slug]/
```

The root and unlocalized product routes redirect to `zh-hant`. Additional locales should only
be added after their complete, typed content resource is ready.

## Architecture

- `src/content/locales/zh-hant/content.ts`: all user-visible copy and product explanations.
- `src/content/productRegistry.ts`: the 26 product identities, four guided paths, relations,
  and the three products with meaningful interactive demonstrations.
- `src/components/products/`: the site shell, real homepage, guided Products directory,
  product explanations, and focused demonstrations.
- `src/components/contact/`: the dedicated Contact Us experience.
- `pages/`: Vike file-based routes with SSR, client-side routing, trailing slashes, and full
  prerendering.
- `functions/_middleware.ts`: default-locale redirects for unlocalized public routes.

The homepage owns the brand narrative and Contact Us invitation, while `/contact-us/` owns the
actual contact channels. The Products directory starts from visitor intent rather than exposing
the registry as an undifferentiated feature list.

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

Cloudflare Pages uses `apps/about/dist/client` as its build output. Deployment does not depend
on `dist/server`.
