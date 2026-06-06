---
title: Shelf Item Collection Cutover
status: done
created: 2026-06-06
completed: 2026-06-06
supersededBy:
tags: [shelf, collection, search, comment, meili]
---

## Why

Rezics should have one collection primitive: `Shelf`. A shelf is a collection,
and collecting a work, review, comment, or another shelf means creating a
membership row inside a shelf. The current split between `ShelfUnit`,
`ShelfUnitRelation`, and `UserUnitCollection` makes this harder than the product
model requires: the write model is more general than the UI needs, private
collection metadata lives outside the shelf occurrence that owns it, and search
has to stitch together public content hits with private collection hits.

Cut over to a shelf-only collection model with a formal `ShelfItem` occurrence
table and a first-class Meilisearch shelf-item projection. This is not an MVP
or compatibility layer. The proposal is intended to be the future implementation
context: do the clear internal cutover, remove the old collection table/model,
and make search return shelves because matching items inside those shelves were
found.

## Durable constraints & decisions

### Product model

- `(type)` `Shelf` is the only collection/business primitive. Do not keep an
  independent `Collection` or `UserUnitCollection` business table for membership.
- `(type)` A user collection is represented by user-owned shelves, including
  system shelves such as favorites and saved shelves. Saving another user's shelf
  is a `ShelfItem` whose `itemType = "unit"` and `kind = "shelf"`.
- `(comment)` A shelf can contain another shelf, but shelf items of kind
  `"shelf"` render as shelf cards only. Shelf reads must not recursively expand
  shelf contents, so cycles between shelves do not affect serving.
- `(type)` `Shelf` remains a Unit-backed content object (`Unit.type = "SHELF"`),
  but shelf membership is not limited to Units because comments are not Units.

### Shelf item shape

- `(type)` Replace the `ShelfUnit` + `ShelfUnitRelation` graph with a single
  two-level occurrence table such as `ShelfItem`.
- `(type)` `ShelfItem` carries:
  `shelfId`, `itemType`, `itemId`, `kind`, nullable parent item identity
  (`parentItemType`, `parentItemId`), nullable `parentRole`, `position`,
  nullable `variantUnitId`, nullable `searchText`, `createdByUserId`,
  `createdAt`, and `updatedAt`.
- `(type)` `itemType` is a discriminator, initially `unit | comment`.
  `itemType` is required even though UUIDv7 collision risk is negligible; it is
  for hydration, search document shape, permissions, moderation, and debugging.
- `(type)` `kind` is a render/hydration discriminator and must include
  `comment` alongside the existing unit-backed kinds such as `book`, `review`,
  `post`, `shelf`, and `tag`.
- `(test)` A shelf item cannot be its own parent.
- `(test)` A shelf item cannot be deeper than two levels: if a row has a parent,
  it must not itself be used as a parent for another row.
- `(test)` Within one shelf, `(shelfId, itemType, itemId)` is unique. Do not
  support duplicate playlist-style occurrences in this cutover.
- `(type)` Keep both counts on `Shelf`: `rootItemCount` for top-level collection
  rows and `itemCount` for all rows including attached reviews/comments/tags.
- `(comment)` `searchText` belongs to the shelf occurrence. The same item in two
  shelves may have two different private search texts. Do not reintroduce a
  per-user/per-item metadata table unless a future product decision needs global
  aliases outside shelf occurrences.

### Nested rendering

- `(type)` Nesting is one-level attachment under a root item:
  `parentRole = "review" | "comment" | "tag" | "annotation"` as needed by the
  contract. Do not model an arbitrary relation graph.
- `(type)` Shelf list reads page root items first and then fetch children for
  those roots in a bounded batch. Reads must not page all shelf rows and hope the
  parent/child relation happens to be present in the same page.
- `(test)` A search hit on a child item must return enough root context to render
  the root plus the matched child in nested view.

### Comment support

- `(type)` A comment shelf item uses `itemType = "comment"` and
  `itemId = Comment.id`. Do not create Unit rows for comments just to make shelf
  containment work.
- `(type)` Comment shelf-item documents carry comment context needed for display
  and routing: `rootUnitId`, nullable `realmUnitId`, nullable
  `parentCommentId`, author summary, moderation state, and delete/lock state.
- `(test)` Deleted or non-approved comments must not appear in public shelf-item
  search results. Private owner reads may show tombstone/context behavior only
  if the comment API already permits that same visibility.

### Search model

- `(type)` Add a formal Meilisearch `shelf_items` index. It is a read/search
  projection, not a second business model.
- `(type)` A `ShelfItemSearchDocument` carries at least:
  `id`, `shelfId`, `shelfOwnerUserId`, `shelfVisibility`, `shelfStatus`,
  `itemType`, `itemId`, `kind`, `rootItemType`, `rootItemId`,
  nullable parent identity, nullable `parentRole`, `position`, timestamps,
  item display fields, item public searchable text, nullable private
  `searchText`, shelf display fields, and item-specific context fields.
- `(comment)` Searching shelves because an item inside them matches must read the
  `shelf_items` projection and group results by `shelfId`. Do not implement this
  as "search content first, then SQL join back to shelves"; that approach loses
  matches behind top-N limits and cannot rank shelf matches well.
- `(test)` Shelf-internal search filters directly by `shelfId`.
- `(test)` User collection search filters by the set of shelves the user owns or
  has saved, then returns matching item occurrences with shelf context.
- `(test)` Searching for shelves must return a shelf when any contained item
  matches, with matched item previews and match counts grouped under that shelf.
- `(test)` Private `ShelfItem.searchText` is searchable only for the shelf owner
  or another explicitly authorized viewer. Public shelf searches by other users
  search item public text and shelf public metadata only.
- `(comment)` The projection is eventually consistent. Every shelf-item write,
  shelf visibility/status change, source item metadata change, comment
  moderation/delete change, and relevant shelf title change must enqueue a
  shelf-item sync or fanout job.
- `(comment)` Meilisearch supports the intended read shape: filter/sort fields
  must be declared as filterable/sortable attributes; array filters match when
  any element equals the filtered value; `/multi-search` can return grouped
  results and federated search can merge ranked results across indexes.

### Performance

- `(type)` Core DB indexes must support:
  `(shelfId, parentItemType, parentItemId, position)`,
  `(shelfId, position)`, `(itemType, itemId)`, and unique
  `(shelfId, itemType, itemId)`.
- `(test)` Large shelves are served by cursor pagination over root items plus
  bounded child fetches. Tests should cover shelves with thousands of total rows
  and many child attachments without hydrating the whole shelf.
- `(comment)` Fractional indexing remains the ordering strategy for manual
  reorder and cross-page moves. Rebalance stays an implementation detail.

## Research notes

- Meilisearch filtering/sorting requires fields to be configured in index
  settings before filtering or sorting can be used:
  https://www.meilisearch.com/docs/reference/features/filtering
- Meilisearch filter expressions match array attributes when at least one array
  element equals the filtered value:
  https://www.meilisearch.com/docs/learn/filtering_and_sorting/filter_expression_reference
- Meilisearch multi-search is useful for grouped multi-index results, while
  federated search merges results into one ranked list:
  https://www.meilisearch.com/docs/learn/multi_search/multi_search_vs_federated_search
- PostgreSQL full-text search should use GIN indexes for regularly searched
  `tsvector` fields when DB fallback search is needed:
  https://www.postgresql.org/docs/current/textsearch-indexes.html

## 1. Database And Contract Shape

- [x] 1.1 Replace `ShelfUnit` and `ShelfUnitRelation` in
  `package/server/src/db/schema/shelf.ts` with `ShelfItem`, item-type/role
  storage values, root/total counts, and the supporting indexes/constraints.
- [x] 1.2 Generate the server DB migration for the clear cutover. No backward
  compatibility tables, views, triggers, or dual-write bridge are required.
- [x] 1.3 Update `package/server/src/db/relations/shelf-relations.ts` and any
  schema barrel exports so the server imports `ShelfItem` instead of the old
  shelf unit/relation tables.
- [x] 1.4 Replace shelf unit/relation DTOs and input schemas in
  `package/contract/src/shelf/shelf.ts` with shelf item DTOs, item type,
  item kind, parent role, root item count, and item list query/response shapes.
- [x] 1.5 Update contract tests in `package/contract/src/shelf/` for item
  identity, comment item support, one-level nesting, duplicate rejection, and
  root-vs-total count semantics.
- [x] 1.6 Update `package/server/src/shelf/types.ts` and
  `package/server/src/shelf/shelf.mapper.ts` to map `ShelfItem` rows and shelf
  counts into the new DTOs.

## 2. Shelf Write Model

- [x] 2.1 Rewrite `package/server/src/shelf/shelf.service.ts` item helpers around
  `ShelfItem`: ensure item, delete item, attach child, set children, reorder,
  batch ops, count maintenance, and contained-item sync enqueueing.
- [x] 2.2 Replace graph-style relation operations with one-level parent fields.
  Remove attach/detach/set-children code paths that depend on a separate
  relation table.
- [x] 2.3 Keep fractional-index ordering in
  `package/server/src/shelf/fractional-index.ts`, but make service tests cover
  root ordering and child ordering separately.
- [x] 2.4 Rewrite `package/server/src/shelf/collection.service.ts` so collect and
  favorite operations create `ShelfItem` rows in user-owned system shelves.
  Remove `UserUnitCollection` writes.
- [x] 2.5 Replace `package/server/src/shelf/user-unit-collection.service.ts`
  with shelf-item search sync enqueue helpers or delete it if all callers move
  into the shelf-item service.
- [x] 2.6 Update `package/server/src/shelf/system-shelves.ts` so system shelves
  cover favorites and saved shelves without introducing a collection table.
- [x] 2.7 Update `package/server/src/shelf/*.test.ts` for direct item collection,
  review child attachment under a target work, comment item collection, shelf
  item collection, duplicate rejection, self-parent rejection, and count updates.

## 3. API Cutover

- [x] 3.1 Update `package/server/src/shelf/shelf.api.ts` routes and route
  descriptions from `/units` semantics to shelf item semantics while preserving
  the shelf resource boundary.
- [x] 3.2 Update `package/api/src/shelf/shelf.types.ts`,
  `package/api/src/shelf/shelf.api.ts`, `package/api/src/shelf/shelf.keys.ts`,
  `package/api/src/shelf/shelf.queries.ts`, and
  `package/api/src/shelf/shelf.mutations.ts` for shelf item DTOs and operations.
- [x] 3.3 Update collection client helpers under `package/api/src/shelf/` and
  `package/app/src/collection/` so the collection UI calls the shelf-item-backed
  collect/favorite flows.
- [x] 3.4 Remove or rename public exports that expose `ShelfUnit`,
  `ShelfUnitRelation`, or `UserUnitCollection` vocabulary.
- [x] 3.5 Update API-level tests in `package/api/src/shelf/` and
  `package/api/src/user-unit-collection/`; delete the latter package surface if
  it no longer has a domain to own.

## 4. Shelf Item Search Projection

- [x] 4.1 Add `package/contract/src/meili/shelf-item.ts` with
  `ShelfItemSearchDocument`, options, result schemas, and grouped shelf-match
  response shapes.
- [x] 4.2 Add `package/search/src/shelf-item.ts` document-id helpers and builders
  for Unit-backed items and comment-backed items.
- [x] 4.3 Extend `package/search/src/schema.ts` with the `shelf_items` index:
  searchable attributes, filterable attributes, sortable attributes, facetable
  fields, domain label, and full-sync support.
- [x] 4.4 Extend `package/search/src/client.ts` with shelf-item index
  initialization and add/update/patch/delete/deleteAll operations.
- [x] 4.5 Extend `package/search/src/sync.ts` with single item sync, item remove,
  shelf fanout sync, source item fanout sync, comment fanout sync, and segmented
  full sync for shelf items.
- [x] 4.6 Extend `package/job/src/command/search.ts`,
  `package/job-runner/src/handlers/search/handlers.ts`, and Sequin routing so
  shelf-item writes and source metadata changes enqueue the correct projection
  updates.
- [x] 4.7 Replace the current `user_unit_collections` index and
  `collectionSync` commands with shelf-item projection commands. Remove
  `package/search/src/collection.ts` once callers are gone.
- [x] 4.8 Add search tests in `package/search/src/` for document shape, private
  `searchText`, comment context, grouped shelf matches, owner filtering, saved
  shelf filtering, and delete/moderation fanout.

## 5. Search API And Result Semantics

- [x] 5.1 Extend `package/contract/src/search/scope.ts` and
  `package/contract/src/search/federated.ts` only as needed to express shelf
  item search and grouped shelf-match results without overloading content search
  categories.
- [x] 5.2 Update `package/server/src/meili/search/filters.ts` with shelf-item
  filters for `shelfId`, owner/saved-shelf scope, visibility, item type/kind,
  and private `searchText` access.
- [x] 5.3 Update `package/server/src/meili/search/federated.service.ts` so
  searches for shelves can return shelves because contained shelf items matched,
  including matched item previews and match counts.
- [x] 5.4 Add a dedicated shelf-internal search/read path in the shelf service or
  search service that filters `shelf_items` by `shelfId` and returns root context
  for child hits.
- [x] 5.5 Add tests proving public viewers cannot search another user's private
  `searchText`, owners can search their own `searchText`, and saved-shelf
  searches include shelves the user saved as shelf items.

## 6. App Hydration And Rendering

- [x] 6.1 Update `package/api/src/shelf/useShelfHydration.ts` so hydration groups
  by `itemType` and `kind`, hydrating Unit-backed items through existing APIs and
  comment-backed items through the comment API/search document context.
- [x] 6.2 Update `package/app/src/shelf/models/shelfStream.ts` to derive the
  render stream from `ShelfItem` parent fields instead of relation rows.
- [x] 6.3 Update `package/app/src/shelf/components/ShelfItemRenderer.tsx` and
  related shelf components to render comment child items, review child items,
  tag children, shelf cards, and matched-child search context.
- [x] 6.4 Update editor state under `package/app/src/shelf/states/` and
  `package/app/src/shelf/hooks/` for shelf item op logs and one-level parent
  fields.
- [x] 6.5 Update collection UI under `package/app/src/collection/` so saving a
  work, review, comment, or shelf writes shelf items and occurrence-level
  `searchText`.
- [x] 6.6 Update shelf/search stories and tests for nested root+child rendering,
  comment item rendering, shelf-as-item rendering, and grouped shelf search
  matches.

## 7. Cleanup And Verification

- [x] 7.1 Remove `UserUnitCollection` from
  `package/server/src/db/schema/collection.ts` if no other domain owns it after
  the cutover.
- [x] 7.2 Remove stale scripts such as
  `package/server/src/script/backfill-contained-unit-ids.ts` or rewrite them for
  shelf-item projection if still useful.
- [x] 7.3 Update docs and route comments that still describe collection as a
  separate model or `ShelfUnitRelation` as the nesting mechanism.
- [x] 7.4 Run focused server, contract, API, app model, and search tests covering
  shelf item writes, collection flows, nested rendering, comment items, search
  permissions, and projection sync.
- [x] 7.5 Run `bun run check:convention`, `bun run check:tokens`, and targeted
  `bun run format:check`/Biome checks for touched packages.

## Out of scope

- Arbitrary-depth shelf trees or recursive shelf expansion.
- Duplicate occurrences of the same item inside one shelf.
- A separate `Collection` or `UserUnitCollection` business model.
- A compatibility bridge for old shelf unit/relation APIs.
- A global per-user/per-item alias metadata table. Occurrence-level
  `ShelfItem.searchText` is the cutover model.
- Real-time search consistency. Shelf-item search projection is eventually
  consistent through jobs and fanout sync.
