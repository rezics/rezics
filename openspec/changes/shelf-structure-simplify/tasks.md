## 1. Prisma Schema Migration

- [ ] 1.1 Add `structure Json @default("{}")` column to the `Shelf` model in `package/server/prisma/schema.prisma`
- [ ] 1.2 Add `itemRef String` column to `ShelfItem`, add `kind String @db.VarChar(32)` column, add `data Json?` column
- [ ] 1.3 Add `@@index([itemRef])` to ShelfItem. Update composite PK from `@@id([shelfUnitId, itemUnitId])` to `@@id([shelfUnitId, itemRef])`
- [ ] 1.4 Remove `sortOrder`, `keywords`, `label`, `extra` columns from ShelfItem. Remove `itemUnitId` column and its FK relation to Unit
- [ ] 1.5 Remove the `ShelfItemReview` model entirely
- [ ] 1.6 Remove the `ShelfItem` relation (`items`) from the `Shelf` model if needed and re-add with updated field names. Remove `ShelfItemReview` relation from Unit
- [ ] 1.7 Run `bun run prisma:generate` in `package/server` to verify schema compiles

## 2. Data Migration Script

- [ ] 2.1 Create migration script: populate `itemRef` from existing `itemUnitId` for all ShelfItem rows
- [ ] 2.2 Create migration script: populate `kind` by joining ShelfItem → Unit (and optionally Post for POST type) to determine ShelfItemKind
- [ ] 2.3 Create migration script: build `structure.units` for each Shelf by querying ShelfItems ordered by `sortOrder ASC, createdAt ASC`
- [ ] 2.4 Create migration script: build `structure.tag` for each Shelf by querying unitTags where the tag was added by the shelf owner
- [ ] 2.5 Create migration script: migrate ShelfItemReview rows into `ShelfItem.data.review` arrays
- [ ] 2.6 Create migration script: convert non-empty `keywords[]` to `data.tag` where keywords map to existing Tag units
- [ ] 2.7 Run `bun run prisma:migrate` and verify migration completes without errors

## 3. Contract Updates (`@rezics/contract`)

- [ ] 3.1 Add `ShelfItemKind` type (union of string literals: `book | review | quote | post | chapter | tag | realm | image | video | media | game | link`)
- [ ] 3.2 Add `ShelfStructure` Typebox schema (`{ tag: string[], units: string[] }`)
- [ ] 3.3 Update `shelfDTOSchema` to include `structure` field using `ShelfStructure` schema
- [ ] 3.4 Update `shelfItemDTOSchema`: replace `itemUnitId` with `itemRef`, add `kind: ShelfItemKind`, add `data: Json?`. Remove `sortOrder`, `keywords`, `label`, `extra`, `reviews`, `item` (expanded relation)
- [ ] 3.5 Remove `shelfItemReviewDTOSchema` and `ShelfItemReviewDTO` exports
- [ ] 3.6 Remove `all | created | collected` from `shelfItemsQuerySchema.filter`. Remove `keyword` and `sort` fields from `shelfItemsQuerySchema`
- [ ] 3.7 Update `addShelfItemSchema`: replace `itemUnitId` with `itemRef`, add `kind: ShelfItemKind`, remove `sortOrder`, `keywords`, `label`
- [ ] 3.8 Update `updateShelfItemSchema`: remove `sortOrder`, `keywords`, `label`, `extra`. Add `data: Json?`
- [ ] 3.9 Remove `reorderShelfItemsSchema` (reorder now updates `structure.units` only)
- [ ] 3.10 Update `collectInputSchema`: remove `keywords` field
- [ ] 3.11 Verify contract builds: run `tsc --noEmit` in `package/contract`

## 4. Server Service Rewrite (`@rezics/server`)

- [ ] 4.1 Update `shelf.mapper.ts`: update mapping functions for new ShelfItem shape (itemRef, kind, data). Remove ShelfItemReview mapping
- [ ] 4.2 Update `types.ts`: update `shelfInclude`, `shelfItemInclude`, `shelfListSelect` to reflect new schema (no ShelfItemReview include, no item relation expand)
- [ ] 4.3 Rewrite `ShelfService.create()`: initialize `structure = { tag: [], units: [] }`. Accept optional tagIds and sync to both structure.tag and unitTags
- [ ] 4.4 Rewrite `ShelfService.addItem()`: accept `itemRef` + `kind`, INSERT ShelfItem + append to `structure.units` in one transaction
- [ ] 4.5 Rewrite `ShelfService.removeItem()`: DELETE ShelfItem + remove from `structure.units` in one transaction
- [ ] 4.6 Rewrite `ShelfService.reorderItems()`: only update `Shelf.structure.units` JSON (single UPDATE, no ShelfItem row changes)
- [ ] 4.7 Rewrite `ShelfService.getShelfItems()`: read `structure.units`, slice for pagination (offset/limit, default 100), query ShelfItem rows for those itemRefs, return in structure order. Remove filter/keyword/sort logic
- [ ] 4.8 Add `ShelfService.updateItemData()`: UPDATE a single ShelfItem's `data` field (for adding/removing reviews and tags per item)
- [ ] 4.9 Add `ShelfService.cleanupOrphans()`: accept a list of orphaned itemRefs, DELETE their ShelfItem rows, remove from structure.units
- [ ] 4.10 Rewrite `ShelfService.attachReview()` / `detachReview()`: update `ShelfItem.data.review` array instead of creating/deleting ShelfItemReview rows
- [ ] 4.11 Add shelf tag management methods: add/remove tag syncs both `structure.tag` and `unitTags` in one transaction
- [ ] 4.12 Update `ShelfService.getByUnitId()`: include `structure` in response
- [ ] 4.13 Verify server builds: run `tsc --noEmit` in `package/server`

## 5. Collection Service Update (`@rezics/server`)

- [ ] 5.1 Update `CollectionService.collect()`: use `itemRef` + `kind` instead of `itemUnitId`. Write to `structure.units` in same transaction. Remove keywords merging logic. Remove `User.keywords` merge
- [ ] 5.2 Update `CollectionService.toggleFavorite()`: use `itemRef` + `kind`. Write to `structure.units`. Store review in `data.review` instead of creating ShelfItemReview
- [ ] 5.3 Update `CollectionService.getCollectionStatus()`: query by `itemRef` instead of `itemUnitId`. Check `data.review` instead of ShelfItemReview table
- [ ] 5.4 Verify collection service builds and all shelf-related code compiles

## 6. API Route Updates (`@rezics/server`)

- [ ] 6.1 Update `shelf.api.ts`: update route handlers to use new service signatures. Remove filter/sort/keyword query params from items endpoint
- [ ] 6.2 Add route for `cleanupOrphans` endpoint (POST `/shelf/:unitId/cleanup`)
- [ ] 6.3 Add route for `updateItemData` endpoint (PATCH `/shelf/:unitId/items/:itemRef/data`)
- [ ] 6.4 Add routes for shelf tag management (POST/DELETE `/shelf/:unitId/tags`)
- [ ] 6.5 Update `collection.api.ts`: remove `keywords` from collect input

## 7. API Client Updates (`@rezics/api`)

- [ ] 7.1 Update `shelf.keys.ts`: update query key structure for new item query shape (remove filter/sort keys)
- [ ] 7.2 Update `shelf.queries.ts`: update `shelfItemsQuery` to use new paginated endpoint (offset/limit, no filter/sort params). Update `shelfDetailQuery` to include structure
- [ ] 7.3 Update `shelf.mutations.ts`: update `addItem`, `removeItem`, `reorderItems` mutations for new service signatures. Add `updateItemData`, `cleanupOrphans`, `addShelfTag`, `removeShelfTag` mutations
- [ ] 7.4 Update `shelf.types.ts`: update `ShelfItemsQuery` (remove filter/sort/keyword), update `ShelfFilters`
- [ ] 7.5 Add batch hydration utility: `useShelfHydration(items: ShelfItemDTO[])` hook that groups by kind, issues parallel batch queries, seeds detail cache via `setQueryData`
- [ ] 7.6 Verify API client builds: run `tsc --noEmit` in `package/api`

## 8. Frontend Refactor (`@rezics/app`)

- [ ] 8.1 Update `ShelfPage.tsx`: remove `all/created/collected` filter chips and `keywordFilter` state. Add sort mode toggle (manual/time/title)
- [ ] 8.2 Implement kind-based item rendering: create a `ShelfItemRenderer` component that switches on `kind` to render different card types (book card, review card, tag chip, etc.)
- [ ] 8.3 Integrate `useShelfHydration` hook in ShelfPage to hydrate items after fetching ShelfItem list
- [ ] 8.4 Implement frontend sorting: manual (default from API order), time (sort by createdAt), title (sort by hydrated title using `Intl.Collator`)
- [ ] 8.5 Implement orphan detection: hide items that fail hydration, collect orphan itemRefs, send cleanup on next author save
- [ ] 8.6 Update `ShelfEditPage.tsx` if it exists: update tag management UI to use structure.tag + unitTags sync
- [ ] 8.7 Update `ShelfItemCard.tsx`: accept new ShelfItem shape (itemRef, kind, data instead of itemUnitId, sortOrder, keywords)
- [ ] 8.8 Update any components referencing `ShelfItemReview` types or `keywords` filtering

## 9. Cross-Package Verification

- [ ] 9.1 Grep for all references to `ShelfItemReview`, `itemUnitId`, `sortOrder` (in ShelfItem context), `keywords` (in ShelfItem context) across the monorepo and update or remove
- [ ] 9.2 Grep for references to removed contract exports (`shelfItemReviewDTOSchema`, `reorderShelfItemsSchema`, filter types) and update consumers
- [ ] 9.3 Run `tsc --noEmit` in each affected package: contract, server, api, app
- [ ] 9.4 Run `bun run knip` at root to detect newly unused exports
- [ ] 9.5 Start dev server (`bun run server:dev`) and verify shelf CRUD endpoints work
- [ ] 9.6 Start frontend (`bun run app:dev`) and verify shelf page renders, pagination works, sort modes work, and orphan handling works
