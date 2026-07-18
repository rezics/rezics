# @rezics/about

The static multilingual product site for `about.rezics.com`, built with React 19, Vike, `vike-react`, MDX, and Tailwind CSS.

## Architecture

- `src/content/`: Copy in six languages, the product registry, page facts, and the media inventory.
- `pages/`: Vike file-based routes; global configuration enables SSR, client-side routing, trailing slashes, and full prerendering.
- `src/components/products/`: React pages and interactive components.
- `pages/_error/+Page.mdx`: MDX error page; MDX in this repository can import React components directly.
- `functions/_middleware.ts` and `public/_redirects`: Cloudflare language negotiation and permanent redirects for legacy URLs.

Public URLs remain:

```text
/[locale]/
/[locale]/products/
/[locale]/products/[slug]/
```

The legacy singular `product` route permanently redirects. A single registry generates canonical URLs, hreflang, Open Graph, JSON-LD, and the sitemap for every public page.

## Commands

Run from the repository root:

```bash
yarn task about:dev
yarn task about:check
yarn task about:test
yarn task about:build
yarn task about:test:dist
yarn task about:preview
```

Cloudflare Pages uses `apps/about/dist/client` as its build output. Deployment does not depend on `dist/server`.
