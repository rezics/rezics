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

- `src/content/locales/zh-hant/content.ts`: shared shell, directory, contact, and interactive
  component copy for the published locale.
- `src/content/locales/zh-hant/products/*.mdx`: one editorial document for each product. Each
  document owns its name, summary, introduction, and freely structured explanation.
- `src/content/productMetadataPlugin.ts` and `productDocumentMetadata.ts`: expose metadata-only
  build modules, validate their unknown exports, and prove that every registered product has
  exactly one document in every published locale.
- `src/content/productDocuments.client.ts` and `productDocuments.server.ts`: resolve through one
  environment-aware virtual module, so prerendering receives complete HTML while the browser
  lazily loads only the selected product body.
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

## Product documents

The filename must match a registered product slug. Each document exports literal metadata and
starts its editorial body below the page-owned product heading:

```mdx
export const metadata = {
	name: "書籍",
	summary: "把一本書的作品身分、版本與內容放在同一個產品表面。",
	introduction: "書籍先是一個可辨認的作品，再有版本、目錄與貢獻關係。",
};

## First document-owned section

The rest of the structure belongs to this product.
```

The build rejects missing documents, unknown slugs, duplicate documents, incomplete metadata,
and executable metadata values. Shared navigation and interactive component states remain in the
typed locale content contract.

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
