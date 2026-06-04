---
title: About/Product Site Restructure
status: done
created: 2026-06-04
completed: 2026-06-04
supersededBy:
tags: [about, product, astro, content, design]
---

## Why

The public about site currently explains Rezics as a cross-language catalog, but
the Home and Product pages share the same generic page shape and the same
decorative constellation graphic. That makes the first screen read like feature
copy instead of a public invitation, and it leaves the Product page without a
clear product catalog structure.

The restructure should split the two jobs. Home should lead with the Rezics
premise from `README.md`: inherited, created, and spread knowledge, followed by
the problem Rezics exists to solve. Product should explain Rezics as the first
product, then break down its product surfaces: catalog, work identity, reviews,
shelves, tags, wiki knowledge, and Realm communities.

## Durable constraints & decisions

- (comment) Home first screen is an invitation, not a feature inventory. The
  headline should be `inherited · create · spread`, and the body should preserve
  the README premise that knowledge and creativity are inherited, remixed, and
  passed forward.
- (test) Home pages must remain wired to Product as the primary CTA, but the
  hero copy should no longer duplicate Product-page information architecture.
- (type) The about content frontmatter should support page-specific narrative
  sections beyond the current two-card `sections` array when the page needs
  ordered story blocks, product cards, or diagram copy.
- (comment) The right-side hero visual must be an information architecture
  diagram, not a manually positioned decorative cluster. Use a dedicated graph
  layout/rendering tool so node relationships are explicit and maintainable.
- (test) The hero diagram must visibly include Library/Catalog, Review, Shelf,
  Wiki, and Realm, with Work/Unit as the shared anchor.
- (comment) The diagram must represent the real Rezics model: Realm is a
  community space, `UnitRealm` is community/feed membership, and
  `RealmTagApplication` is realm-scoped application of an existing global Tag to
  a target Unit. Do not present Realm as a tag or as ownership of every tagged
  work.
- (comment) Wiki copy should describe collaborative knowledge beside works and
  realm wiki portals. It should not imply Rezics is only a standalone wiki site.
- (test) Home narrative must include the missing first problem statement:
  born-digital books and web novels are too abundant and cross-platform for old
  catalogs, and lower creation costs will make the same indexing problem apply
  across media types.
- (comment) Product is a product page. It should present Rezics as the first
  product and leave room for future products instead of restating why the static
  about site is separate from the app.
- (test) Copy and layout should remain localized across all supported about
  locales: `zh-hant`, `zh-hans`, `en`, `ja`, `de`, and `ko`.
- (comment) Load `rezics-design` before applying JSX/Astro/CSS changes, because
  this work changes visual structure, typography, component choice, and copy.

## 1. Content Model And Page Structure

- [x] 1.1 Update `package/about/src/content.config.ts` and
  `package/about/src/content/types.ts` so page frontmatter can represent Home
  story blocks, Product product cards, and diagram metadata without overloading
  the existing two-card `sections` shape.
- [x] 1.2 Refactor `package/about/src/layouts/AboutLayout.astro` to render
  Home and Product with page-specific sections while preserving shared header,
  footer, locale links, SEO metadata, and CTA behavior.
- [x] 1.3 Keep the current static Astro deployment boundary documented in
  `package/about/README.md`; do not add app runtime, auth, database, or shared
  state dependencies to the about site.

## 2. Relationship Diagram

- [x] 2.1 Add a graph-rendered hero diagram component to replace or supersede
  `package/about/src/components/CatalogConstellation.astro`.
- [x] 2.2 Choose and add a static-build graph rendering dependency or local
  rendering path, with Graphviz DOT / Viz.js preferred unless a lighter existing
  repo pattern appears during implementation.
- [x] 2.3 Encode the diagram source as data or DOT, including Work/Unit,
  Library/Catalog, Review, Shelf, Wiki, Realm, Tag, and Realm-scoped
  classification nodes.
- [x] 2.4 Style the rendered diagram in `package/about/src/styles/site.css` so it
  reads as a precise relationship diagram on desktop and remains legible on
  mobile.
- [x] 2.5 Add a source comment near the graph definition explaining why Realm,
  UnitRealm, and RealmTagApplication are distinct, matching the Prisma model
  comments in `package/server/prisma/schema.prisma`.

## 3. Home Page Narrative

- [x] 3.1 Rewrite `package/about/src/content/en/index.mdx` so the hero uses the
  README-derived invitation: `inherited · create · spread` plus the exact Rezics
  premise body.
- [x] 3.2 Add the first below-hero story block about web novels and born-digital
  books overwhelming old platform/catalog boundaries.
- [x] 3.3 Add follow-up Home story blocks for cross-platform/cross-language work
  identity, tag-shelf discovery, creator/readership matching, Realm community
  co-location, and collaborative wiki knowledge.
- [x] 3.4 Keep Home concise: it should cover the mission and problem space
  broadly, while leaving detailed product mechanics to Product.

## 4. Product Page Narrative

- [x] 4.1 Rewrite `package/about/src/content/en/product.mdx` as a product page
  with Rezics as the first product.
- [x] 4.2 Add product sections for Catalog/Library, Work Unit identity,
  cross-language metadata, review surfaces, shelves, tag and realm-scoped
  classification, Realm communities, and wiki knowledge.
- [x] 4.3 Remove or demote copy that primarily explains the about site/static
  site boundary; keep only what is useful for setting expectations about where
  interactive workflows happen.
- [x] 4.4 Leave structural room for future product entries without implying they
  already exist.

## 5. Localization

- [x] 5.1 Update all localized Home MDX files under
  `package/about/src/content/*/index.mdx` with equivalent mission/problem
  narrative.
- [x] 5.2 Update all localized Product MDX files under
  `package/about/src/content/*/product.mdx` with equivalent product-page
  structure.
- [x] 5.3 Update `package/about/src/i18n/ui.ts` only for shared CTA/navigation
  copy that no longer matches the new Home/Product split.
- [x] 5.4 Keep locale route generation and canonical URL behavior unchanged.

## 6. Tests And Verification

- [x] 6.1 Update `package/about/src/about-static.test.ts` so it checks the new
  required Home/Product content contract, including Product CTA wiring and
  localized source presence.
- [x] 6.2 Add a static test or component-level assertion that the graph diagram
  contains the required relationship nodes.
- [x] 6.3 Run `bun --filter=@rezics/about run test`.
- [x] 6.4 Run `bun --filter=@rezics/about run build`.
- [x] 6.5 Run `bun run check:convention`.
- [x] 6.6 Run `bun run check:tokens` if CSS token usage changes.

## Out of scope

- Implementing live app functionality in `package/about`.
- Changing `@rezics/app`, server APIs, database schemas, or product behavior.
- Creating a standalone spec corpus for the public site.
- Rewriting the root `README.md` unless implementation discovers a direct
  inconsistency with the new about copy.
- Adding browser automation for this public site unless explicitly requested;
  provide exact local URLs after `bun --filter=@rezics/about run dev` for manual
  visual review.
