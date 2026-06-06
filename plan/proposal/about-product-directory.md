---
title: About Site Product Directory
status: done
created: 2026-06-06
completed: 2026-06-06
supersededBy:
tags: [about, product-page, content, ui]
---

## Why

The localized about site currently treats `/product/` as a product narrative for
Rezics itself. That makes the page read like a second about/story page, even
though its durable role should be a product directory: a scannable list of
Rezics product surfaces that can grow beyond the first app.

The same change should fix hero body rendering. Some localized hero body copy is
now intentionally written as multiple paragraphs, but the layout renders
`hero.body` as one `<p>`, so browser whitespace collapsing removes the intended
breaks. The implementation should make paragraph structure explicit instead of
depending on raw newlines inside a string.

## Durable constraints & decisions

- `(type)` `hero.body` must support explicit multi-paragraph copy in the content
  schema and TypeScript content types, while preserving a simple authoring shape
  for localized MDX frontmatter.
- `(test)` Hero body rendering must preserve paragraph boundaries for locales
  that provide more than one paragraph, instead of collapsing them into one
  paragraph.
- `(test)` `/product/` must remain structurally distinct from the home page:
  home is the brand/about narrative, product is the product directory.
- `(type)` Product entries should model directory concerns directly: product
  name, short summary, category or family, lifecycle/status, CTA label/href when
  available, and compact capability bullets/features.
- `(comment)` The product page is allowed to include mocked or future-facing
  Rezics product surfaces, as long as status/category copy makes their maturity
  clear. This keeps the directory shape honest before every product is live.
- `(test)` Product page copy and CTA labels must stop calling the page a
  "product story"; navigation can still say "Product"/"Products" by locale.
- `(test)` The existing user-owned `en` and `zh-hant` hero wording decisions must
  be preserved when reshaping data, including the chosen eyebrow/source wording.
- `(comment)` The about site remains static and informational. Authenticated
  search, saving, voting, editing, realm membership, wiki authoring, and other
  app-state workflows continue to link out to the main Rezics product origin.

## Tasks

## 1. Content Shape

- [x] 1.1 Update `src/content.config.ts` so hero body content can be authored as
  explicit paragraphs.
- [x] 1.2 Update `src/content/types.ts` to match the new hero paragraph shape
  and product directory fields.
- [x] 1.3 Update localized `src/content/*/index.mdx` files to use the new hero
  body shape without changing the user-owned `en` and `zh-hant` wording.
- [x] 1.4 Replace localized `src/content/*/product.mdx` product narrative data
  with directory-oriented product entries.

## 2. Product Directory Layout

- [x] 2.1 Update `src/layouts/AboutLayout.astro` to render hero body paragraphs
  as multiple paragraph elements.
- [x] 2.2 Update `src/layouts/AboutLayout.astro` so product pages prioritize the
  product directory before any supporting narrative content.
- [x] 2.3 Add product-directory markup for category/status/CTA/capability fields
  while keeping the about site static and content-driven.
- [x] 2.4 Update `src/i18n/ui.ts` CTA/navigation strings that still describe the
  product page as a story.

## 3. Styling

- [x] 3.1 Update `src/styles/site.css` hero copy spacing so multi-paragraph hero
  text reads as intentional body copy on desktop and mobile.
- [x] 3.2 Restyle product entries as a scannable product list/directory rather
  than story sections with feature cards.
- [x] 3.3 Add responsive handling for the product list, including compact mobile
  layout and stable status/category metadata.

## 4. Verification

- [x] 4.1 Update `src/about-static.test.ts` to lock the hero paragraph behavior,
  product-directory structure, and removal of "product story" CTA language.
- [x] 4.2 Run `bun test` in `package/about`.
- [x] 4.3 Run `bun run format:check` or the package-appropriate format check if
  available from `package/about`. Not applicable: `package/about` has no
  `format:check` script.
- [x] 4.4 Optionally run `bun --filter=@rezics/about run dev` and verify
  `/en/product/` and `/zh-hant/product/` manually in the browser. Covered by
  `bun run build`; no browser dev server was started.

## Out of scope

- Creating separate routes for each product.
- Implementing real app workflows inside the static about site.
- Adding new backend APIs, authentication, database access, or shared app
  runtime state to `@rezics/about`.
- Finalizing the long-term commercial/product taxonomy for every future Rezics
  surface.
