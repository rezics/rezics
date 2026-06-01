---
title: Variant Context and Progress Dashboard
status: active
created: 2026-06-01
completed:
supersededBy:
tags: [catalog, post, shelf, progress, dashboard, app]
---

## Why

Catalog VARIANT Units are exact editions/source/package records whose normal
social interactions resolve to the MAIN catalog target. Users still need the UI
to remember and display which VARIANT they selected when writing a review,
adding a shelf item, or browsing a VARIANT page. That context should be
queryable without turning VARIANT into the aggregation target.

Progress also needs a first-class surface. Progress can address exact VARIANTs
directly, but dashboard/library rendering should not depend on shelf
aggregation. The dashboard should read progress through progress-owned APIs,
while reusing the same shelf/bookshelf card language so progress-based and
shelf-based flows feel continuous.

## Durable constraints & decisions

- `(type)` `variantUnitId` is a weak context field on interaction rows such as
  `Post` and `ShelfUnit`. It is indexed for lookup, but it is not the primary
  aggregation target and is not `Unit.targetUnitId`.
- `(type)` Do not add `variantKind` in this change. Variant UI labels use the
  selected VARIANT Unit title only.
- `(comment)` Normal interactions keep targeting the resolved MAIN catalog
  target. `variantUnitId` records the selected edition/source/package context.
- `(test)` Post list by `targetUnitId` returns MAIN-targeted posts regardless of
  whether they have variant context; post list by `variantUnitId` returns only
  posts that mention that exact VARIANT context.
- `(test)` Shelf search by `containsUnitId` continues to mean the primary shelf
  item Unit. A separate `variantUnitId` filter finds shelf rows that mention an
  exact VARIANT context.
- `(test)` Backend writes do not validate that `variantUnitId` points at an
  existing VARIANT or that it resolves to the primary target. The field is a weak
  context index; readers hydrate titles best-effort and fall back cleanly.
- `(type)` Progress and rating are the only interaction-like domains allowed to
  address VARIANT directly as their primary `unitId`.
- `(comment)` Dashboard progress rendering must use progress-owned data, not
  shelf membership as the source of truth. It may reuse shelf/bookshelf UI
  components and mapping helpers.
- `(comment)` Progress shelves remain useful as shareable, user-curated
  projections of progress state. They are not the source of truth, but progress
  pages should link into shelf-based sharing and organization where available.
- `(test)` Dashboard library/progress sections render from progress API results
  without requiring a matching `ShelfUnit`, while shelf pages still render their
  own shelf membership and optional `ShelfUnit.variantUnitId` context.

## Tasks

## 1. Variant Context Schema and Contracts

- [x] 1.1 Add nullable scalar `variantUnitId` with a plain index to `Post` in
  `package/server/prisma/schema.prisma`; do not add a relation or validation
  constraint.
- [x] 1.2 Add nullable scalar `variantUnitId` with a plain index to `ShelfUnit`
  in `package/server/prisma/schema.prisma`; keep `(shelfId, unitId)` as the row
  identity.
- [x] 1.3 Add a migration under `package/server/prisma/migrations/` for the two
  columns and indexes.
- [x] 1.4 Extend `PostDTO`, `CreatePostInput`, `PostListQuery`, and
  `PostListBody` in `package/contract/src/post/post.ts` with optional
  `variantUnitId`.
- [x] 1.5 Extend `ShelfUnitDTO`, `AddShelfUnitInput`, `ShelfUnitsQuery`, and
  shelf list/search contracts in `package/contract/src/shelf/shelf.ts` with
  optional `variantUnitId`.
- [x] 1.6 Add contract tests that accept `variantUnitId` and keep it separate
  from `targetUnitId` / `containsUnitId`.

## 2. Post Variant Context

- [x] 2.1 Persist `CreatePostInput.variantUnitId` on the `Post` row in
  `package/server/src/post/post.service.ts` while continuing to persist
  `targetUnitId` on the owning `Unit`.
- [x] 2.2 Project `Post.variantUnitId` in
  `package/server/src/post/post.mapper.ts`.
- [x] 2.3 Add exact `variantUnitId` filtering to `PostService.list` and the
  POST/GET list APIs in `package/server/src/post/post.api.ts`.
- [x] 2.4 Update `package/api/src/post/` API, keys, and query helpers so callers
  can request either `targetUnitId` aggregation or `variantUnitId` context.
- [x] 2.5 Add post service tests covering MAIN aggregation lookup,
  VARIANT-context lookup, and the no-validation behavior for arbitrary
  `variantUnitId` values.

## 3. Shelf Variant Context

- [x] 3.1 Persist `AddShelfUnitInput.variantUnitId` and batch add operation
  variant context in `package/server/src/shelf/shelf.service.ts`.
- [x] 3.2 Project `ShelfUnit.variantUnitId` in
  `package/server/src/shelf/shelf.mapper.ts`.
- [x] 3.3 Add shelf listing/search filters for `variantUnitId` alongside the
  existing primary `containsUnitId` behavior.
- [x] 3.4 Update `package/api/src/shelf/` types, API functions, keys, and
  hydration helpers to carry `variantUnitId`.
- [x] 3.5 Add shelf service tests proving `containsUnitId` and `variantUnitId`
  are separate filters and that variant context is not validated.

## 4. Variant Title Hydration and Card Rendering

- [x] 4.1 Add a small shared variant context summary shape in
  `@rezics/contract` or the relevant app model: `{ unitId, title }`, derived
  from the VARIANT Unit title when available.
- [x] 4.2 Batch-load variant titles for post and shelf list reads where the API
  already hydrates card data; missing titles must not fail the request.
- [x] 4.3 Extend `UnitCardSummary` in
  `package/app/src/unit/models/unitCardSummary.ts` with optional
  `variantContext`.
- [x] 4.4 Update `UnitCard` in `package/app/src/unit/components/UnitCard.tsx`
  to render the MAIN card as primary and a single linked variant row using the
  title only.
- [x] 4.5 Update `ReviewCard`, `PostCard`, `ExcerptCard`, and shelf item
  renderers to pass and display variant context without rendering a separate
  VARIANT card as the primary object.
- [x] 4.6 Add Storybook/test coverage for cards with no variant context, valid
  variant title, and missing-title fallback.

## 5. MAIN and VARIANT Page Query Behavior

- [ ] 5.1 Update MAIN catalog pages to continue querying posts/reviews/shelves by
  primary `targetUnitId` / `containsUnitId`, rendering variant rows when present.
- [ ] 5.2 Add or update VARIANT page sections to query posts/reviews/shelves by
  `variantUnitId` for "this edition/source" content.
- [ ] 5.3 If a VARIANT page also shows MAIN-wide discussion, keep it as a
  separate section or tab that queries the VARIANT's `targetUnitId`; do not make
  `targetUnitId = variantUnitId` a normal feed path.
- [ ] 5.4 Update app route/query helpers around book/review/shelf pages so the
  selected VARIANT can be submitted as `variantUnitId` while primary writes use
  the resolved MAIN target.

## 6. Progress-Owned API and Page

- [ ] 6.1 Add progress contract DTOs in
  `package/contract/src/shelf/progress.ts` for a hydrated progress library row:
  progress fields plus the target Unit title/cover/kind and optional resume
  route.
- [ ] 6.2 Extend `package/server/src/progress/progress.service.ts` with a
  hydrated list method for progress library/page reads, reusing current
  pagination where practical.
- [ ] 6.3 Expose the hydrated progress list through
  `package/server/src/progress/progress.api.ts` and
  `package/api/src/progress/` query helpers.
- [ ] 6.4 Build a progress page under `package/app/src/progress` or the existing
  progress feature location that renders progress rows with the shared
  bookshelf/shelf card language.
- [ ] 6.5 Keep progress source-of-truth in `UserUnitProgress`; do not require a
  `ShelfUnit` to display progress.
- [ ] 6.6 Preserve the option for progress rows to target VARIANT Units directly,
  and show the VARIANT title as the primary progress item when that is the saved
  progress unit.
- [ ] 6.7 Keep progress shelf flows available as shareable/user-curated
  projections, with links between the progress page and matching shelf pages
  where those shelves exist.

## 7. Dashboard Cutover

- [ ] 7.1 Update `package/server/src/dashboard/dashboard.service.ts` so dashboard
  continue-reading/library data comes from progress-owned reads rather than
  client-side shelf aggregation.
- [ ] 7.2 Update `package/contract/src/dashboard/dashboard.ts` if dashboard needs
  a richer progress/library section payload than current `ContinueReadingItem`.
- [ ] 7.3 Update `package/app/src/dashboard/sections/DashboardLibrarySection.tsx`
  and `DashboardLibraryShelfBlock.tsx` to consume the new progress API payload
  while reusing bookshelf grid/card components.
- [ ] 7.4 Keep shelf-based dashboard/shelf blocks available for actual shelf
  summaries; progress display should no longer depend on fetching every user
  shelf and intersecting shelf items with progress.
- [ ] 7.5 Add dashboard model/component tests showing progress rows render when
  no shelf membership exists and that shelf-based functionality still links into
  normal shelf pages.

## 8. Search and Indexing

- [x] 8.1 Add `variantUnitId` to post search documents and filters where post
  search supports exact target/context filtering.
- [ ] 8.2 Decide whether shelf search needs a search-index projection or only
  PostgreSQL filtering; implement the smaller path unless UI requirements need
  search-index support.
- [x] 8.3 Add search/job-runner tests that preserve MAIN aggregation defaults and
  support exact VARIANT context filtering.

## Out of scope

- No `variantKind` taxonomy or edition-difference labeling beyond the VARIANT
  title.
- No backend validation that `variantUnitId` exists, is a VARIANT, or resolves to
  the primary target.
- No change to the rule that normal post/shelf interactions aggregate on MAIN.
- No migration that backfills historical variant context; existing rows remain
  context-less unless a later import can infer it.
