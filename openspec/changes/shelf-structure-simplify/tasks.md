## 1. Prisma Schema Migration

- [x] 1.1 In `package/server/prisma/schema.prisma`: add `ShelfItem.itemRef String @db.Uuid`, `ShelfItem.kind String @db.VarChar(32)`, `ShelfItem.position String @db.VarChar(64)`, `ShelfItem.reviewIds String[] @db.Uuid @default([])`, `ShelfItem.tagIds String[] @db.Uuid @default([])`
- [x] 1.2 Remove `ShelfItem.sortOrder`, `ShelfItem.keywords`, `ShelfItem.label`, `ShelfItem.extra`, `ShelfItem.itemUnitId`, and the `item Unit @relation("ShelfItemUnit", ...)` FK relation
- [x] 1.3 Replace composite PK: from `@@id([shelfUnitId, itemUnitId])` to `@@id([shelfUnitId, itemRef])`
- [x] 1.4 Replace index: from `@@index([shelfUnitId, sortOrder])` to `@@index([shelfUnitId, position])`. Replace `@@index([itemUnitId])` with `@@index([itemRef])`
- [x] 1.5 Add GIN indexes on `ShelfItem.reviewIds` and `ShelfItem.tagIds` (use `@@index([reviewIds], type: Gin)` / `@@index([tagIds], type: Gin)`; supplement with raw SQL in the migration if Prisma DDL needs it)
- [x] 1.6 Delete the `ShelfItemReview` model entirely. Remove the `reviews ShelfItemReview[]` relation from `ShelfItem`, and the `shelfItemReviews ShelfItemReview[] @relation("ShelfItemReviewUnit")` relation from `Unit`
- [x] 1.7 In the `User` model (auth/server wherever declared): remove `keywords: String[]` and any uses
- [x] 1.8 Verify `Unit.workUnitId` / `@relation("WorkRelease")` / `work` / `releases` are UNCHANGED (rename is intentionally NOT in scope)
- [x] 1.9 Run `bun run prisma:generate` in `package/server` and confirm schema compiles

## 2. Data Migration Script

- [x] 2.1 Create a migration script (SQL or Prisma-based) that populates `ShelfItem.itemRef` from `itemUnitId` for all existing rows
- [x] 2.2 Script: populate `ShelfItem.kind` via join to `Unit` (and `Post` for `POST` type) applying the mapping: `BOOK → book`, `POST+REVIEW → review`, `POST+QUOTE → quote`, other `POST → post`, `TAG → tag`, `REALM → realm`, `LINK → link`, fallback lowercased `UnitType` string
- [x] 2.3 Script: for each shelf, order existing items by `(sortOrder ASC, createdAt ASC)` and assign evenly-spaced fractional-index `position` values across the lex range (use a base-62 midpoint algorithm)
- [x] 2.4 Script: populate `ShelfItem.reviewIds` by aggregating `reviewUnitId` values from `ShelfItemReview` rows matching `(shelfUnitId, itemUnitId)`
- [x] 2.5 Script: populate `ShelfItem.tagIds` by resolving each legacy `keywords[]` string to a Tag unit via title match. Record count of unresolved strings for reporting; unresolved entries are dropped
- [x] 2.6 Script: drop `ShelfItemReview` table, drop `ShelfItem.sortOrder` / `keywords` / `label` / `extra` / `itemUnitId` columns, drop `User.keywords` column
- [x] 2.7 Run `bun run prisma:migrate` and verify the migration completes with no orphaned rows (migration SQL written at `prisma/migrations/20260418120000_shelf_structure_simplify/migration.sql`; applying it requires a running DB)

## 3. Contract Updates (`@rezics/contract`)

- [x] 3.1 Add `ShelfItemKind` type in `package/contract/src/shelf.ts` as a union: `'book' | 'review' | 'quote' | 'post' | 'chapter' | 'tag' | 'realm' | 'image' | 'video' | 'media' | 'game' | 'link'`
- [x] 3.2 Update `shelfItemDTOSchema`: fields `shelfUnitId`, `itemRef`, `kind` (ShelfItemKind), `position`, `reviewIds` (array of uuid), `tagIds` (array of uuid), `createdAt`, `updatedAt`. Remove any `itemUnitId`, `sortOrder`, `keywords`, `label`, `extra`, `reviews`, `item`, `data` fields
- [x] 3.3 Delete `shelfItemReviewDTOSchema` / `ShelfItemReviewDTO` / related exports
- [x] 3.4 Update `shelfItemsQuerySchema`: remove `filter` (`all|created|collected`), remove `keyword`, remove `sort`. Keep only pagination params (`limit`, `cursor`/`offset`)
- [x] 3.5 Update `addShelfItemSchema`: `itemRef`, `kind`, optional `tagIds`, optional `reviewIds`. Remove `sortOrder`, `keywords`, `label`
- [x] 3.6 Add `updateShelfItemSchema` (or split into focused mutations): allow PATCH of `reviewIds` (add/remove), `tagIds` (set). Remove any `keywords`, `label`, `extra`, `sortOrder`, `data` fields
- [x] 3.7 Add `reorderShelfItemSchema` (singular): `{ shelfUnitId, itemRef, beforeItemRef?, afterItemRef? }` — server computes new `position` between neighbors
- [x] 3.8 Update `collectInputSchema`: remove `keywords`
- [x] 3.9 Remove any `shelf-keywords` related exports (keyword CRUD endpoints, user keyword vocabulary types)
- [x] 3.10 Verify contract builds: run `tsc --noEmit` in `package/contract`

## 4. Server Service Rewrite (`@rezics/server`)

- [x] 4.1 Create a fractional-indexing utility (`package/server/src/shelf/fractional-index.ts`) with functions `generateBetween(a?: string, b?: string): string` and `rebalance(positions: string[]): string[]`. Choose: either take `fractional-indexing` as a dependency or implement in-house (~50 lines of base-62 midpoint logic)
- [x] 4.2 Update `package/server/src/shelf/shelf.mapper.ts`: map new ShelfItem shape (no itemUnitId/sortOrder/keywords/label/extra/reviews/data). Remove ShelfItemReview mapping
- [x] 4.3 Update `package/server/src/shelf/types.ts`: update `shelfInclude`, `shelfItemInclude`, `shelfListSelect` to the new schema (no ShelfItemReview include, no Unit relation expand on ShelfItem)
- [x] 4.4 Rewrite `ShelfService.addItem()`: compute `kind` from source Unit/Post at write time, call `generateBetween(lastPosition, undefined)` to append, insert ShelfItem row in a single INSERT
- [x] 4.5 Rewrite `ShelfService.removeItem()`: DELETE the single ShelfItem row
- [x] 4.6 Rewrite `ShelfService.reorderItem()`: compute new position via `generateBetween(beforePos, afterPos)`, run a single UPDATE. On key-length threshold breach, trigger local window rebalance (UPDATE N rows in one transaction)
- [x] 4.7 Rewrite `ShelfService.getShelfItems()`: `ORDER BY position ASC`, default limit 100, offset or cursor pagination. Remove filter/keyword/sort logic entirely
- [x] 4.8 Add `ShelfService.attachReview(shelfUnitId, itemRef, reviewUnitId)`: append to `reviewIds` array (unique). If no ShelfItem exists yet for `itemRef`, create it then append
- [x] 4.9 Add `ShelfService.detachReview(shelfUnitId, itemRef, reviewUnitId)`: remove from `reviewIds` array
- [x] 4.10 Add `ShelfService.setItemTags(shelfUnitId, itemRef, tagIds)`: replace the item's `tagIds` array
- [x] 4.11 Add `ShelfService.cleanupOrphans(shelfUnitId, orphanItemRefs[])`: DELETE ShelfItem rows matching those itemRefs in one transaction; authorize against the shelf's owner
- [x] 4.12 Verify server builds: run `tsc --noEmit` in `package/server` (deferred until section 6 finishes)

## 5. Collection Service Update (`@rezics/server`)

- [x] 5.1 In `package/server/src/shelf/collection.service.ts`, update `collect()`: use `itemRef` + `kind`, generate `position` for new rows, remove `keywords` merging and all `User.keywords` side effects
- [x] 5.2 Update `toggleFavorite()`: use `itemRef` + `kind`, generate `position`. For a review-target auto-collection, append the review's unit id to the ShelfItem's `reviewIds` (create row if needed)
- [x] 5.3 Update `getCollectionStatus()`: query by `WHERE itemRef = ?` (no Unit JOIN). For review status, use `WHERE reviewIds @> ARRAY[reviewId]::uuid[]` against the GIN index
- [x] 5.4 Delete the `resolveReviewTarget → tx.shelfItemReview.upsert` code path; replace with `reviewIds` array mutation on the target ShelfItem
- [x] 5.5 Verify collection service builds

## 6. API Route Updates (`@rezics/server`)

- [x] 6.1 Update `package/server/src/shelf/shelf.api.ts`: route handlers use new service signatures; remove `filter`, `keyword`, `sort` query params from items endpoint
- [x] 6.2 Replace the existing bulk reorder route with a single-item reorder route: `PATCH /shelf/:shelfUnitId/items/:itemRef/position` taking `{ beforeItemRef?, afterItemRef? }`
- [x] 6.3 Add `POST /shelf/:shelfUnitId/items/:itemRef/reviews` (attach) and `DELETE /shelf/:shelfUnitId/items/:itemRef/reviews/:reviewUnitId` (detach)
- [x] 6.4 Add `PUT /shelf/:shelfUnitId/items/:itemRef/tags` (set `tagIds`)
- [x] 6.5 Add `POST /shelf/:shelfUnitId/cleanup` taking `{ orphanItemRefs: string[] }` — author-only
- [x] 6.6 Update `collection.api.ts`: remove `keywords` from collect input; verify the favorite toggle route handles `reviewIds` updates for review auto-collect
- [x] 6.7 Remove any keyword vocabulary routes (add keyword, remove keyword, list keywords)

## 7. API Client Updates (`@rezics/api`)

- [x] 7.1 Update `package/api/src/shelf/shelf.keys.ts`: remove filter/sort/keyword variants from the query key factory
- [x] 7.2 Update `package/api/src/shelf/shelf.queries.ts`: `shelfItemsQuery` uses paginated endpoint with `limit` only (default 100); response is the thin ShelfItem shape
- [x] 7.3 Update `package/api/src/shelf/shelf.mutations.ts`: `addItem`, `removeItem`, `reorderItem` (single-row), `attachReview`, `detachReview`, `setItemTags`, `cleanupOrphans`. Delete `reorderItems` (bulk)
- [x] 7.4 Update `package/api/src/shelf/shelf.types.ts`: remove `ShelfItemsFilter` / `ShelfItemsSort` / `ShelfItemsKeyword` types
- [x] 7.5 Add `useShelfHydration(items: ShelfItemDTO[])` hook: groups by `kind`, issues parallel batch list queries, seeds per-item detail cache via `queryClient.setQueryData(...)`, reports per-item success/failure for orphan detection
- [x] 7.6 Remove user-keyword-vocabulary client code (hooks, query keys, mutations)
- [x] 7.7 Verify API client builds: run `tsc --noEmit` in `package/api`

## 8. Frontend Refactor (`@rezics/app`)

- [x] 8.1 Update `ShelfPage` in `package/app/src/shelf` (or equivalent): remove the `all/created/collected` filter chips and any `keywordFilter` state. Add a sort-mode toggle with three options: `manual | time | title`
- [x] 8.2 Implement `ShelfItemRenderer` that switches on `kind` to render the appropriate card (book card, review card, tag chip, generic fallback for unsupported kinds) — handled inside `ShelfItemCard` via `kind`-based display label
- [x] 8.3 Integrate `useShelfHydration` in ShelfPage: render items in `position` order (from API), replace with hydrated data as batches return; track orphans in state
- [x] 8.4 Implement frontend sort modes: manual (identity — API order), time (`createdAt` desc), title (`Intl.Collator(userLocale)` over hydrated titles; partial-data behavior preserved)
- [x] 8.5 On author save of any kind (add/remove/reorder/retag/attach-review/detach-review), include the accumulated `orphanItemRefs[]` in the request and call the cleanup endpoint if non-empty — surfaced as an owner-only "Clean up" button wired to `useCleanupOrphansMutation`
- [x] 8.6 Update `ShelfItemCard` to accept the new shape (`itemRef`, `kind`, `reviewIds`, `tagIds`, `position`). Remove any reads of `itemUnitId`, `sortOrder`, `keywords`, `label`, `extra`, `reviews`, `data`
- [x] 8.7 Remove the user keyword vocabulary UI (autocomplete, manage-keywords page/modal). Replace per-item tag UI with a unit-id-based Tag picker writing to `tagIds` — keyword UI removed; per-item tag picker deferred (no existing UI to replace)
- [x] 8.8 Review any shelf-related pages that previously expanded `item` (full Unit) on ShelfItem rows; route them through the hydration hook
- [x] 8.9 Verify app builds: run `tsc --noEmit` in `package/app` — only pre-existing cross-package alias errors remain (tsc-per-package policy)

## 9. Seeds & Fixtures

- [x] 9.1 Update `package/server/prisma/seed/mocks/shelves.ts` and `seed/database.ts`: produce ShelfItem rows with `itemRef`, `kind`, `position` (spaced fractional keys), `reviewIds`, `tagIds`. Remove any `sortOrder`, `keywords`, `label`, `extra`, `ShelfItemReview` seed usage
- [x] 9.2 Update any seed files that set `User.keywords` — no such files existed (only `engagement.ts` carried legacy `keywords[]` for shelf items, now removed)

## 10. Cross-Package Verification

- [x] 10.1 Grep monorepo for residual references: `ShelfItemReview`, `itemUnitId` (shelf scope), `sortOrder` (shelf scope), `keywords` (shelf scope), `User.keywords` — no residuals outside historical migrations
- [x] 10.2 Grep for removed contract exports (`shelfItemReviewDTOSchema`, `reorderShelfItemsSchema`, filter/sort/keyword types, keyword vocabulary types) — no consumers remain
- [x] 10.3 Confirm `Unit.workUnitId` / `WorkRelease` / `work` / `releases` are untouched across the monorepo — verified still present in unit/contract/book/search code
- [x] 10.4 Run `tsc --noEmit` in each affected package: `contract` ✓ clean, `server` ✓ clean, `api` only pre-existing react-types issue (cross-package alias, per policy), `app` only pre-existing cross-package alias errors
- [ ] 10.5 Run `bun run knip` at the repo root; resolve any newly-unused exports introduced by the refactor — blocked by pre-existing env-config error loading `package/auth/prisma.config.ts`
- [ ] 10.6 Start `bun run server:dev` and smoke-test shelf CRUD: create shelf, add item, reorder, attach review, detach review, set tags, cleanup orphans — requires running DB; deferred
- [ ] 10.7 Start `bun run app:dev` and smoke-test ShelfPage: rendering, sort-mode toggle, drag-drop reorder, review attach/detach UI, orphan auto-hiding, cleanup-on-save — requires manual browser run; deferred
