---
title: Shelf UX pagination and bookshelf mode
status: completed
created: 2026-06-17
completed: 2026-06-17
supersededBy:
tags: [shelf, factory, pagination, ux, bookshelf]
---

## Why

Shelf currently has several related faults rather than one isolated bug. The
`complex-shelf` factory scenario does not exercise the actual shelf model: it
creates a shallow linear chain, writes parent roles outside the contract, and
does not produce enough valid nested variety to expose rendering and pagination
failures. At runtime, shelf item pagination mixes root page rows with child rows
but uses the last returned row as the next cursor, so a child item can become the
page boundary. The detail page and editor then apply local numbered pagination
over a partially loaded derived stream, making nested shelves especially prone
to missing, duplicated, or apparently empty pages.

The intended outcome is a shelf surface where factory data can reliably expose
real bugs, shelf item pagination has a root-safe contract, nested/edit views
show child presence consistently, and `bookshelf` becomes a formal view mode
instead of a half-integrated branch. Traditional Chinese UI copy should use
`書架` for the bookshelf view.

## Durable constraints & decisions

- `(type)` Shelf item parent roles remain the contract-defined set:
  `review | variant | comment | tag | annotation`. Factory scenarios must not
  invent display-only roles such as `sequel` or `related` unless the contract
  is intentionally expanded.
- `(test)` Shelf item pagination must advance by the last root row in the
  server page, never by a child row appended for hydration/rendering context.
- `(test)` A page of shelf items may include child rows for the visible roots,
  but `hasMore` and the next cursor are determined only by the root query.
- `(type)` `ShelfItemsResponse` should carry an explicit root-safe next cursor
  rather than requiring API consumers to infer one from `items.at(-1)`.
- `(test)` Nested rendering must make every root with children visibly
  distinguishable in both read and edit modes, even when the children are not
  reviews.
- `(comment)` Nested shelf display is one level deep by design. Multi-step
  graph relationships must not recurse through the UI; deeper relationships
  remain data, not nested DOM.
- `(test)` Editor item pagination must not use `Shelf.itemCount` as if it were
  the number of rendered root rows in nested mode.
- `(type)` `bookshelf` is a real `ShelfView`, not a legacy alias. Persisted
  `extra.viewMode: "bookshelf"` must round-trip through page and editor
  normalization.
- `(test)` Bookshelf view must not silently disappear valid library rows because
  the hydration layer lacks support for `game` or `media`.
- `(comment)` Bookshelf view is a cover-grid presentation for library kinds
  only. Non-library shelf items should have a deliberate fallback or a clear
  filtered-count affordance; they should not vanish without explanation.
- `(test)` Frontend copy for the bookshelf view must go through i18n, with
  Traditional Chinese using `書架`.

## Tasks

## 1. Factory scenario validity and coverage

- [x] 1.1 Update `package/server/src/db/factory/scenarios.ts` so
      `runComplexShelf` emits only contract-valid `parentRole` values.
- [x] 1.2 Replace the current linear chain with a deterministic fixture shape:
      multiple roots, review children, variant children, tag/comment/annotation
      children where hydration supports them, shared child coverage, and enough
      root rows to force more than one server page.
- [x] 1.3 Keep mixed shelf item kinds, but only include kinds the shelf surface
      can hydrate or intentionally fallback-render.
- [x] 1.4 Add or extend `package/server/src/db/factory/scenarios.test.ts` to
      assert `complex-shelf` uses valid roles, has multiple roots, has children
      under several roles, and has pagination volume.
- [x] 1.5 Ensure the scenario still registers a special target labeled
      `Complex shelf` for factory handoff.

## 2. Root-safe shelf item pagination

- [x] 2.1 Extend `package/contract/src/shelf/shelf.ts`
      `shelfItemsResponseSchema` with an explicit optional `nextCursor` based on
      the last root item in the returned page.
- [x] 2.2 Update `package/server/src/shelf/shelf.service.ts`
      `getShelfItems` so the root query selects `limit + 1`, slices visible
      roots, derives `hasMore`, and returns `nextCursor` from the last visible
      root.
- [x] 2.3 Make the cursor predicate resolve only root rows. If a stale or child
      cursor is supplied, fail safely rather than using a child position as the
      root boundary.
- [x] 2.4 Keep child row loading scoped to the visible root item identities,
      preserving relation DTOs for the visible page.
- [x] 2.5 Update `package/api/src/shelf/shelf.queries.ts` so
      `shelfItemsInfiniteQuery` uses `lastPage.nextCursor` and never infers from
      `lastPage.items.at(-1)`.
- [x] 2.6 Add server tests in `package/server/src/shelf/shelf.service.test.ts`
      for root cursor behavior when child rows sort after the roots.
- [x] 2.7 Add API query tests or focused contract tests covering
      `nextCursor`/`hasMore` shape. Because this is a development-stage
      cutover, pages without `nextCursor` are rejected instead of kept
      compatible.

## 3. Detail and editor pagination semantics

- [x] 3.1 Update `package/app/src/shelf/pages/ShelfPage.tsx` so local numbered
      pages are computed from renderable root/stream pages, not blindly from
      `shelf.itemCount`.
- [x] 3.2 Ensure `ShelfPage` requests more server pages until the selected local
      page has enough renderable entries, and stops cleanly when `hasNextPage`
      is false.
- [x] 3.3 Reset shelf detail pagination on search, readable filter, sort mode,
      and view mode changes without duplicate effects.
- [x] 3.4 Update `package/app/src/shelf/sections/ShelfEditorItemsSection.tsx`
      with the same root/rendered-stream pagination rule.
- [x] 3.5 Revisit `useShelfItemsEditor` background loading in
      `package/app/src/shelf/hooks/useShelfItemsEditor.ts`; either keep eager
      loading with a comment tied to the new cursor contract, or replace it with
      explicit page loading that cannot stall on child cursors.
- [x] 3.6 Add tests around `deriveShelfStream` or new pagination helpers so
      nested roots with children do not inflate visible page count.

## 4. Nested child visibility and edit UX

- [x] 4.1 Replace `attachmentCountsForEntry` in
      `package/app/src/shelf/components/ShelfItemRenderer.tsx` with a role-aware
      summary that counts all supported child roles, not only review/tag.
- [x] 4.2 Make read-mode nested roots expose child presence even when the child
      is `variant`, `comment`, `annotation`, or another supported non-review
      role.
- [x] 4.3 Update nested tabs or grouped child sections so labels are i18n-backed
      and role-specific instead of defaulting every non-variant child to review.
- [x] 4.4 Update edit-mode `UnitCard` summaries or row chrome so a root with any
      child relation visibly shows that fact.
- [x] 4.5 Add focused tests for `ShelfItemRenderer`/summary helpers or
      `UnitCard` summary mapping so non-review children are represented.
- [x] 4.6 Audit `canReorderShelfStreamEntry` behavior for nested mode; keep
      root-only reorder if deliberate, but make child relation editing
      discoverable elsewhere.

## 5. Formal bookshelf view mode

- [x] 5.1 Add `bookshelf` to persisted view-mode normalization in
      `package/app/src/shelf/pages/ShelfPage.tsx` and
      `package/app/src/shelf/pages/ShelfEditPage.tsx`.
- [x] 5.2 Add `bookshelf` to the read-page and default-view picker options,
      using i18n keys rather than hard-coded labels.
- [x] 5.3 Add locale keys under `package/i18n/locales/*/entity.json`,
      including Traditional Chinese `shelf_view_bookshelf: "書架"`.
- [x] 5.4 Decide and implement the bookshelf data policy in
      `package/api/src/shelf/useShelfHydration.ts`: either hydrate `game` and
      `media`, or intentionally restrict bookshelf to books with visible
      filtered-count feedback.
- [x] 5.5 Prefer the existing `package/app/src/bookshelf-view` grid behavior for
      formal bookshelf rendering where it fits; avoid a second incompatible
      cover-grid implementation.
- [x] 5.6 Update `ShelfItemRenderer` bookshelf links so library kinds route to
      the correct detail page, not always `/book/:id`.
- [x] 5.7 Add tests for view-mode normalization and bookshelf rendering/fallback
      behavior.

## 6. Shelf UX consistency checks

- [x] 6.1 Review shelf list, shelf search, shelf-by-book, profile shelf-content
      search, and add-to-shelf dialog pagination patterns for consistency after
      the root-safe cursor change.
- [x] 6.2 For profile shelf-content search, either add an explicit load-more
      action or document why the current “more exists” notice is intentionally
      non-actionable.
- [x] 6.3 Ensure all touched frontend display strings go through
      `@rezics/i18n`; do not add hard-coded product copy in React components.
- [x] 6.4 Add or update TSDoc layout notes only for visual components whose
      layout materially changes.
- [x] 6.5 Run focused tests for contract, server shelf service, API shelf
      queries, shelf models/components, and i18n validation.

## Out of scope

- Replacing the full shelf information architecture or inventing a new shelf
  taxonomy beyond the current parent-role model.
- Adding arbitrary custom shelf slugs.
- Changing database schema unless the root-safe cursor work proves the response
  contract alone is insufficient.
- Running browser automation for layout verification unless implementation work
  later changes rendered layout enough to require it.
