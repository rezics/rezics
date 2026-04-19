## 1. Prisma Schema Migration

- [x] 1.1 In `package/server/prisma/schema.prisma`: slim `ShelfItem` to exactly these columns — `shelfUnitId String @db.Uuid`, `itemRef String @db.Uuid`, `kind String @db.VarChar(32)`, `position String @db.VarChar(64)`, `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`. Keep the `shelf Shelf @relation(...)` on `shelfUnitId`. Add `shelfUnits ShelfUnit[]` back-reference.
- [x] 1.2 Remove from `ShelfItem`: `sortOrder`, `keywords`, `label`, `extra`, `itemUnitId`, the `item Unit @relation(...)` FK relation, `reviewIds: String[]`, `tagIds: String[]`, and the `reviews ShelfItemReview[]` back-reference.
- [x] 1.3 On `ShelfItem`, declare exactly one index: `@@index([shelfUnitId, position])`. Remove `@@index([itemRef])`, `@@index([reviewIds], type: Gin)`, `@@index([tagIds], type: Gin)` if present.
- [x] 1.4 Set `ShelfItem` composite primary key to `@@id([shelfUnitId, itemRef])` (replacing the old `@@id([shelfUnitId, itemUnitId])`).
- [x] 1.5 Add the new `ShelfUnit` model with columns `shelfUnitId String @db.Uuid`, `itemRef String @db.Uuid`, `unitId String @db.Uuid`, `role String @db.VarChar(32)`.
- [x] 1.6 On `ShelfUnit`, declare three relations (all with `onDelete: Cascade`): `shelf Shelf @relation(fields: [shelfUnitId], references: [unitId])`; `slot ShelfItem @relation(fields: [shelfUnitId, itemRef], references: [shelfUnitId, itemRef])`; `unit Unit @relation(fields: [unitId], references: [id])`.
- [x] 1.7 On `ShelfUnit`, declare PK `@@id([shelfUnitId, itemRef, unitId, role])` and indexes `@@index([unitId])`, `@@index([unitId, role])`, `@@index([shelfUnitId, role])`.
- [x] 1.8 On `Shelf`: add back-reference `shelfUnits ShelfUnit[]`. Keep the existing `items ShelfItem[]` relation.
- [x] 1.9 On `Unit`: add back-reference `shelfUnits ShelfUnit[]`. Remove the old `shelfItemReviews ShelfItemReview[] @relation("ShelfItemReviewUnit")` relation. Keep `workUnitId` / `@relation("WorkRelease")` / `work` / `releases` untouched.
- [x] 1.10 Delete the `ShelfItemReview` model entirely from the schema.
- [x] 1.11 In the `User` model (auth/server wherever declared): remove `keywords: String[]` and any uses.
- [x] 1.12 Run `bun run prisma:generate` in `package/server` and confirm the schema compiles with the new relation graph.

## 2. Data Migration Script

- [x] 2.1 Create or update the migration SQL at `package/server/prisma/migrations/20260418120000_shelf_structure_simplify/migration.sql` to perform the operations below in a single transaction per step group.
- [x] 2.2 Add new columns to `ShelfItem`: `itemRef`, `kind`, `position`. Leave as nullable only during backfill; enforce NOT NULL after backfill completes.
- [x] 2.3 Create the `ShelfUnit` table with its composite PK and all three indexes.
- [x] 2.4 Backfill `ShelfItem.itemRef`: `UPDATE "ShelfItem" SET "itemRef" = "itemUnitId"`.
- [x] 2.5 Backfill `ShelfItem.kind`: JOIN to `Unit` (and `Post` where `Unit.type = POST`) to compute per row. Apply the mapping: `BOOK → book`, `POST+REVIEW → review`, `POST+QUOTE → quote`, other `POST → post`, `TAG → tag`, `REALM → realm`, `LINK → link`, fallback lowercased `UnitType` string.
- [x] 2.6 Backfill `ShelfItem.position`: for each shelf, order existing items by `(sortOrder ASC, createdAt ASC)` and assign evenly-spaced fractional-index values across the lex range using a base-62 midpoint algorithm (referenced by the fractional-indexing utility from task 4.1).
- [x] 2.7 Backfill `ShelfUnit` primary rows: for each `ShelfItem`, insert `(shelfUnitId, itemRef, unitId = itemRef, role = 'primary')`.
- [x] 2.8 Backfill `ShelfUnit` review rows: for each `ShelfItemReview(shelfUnitId, itemUnitId, reviewUnitId)`, insert `(shelfUnitId, itemRef = itemUnitId, unitId = reviewUnitId, role = 'review')`.
- [x] 2.9 Backfill `ShelfUnit` tag rows: for each non-empty `ShelfItem.keywords` value, resolve each keyword string against Tag unit titles. Resolved entries become `(shelfUnitId, itemRef = itemUnitId, unitId = resolvedTagId, role = 'tag')` rows. Record a count of unresolved strings for reporting; unresolved entries are dropped.
- [x] 2.10 Drop columns and relations: `ShelfItem.sortOrder`, `ShelfItem.keywords`, `ShelfItem.label`, `ShelfItem.extra`, `ShelfItem.itemUnitId`, the FK from `ShelfItem` to `Unit`, the `shelfItemReviews` relation on `Unit`, the `ShelfItemReview` table, `User.keywords`.
- [x] 2.11 Recreate constraints and indexes on `ShelfItem`: new PK `@@id([shelfUnitId, itemRef])`, sole index `@@index([shelfUnitId, position])`.
- [ ] 2.12 Run `bun run prisma:migrate` against a dev DB and verify: row counts match pre- and post-migration where expected; unresolved-keywords count logged; orphan scan (slots whose `itemRef` has no matching `Unit`) produces a report.

## 3. Contract Updates (`@rezics/contract`)

- [x] 3.1 Add `ShelfItemKind` type in `package/contract/src/shelf.ts` as a union: `'book' | 'review' | 'quote' | 'post' | 'chapter' | 'tag' | 'realm' | 'image' | 'video' | 'media' | 'game' | 'link'`.
- [x] 3.2 Add `ShelfUnitRole` type as a union: `'primary' | 'review' | 'tag'`. Export for consumers.
- [x] 3.3 Add `shelfUnitDTOSchema` with fields `shelfUnitId`, `itemRef`, `unitId`, `role` (uses `ShelfUnitRole`).
- [x] 3.4 Update `shelfItemDTOSchema` to: `shelfUnitId`, `itemRef`, `kind` (`ShelfItemKind`), `position`, `reviewIds: string[]`, `tagIds: string[]`, `createdAt`, `updatedAt`. The `reviewIds` / `tagIds` arrays are the server-projected read shape; backend derives them from `ShelfUnit`. Remove any `itemUnitId`, `sortOrder`, `keywords`, `label`, `extra`, `reviews`, `item`, `data` fields.
- [x] 3.5 Delete `shelfItemReviewDTOSchema` / `ShelfItemReviewDTO` / related exports.
- [x] 3.6 Update `shelfItemsQuerySchema`: remove `filter` (`all|created|collected`), remove `keyword`, remove `sort`. Keep only pagination params (`limit`, `cursor`/`offset`).
- [x] 3.7 Update `addShelfItemSchema`: `itemRef`, `kind`, optional `tagIds: string[]`, optional `reviewIds: string[]`. Remove `sortOrder`, `keywords`, `label`.
- [x] 3.8 Add / update mutation schemas: `attachReviewSchema` `{ shelfUnitId, itemRef, reviewUnitId }`; `detachReviewSchema` same; `setItemTagsSchema` `{ shelfUnitId, itemRef, tagIds: string[] }`; `reorderShelfItemSchema` (singular) `{ shelfUnitId, itemRef, beforeItemRef?, afterItemRef? }`. Remove any bulk `reorderShelfItemsSchema`.
- [x] 3.9 Update `collectInputSchema`: remove `keywords`.
- [x] 3.10 Remove any `shelf-keywords` related exports (keyword CRUD endpoints, user keyword vocabulary types).
- [x] 3.11 Verify contract builds: run `tsc --noEmit` in `package/contract`.

## 4. Server Service Rewrite (`@rezics/server`)

- [x] 4.1 Create a fractional-indexing utility at `package/server/src/shelf/fractional-index.ts` exporting `generateBetween(a?: string, b?: string): string` and `rebalance(positions: string[]): string[]`. Choose: take `fractional-indexing` as a dependency or implement in-house (~50 lines of base-62 midpoint logic).
- [x] 4.2 Update `package/server/src/shelf/shelf.mapper.ts`: map the slim `ShelfItem` shape. Add a projection helper that, given a page of slots, fetches matching `ShelfUnit` rows in one query (`WHERE shelfUnitId = S AND itemRef IN (...)`) and groups by `(itemRef, role)` into `reviewIds: string[]` / `tagIds: string[]` per slot.
- [x] 4.3 Update `package/server/src/shelf/types.ts`: update `shelfInclude`, `shelfItemInclude`, `shelfListSelect` to the new schema. Remove `ShelfItemReview` include, remove `Unit` relation expand on `ShelfItem`. Add `ShelfUnit` selection where needed by the projection helper.
- [x] 4.4 Rewrite `ShelfService.addItem()`: compute `kind` from source `Unit` / `Post` at write time; call `generateBetween(lastPosition, undefined)` to append; within one `prisma.$transaction`, insert the `ShelfItem` row AND the `ShelfUnit` `(role='primary', unitId = itemRef)` row; optionally insert provided `reviewIds` / `tagIds` as additional `ShelfUnit` rows in the same transaction.
- [x] 4.5 Rewrite `ShelfService.removeItem()`: DELETE the single `ShelfItem` row; the cascading FK from `ShelfUnit.slot` removes all associated rows automatically.
- [x] 4.6 Rewrite `ShelfService.reorderItem()`: compute new `position` via `generateBetween(beforePos, afterPos)`, run a single UPDATE on `ShelfItem`. On key-length threshold breach, trigger local window rebalance (UPDATE N rows in one transaction).
- [x] 4.7 Rewrite `ShelfService.getShelfItems()`: `ORDER BY position ASC`, default limit 100, offset or cursor pagination. Call the projection helper to attach `reviewIds` / `tagIds` to each slot. Remove filter / keyword / sort logic entirely.
- [x] 4.8 Add `ShelfService.attachReview(shelfUnitId, itemRef, reviewUnitId)`: INSERT `ShelfUnit(role='review', unitId=reviewUnitId)` bound to the slot. If no `ShelfItem` exists yet for that `itemRef`, create it (plus its `role='primary'` row) first in the same transaction.
- [x] 4.9 Add `ShelfService.detachReview(shelfUnitId, itemRef, reviewUnitId)`: DELETE the matching `ShelfUnit(role='review')` row. The parent `ShelfItem` remains.
- [x] 4.10 Add `ShelfService.setItemTags(shelfUnitId, itemRef, tagIds)`: compute the diff against existing `ShelfUnit(role='tag')` rows for the slot; apply DELETEs and INSERTs in one transaction so the role='tag' set equals `tagIds` after the op.
- [x] 4.11 Add `ShelfService.cleanupOrphans(shelfUnitId, orphanItemRefs[])`: DELETE `ShelfItem` rows matching those itemRefs in one transaction; cascading FKs clean up the `ShelfUnit` rows. Authorize against the shelf's owner.
- [x] 4.12 Verify server builds: run `tsc --noEmit` in `package/server`.

## 5. Collection Service Update (`@rezics/server`)

- [x] 5.1 In `package/server/src/shelf/collection.service.ts`, update `collect()`: use `itemRef` + `kind` on the `ShelfItem` row; write the paired `ShelfUnit(role='primary')`; generate `position` for new rows; remove `keywords` merging and all `User.keywords` side effects.
- [x] 5.2 Update `toggleFavorite()`: same slot-plus-primary write pattern. For a review-target auto-collection (the input is a Post with `kind=REVIEW` and a `targetUnitId`), write the target work as the slot and a `ShelfUnit(role='review', unitId=reviewUnitId)` row bound to that slot in the same transaction. If the target already has a slot, only the `role='review'` row is inserted.
- [x] 5.3 Update `getCollectionStatus()`: query `ShelfUnit` via `WHERE unitId = U AND role = 'primary'` (B-tree index `(unitId, role)`). For review status, query `WHERE unitId = reviewId AND role = 'review'` against the same index. No `Unit` JOIN.
- [x] 5.4 Delete the `resolveReviewTarget → tx.shelfItemReview.upsert` code path; replace with `ShelfUnit` INSERT.
- [x] 5.5 Verify collection service builds.

## 6. API Route Updates (`@rezics/server`)

- [x] 6.1 Update `package/server/src/shelf/shelf.api.ts`: route handlers use new service signatures; remove `filter`, `keyword`, `sort` query params from the items endpoint; the items response carries the projected `reviewIds` / `tagIds` per slot.
- [x] 6.2 Replace the bulk reorder route with a single-item reorder route: `PATCH /shelf/:shelfUnitId/items/:itemRef/position` taking `{ beforeItemRef?, afterItemRef? }`.
- [x] 6.3 Add `POST /shelf/:shelfUnitId/items/:itemRef/reviews` (attach) and `DELETE /shelf/:shelfUnitId/items/:itemRef/reviews/:reviewUnitId` (detach).
- [x] 6.4 Add `PUT /shelf/:shelfUnitId/items/:itemRef/tags` (replace tag set; body `{ tagIds: string[] }`).
- [x] 6.5 Add `POST /shelf/:shelfUnitId/cleanup` taking `{ orphanItemRefs: string[] }` — author-only.
- [x] 6.6 Update `collection.api.ts`: remove `keywords` from collect input; verify the favorite toggle route handles `ShelfUnit` `role='review'` insert for review auto-collect.
- [x] 6.7 Remove any keyword vocabulary routes (add keyword, remove keyword, list keywords).

## 7. API Client Updates (`@rezics/api`)

- [x] 7.1 Update `package/api/src/shelf/shelf.keys.ts`: remove filter/sort/keyword variants from the query key factory.
- [x] 7.2 Update `package/api/src/shelf/shelf.queries.ts`: `shelfItemsQuery` uses the paginated endpoint with `limit` only (default 100); response is the thin `ShelfItem` shape with projected `reviewIds` / `tagIds`.
- [x] 7.3 Update `package/api/src/shelf/shelf.mutations.ts`: `addItem`, `removeItem`, `reorderItem` (single-row), `attachReview`, `detachReview`, `setItemTags`, `cleanupOrphans`. Delete `reorderItems` (bulk).
- [x] 7.4 Update `package/api/src/shelf/shelf.types.ts`: remove `ShelfItemsFilter` / `ShelfItemsSort` / `ShelfItemsKeyword` types. Export `ShelfUnitRole` from contract.
- [x] 7.5 Add `useShelfHydration(items: ShelfItemDTO[])` hook: computes the distinct-endpoints grouping from both slot `kind` and attachment unit ids from `reviewIds` / `tagIds`, issues parallel batch list queries, seeds per-item detail cache via `queryClient.setQueryData(...)`, and reports per-item success/failure for orphan detection.
- [x] 7.6 Remove user-keyword-vocabulary client code (hooks, query keys, mutations).
- [x] 7.7 Verify API client builds: run `tsc --noEmit` in `package/api`.

## 8. Frontend Refactor (`@rezics/app`)

- [x] 8.1 Update `ShelfPage` in `package/app/src/shelf` (or equivalent): remove the `all/created/collected` filter chips and any `keywordFilter` state. Add a sort-mode toggle with three options: `manual | time | title`.
- [x] 8.2 Implement `ShelfItemRenderer` that switches on `kind` to render the appropriate card (book card, review card, tag chip, generic fallback for unsupported kinds).
- [x] 8.3 Integrate `useShelfHydration` in `ShelfPage`: render items in `position` order (from API), replace with hydrated data as batches return; track orphans in state.
- [x] 8.4 Implement frontend sort modes: manual (identity — API order), time (`createdAt` desc), title (`Intl.Collator(userLocale)` over hydrated titles; partial-data behavior preserved).
- [x] 8.5 On author save of any kind (add/remove/reorder/re-tag/attach-review/detach-review), include the accumulated `orphanItemRefs[]` in the request and call the cleanup endpoint if non-empty — surfaced as an owner-only "Clean up" button wired to `useCleanupOrphansMutation`.
- [x] 8.6 Update `ShelfItemCard` to accept the new shape (`itemRef`, `kind`, `reviewIds`, `tagIds`, `position`). Remove any reads of `itemUnitId`, `sortOrder`, `keywords`, `label`, `extra`, `reviews`, `data`.
- [x] 8.7 Remove the user keyword vocabulary UI (autocomplete, manage-keywords page/modal). Replace per-item tag UI with a unit-id-based Tag picker writing to `tagIds` via the `setItemTags` mutation.
- [x] 8.8 Review any shelf-related pages that previously expanded `item` (full `Unit`) on ShelfItem rows; route them through the hydration hook.
- [x] 8.9 Verify app builds: run `tsc --noEmit` in `package/app`.

## 9. Seeds & Fixtures

- [x] 9.1 Update `package/server/prisma/seed/mocks/shelves.ts` and `seed/database.ts`: produce `ShelfItem` rows with `itemRef`, `kind`, `position` (spaced fractional keys). For each slot, produce a paired `ShelfUnit(role='primary')` row and any desired `role='review'` / `role='tag'` rows. Remove any `sortOrder`, `keywords`, `label`, `extra`, `ShelfItemReview` seed usage.
- [x] 9.2 Update any seed files that set `User.keywords`.

## 10. Cross-Package Verification

- [x] 10.1 Grep monorepo for residual references: `ShelfItemReview`, `itemUnitId` (shelf scope), `sortOrder` (shelf scope), `keywords` (shelf scope), `User.keywords`, `reviewIds` / `tagIds` on `ShelfItem` (should now live on `ShelfUnit` projection only).
- [x] 10.2 Grep for removed contract exports (`shelfItemReviewDTOSchema`, `reorderShelfItemsSchema`, filter/sort/keyword types, keyword vocabulary types).
- [x] 10.3 Confirm `Unit.workUnitId` / `WorkRelease` / `work` / `releases` are untouched across the monorepo.
- [x] 10.4 Run `tsc --noEmit` in each affected package: `contract`, `server`, `api`, `app`. Respect the tsc-per-package policy (ignore cross-package path alias errors).
- [ ] 10.5 Run `bun run knip` at the repo root; resolve any newly-unused exports introduced by the refactor.
- [ ] 10.6 Start `bun run server:dev` and smoke-test shelf CRUD: create shelf, add item, reorder, attach review, detach review, set tags, cleanup orphans.
- [ ] 10.7 Start `bun run app:dev` and smoke-test `ShelfPage`: rendering, sort-mode toggle, drag-drop reorder, review attach/detach UI, orphan auto-hiding, cleanup-on-save.
