## 0. Prerequisites and Open Questions

- [ ] 0.1 Verify `unit-architecture` is fully complete: Shelf/ShelfItem models deployed, ReadList/SeriesBook dropped, UnitTag/TagVote live, Post model deployed, UnitTranslation deployed, Unit.visibility present
- [ ] 0.2 Verify `search-redesign` is fully complete: unified content index deployed, old book/unit/readlist indexes dropped
- [ ] 0.3 Answer open question 5 in `openspec/changes/unit-architecture/design.md`: Bookmark is removed entirely by shelf-redesign; personal tagging becomes ShelfItem.keywords, separate from UnitTag (already answered — verify the answer is recorded)

## 1. Schema Changes (delta from post-unit-architecture schema)

- [ ] 1.1 Add `keywords: String[] @default([])` to ShelfItem in `package/server/prisma/schema.prisma` (ShelfItem already exists from unit-architecture)
- [ ] 1.2 Remove `reviewPostUnitId` field and its relation from ShelfItem in `package/server/prisma/schema.prisma` (field exists from unit-architecture, replaced by ShelfItemReview junction)
- [ ] 1.3 Create `ShelfItemReview` model in `package/server/prisma/schema.prisma` with composite PK `(shelfUnitId, itemUnitId, reviewUnitId)`, `addedAt` field, FK relations to ShelfItem (onDelete: Cascade) and Unit (onDelete: Cascade), and `@@index([reviewUnitId])`
- [ ] 1.4 Add `LINK` to UnitType enum values in `package/contract/src/unit.ts`
- [ ] 1.5 Create `Link` model in `package/server/prisma/schema.prisma` with `unitId` PK, `url`, `siteName?`, `faviconUrl?`, `extra?`, FK to Unit (onDelete: Cascade)
- [ ] 1.6 Add `keywords: String[] @default([])` to User model in `package/server/prisma/schema.prisma`
- [ ] 1.7 Remove `Bookmark` model from `package/server/prisma/schema.prisma`
- [ ] 1.8 Run `bun run prisma:generate` in `package/server` to verify schema compiles

## 2. Database Migration

- [ ] 2.1 Create Prisma migration for all schema changes from Phase 1
- [ ] 2.2 Write migration script: create "Favorites" shelf (Unit + Shelf) for every existing user
- [ ] 2.3 Write migration script: migrate Bookmark rows to ShelfItems in each user's Favorites shelf (targetId → itemUnitId, tags → keywords)
- [ ] 2.4 Write migration script: merge each user's Bookmark tags into User.keywords (deduplicated)
- [ ] 2.5 Write migration script: migrate existing ShelfItem.reviewPostUnitId values to ShelfItemReview rows, then drop the column
- [ ] 2.6 Add validation: assert count(migrated ShelfItems) == count(original Bookmarks)

## 3. Seed Data

- [ ] 3.1 Create UUIDv5 generation utility for deterministic seed tag IDs (namespace + tag name input)
- [ ] 3.2 Write seed script: create Tag Units for content types (book, game, media, post, link) with deterministic UUIDs
- [ ] 3.3 Write seed script: create UnitTranslation entries for each seed tag (English at minimum)
- [ ] 3.4 Write seed script: set official score boost (score 1000) on each seed tag via UnitTag
- [ ] 3.5 Export deterministic seed tag UUIDs as constants in `package/contract/src/seed-tags.ts`
- [ ] 3.6 Verify seed is idempotent (run twice, assert no duplicates)

## 4. Contract Layer

- [ ] 4.1 Create `package/contract/src/shelf.ts`: ShelfDTO, ShelfSummaryDTO, ShelfDetailDTO, ShelfItemDTO, ShelfItemReviewDTO, CreateShelfInput, UpdateShelfInput, CollectInput, CollectResponse, ToggleFavoriteInput, ToggleFavoriteResponse, CollectionStatusResponse
- [ ] 4.2 Create `package/contract/src/link.ts`: LinkDTO, CreateLinkInput
- [ ] 4.3 Remove bookmark-related types from `package/contract/src/reaction.ts` (BookmarkTagsResponse, BookmarkTagsUpdateInput)
- [ ] 4.4 Remove ReadlistDTO and related types from `package/contract/src/readlist.ts` (if not already removed by unit-architecture)
- [ ] 4.5 Verify contract package compiles: `cd package/contract && bun run build` (or type-check)

## 5. Server: Shelf Domain

- [ ] 5.1 Create `package/server/src/shelf/shelf.types.ts` with domain types
- [ ] 5.2 Create `package/server/src/shelf/shelf.mapper.ts` with mappers for ShelfDTO, ShelfItemDTO, ShelfSummaryDTO
- [ ] 5.3 Create `package/server/src/shelf/shelf.service.ts` with shelf CRUD: createShelf, getShelf, listUserShelves, updateShelf, deleteShelf
- [ ] 5.4 Add ShelfItem operations to shelf.service.ts: addItem (with upsert), removeItem, updateItem (keywords, label, sortOrder), reorderItems
- [ ] 5.5 Add review attachment logic to shelf.service.ts: attachReview (create ShelfItemReview), detachReview (delete ShelfItemReview)
- [ ] 5.6 Add query logic to shelf.service.ts: getShelfItems with pagination, created/collected filter (join Post.authorUserId / Attribution), keyword filter
- [ ] 5.7 Create `package/server/src/shelf/shelf.api.ts` with shelf CRUD routes: POST /shelves, GET /shelves/me, GET /shelves/:unitId, PUT /shelves/:unitId, DELETE /shelves/:unitId
- [ ] 5.8 Add shelf item routes to shelf.api.ts: GET /shelves/:unitId/items (with filter/keyword/sort/cursor query params), PATCH /shelves/:unitId/items/:itemUnitId, PUT /shelves/:unitId/items/reorder, DELETE /shelves/:unitId/items/:itemUnitId, DELETE /shelves/:unitId/items/:itemUnitId/reviews/:reviewUnitId
- [ ] 5.9 Mount shelf API via `.use()` in `package/server/src/index.ts`

## 6. Server: Collection Endpoints

- [ ] 6.1 Create `package/server/src/shelf/collection.service.ts` with collection logic: collect (multi-shelf, review resolution, keyword merge), toggleFavorite, getCollectionStatus
- [ ] 6.2 Implement review auto-collection: resolve Post.targetUnitId, upsert ShelfItem for target work, create ShelfItemReview
- [ ] 6.3 Implement dual collection mode: when explicit independent mode flag is set, collect the review itself (itemUnitId = review unitId, no ShelfItemReview)
- [ ] 6.4 Create `package/server/src/shelf/collection.api.ts` with routes: POST /collect, POST /collect/toggle-favorite, GET /collect/status/:targetId, DELETE /collect/:shelfId/:itemUnitId
- [ ] 6.5 Mount collection API via `.use()` in `package/server/src/index.ts`

## 7. Server: Link Domain

- [ ] 7.1 Create `package/server/src/link/link.types.ts` with domain types
- [ ] 7.2 Create `package/server/src/link/link.mapper.ts` with LinkDTO mapper
- [ ] 7.3 Create `package/server/src/link/link.service.ts` with CRUD: createLink (creates Unit + Link + UnitTranslation), getLink, updateLink, deleteLink
- [ ] 7.4 Create `package/server/src/link/link.api.ts` with routes: POST /links, GET /links/:unitId, PUT /links/:unitId, DELETE /links/:unitId
- [ ] 7.5 Mount link API via `.use()` in `package/server/src/index.ts`

## 8. Server: User Keywords

- [ ] 8.1 Add keyword endpoints to existing user API or create a dedicated route: GET /users/me/keywords, PATCH /users/me/keywords (add/remove)
- [ ] 8.2 Implement keyword vocabulary limit (500 max) with appropriate error response

## 9. Server: Reaction Decoupling

- [ ] 9.1 Remove bookmark auto-creation from `package/server/src/reaction/reaction.service.ts` (lines ~151-166, ~233-241, ~339-354)
- [ ] 9.2 Remove bookmark API endpoints from `package/server/src/reaction/reaction.api.ts` (GET /reactions/bookmarks/:targetId, PUT /reactions/bookmarks/tag, PUT /reactions/bookmarks/:targetId)
- [ ] 9.3 Verify reaction service compiles and existing reaction tests pass

## 10. Server: Favorites Shelf Initialization

- [ ] 10.1 Add Favorites shelf creation to user registration flow (create Shelf Unit + Shelf record after user creation)
- [ ] 10.2 Store the Favorites shelf unitId reference on User or derive via query (e.g., first shelf with a well-known kindKey or a `isFavorites` flag)

## 11. API Client Layer

- [ ] 11.1 Create `package/api/src/shelf/shelf.queries.ts` with query options: shelfDetailQuery, userShelvesQuery, shelfItemsQuery
- [ ] 11.2 Create `package/api/src/shelf/shelf.mutations.ts` with mutations: useCreateShelfMutation, useUpdateShelfMutation, useDeleteShelfMutation, useUpdateShelfItemMutation, useReorderShelfItemsMutation, useRemoveShelfItemMutation, useDetachReviewMutation
- [ ] 11.3 Create `package/api/src/collection/collection.queries.ts` with query options: collectionStatusQuery
- [ ] 11.4 Create `package/api/src/collection/collection.mutations.ts` with mutations: useCollectMutation, useToggleFavoriteMutation
- [ ] 11.5 Create `package/api/src/shelf/shelf.api.ts` and `package/api/src/collection/collection.api.ts` barrel exports
- [ ] 11.6 Create `package/api/src/user/keywords.queries.ts` and `keywords.mutations.ts`: useUserKeywordsQuery, useUpdateKeywordsMutation
- [ ] 11.7 Remove bookmark-related queries and mutations from `package/api/src/reaction/` (reactionBookmarkTagsQuery, useSetBookmarkTagsMutation)
- [ ] 11.8 Remove readlist queries and mutations from `package/api/src/readlist/` (if not already removed by unit-architecture)

## 12. Frontend: Collection Modal

- [ ] 12.1 Create `package/app/src/collection/component/CollectionModal.tsx`: Dialog-based modal with shelf list, content-type filter chips (using seed tag constants), keyword input with autocomplete, multi-select checkboxes
- [ ] 12.2 Create `package/app/src/collection/hooks/useCollectionModal.ts`: modal open/close state, shelf list query, collection status query, collect mutation
- [ ] 12.3 Create `package/app/src/collection/component/KeywordInput.tsx`: autocomplete input using User.keywords, chip display for selected keywords
- [ ] 12.4 Create `package/app/src/collection/component/ShelfFilterChips.tsx`: content-type filter chips using seed tag UUIDs from contract constants
- [ ] 12.5 Integrate dual collection mode for reviews: default "collect the work" option, secondary "collect as independent unit" option

## 13. Frontend: Favorites Button

- [ ] 13.1 Create `package/app/src/collection/component/FavoriteButton.tsx`: heart icon toggle, calls useToggleFavoriteMutation, filled state from collectionStatusQuery
- [ ] 13.2 Integrate FavoriteButton alongside existing action bars: BookHeroSection, MiniActionBar, ReactionBar locations where bookmark button currently appears

## 14. Frontend: Replace Bookmark UX

- [ ] 14.1 Replace BookmarkTagManager Popper with CollectionModal trigger in `package/app/src/engagement/component/ReactionBar.tsx`
- [ ] 14.2 Replace bookmark button in `package/app/src/engagement/component/MiniActionBar.tsx` with Collect button + FavoriteButton
- [ ] 14.3 Remove `package/app/src/engagement/component/BookmarkTagManager.tsx`
- [ ] 14.4 Remove `package/app/src/user/page/BookmarkPage.tsx` and its route
- [ ] 14.5 Remove `package/app/src/user/component/Bookmark/BookmarkItemCard.tsx`
- [ ] 14.6 Remove `package/app/src/user/page/UserBookmarkTagsCard.tsx`

## 15. Frontend: Shelf View Page

- [ ] 15.1 Create `package/app/src/shelf/page/ShelfPage.tsx`: shelf detail view with item listing, view mode toggle (grid/list/review), created/collected filter, keyword filter
- [ ] 15.2 Create `package/app/src/shelf/component/ShelfItemCard.tsx`: unit card with keywords display, review attachments (tab UI in review mode)
- [ ] 15.3 Create `package/app/src/shelf/component/ShelfViewModeToggle.tsx`: grid/list/review toggle, updates Shelf.extra.viewMode via mutation
- [ ] 15.4 Create `package/app/src/shelf/component/ShelfGrid.tsx`, `ShelfList.tsx`, `ShelfReviewView.tsx` for each view mode
- [ ] 15.5 Update shelf-related routes in TanStack Router configuration

## 16. Frontend: User Keyword Management

- [ ] 16.1 Create keyword management section in user settings or shelf settings: view all keywords, add/remove keywords
- [ ] 16.2 Wire keyword autocomplete in CollectionModal to useUserKeywordsQuery

## 17. Search Integration

- [ ] 17.1 Add LINK unit type to Meilisearch content index document model (in `package/search` or `package/server/src/meili/`)
- [ ] 17.2 Implement Link unit sync: create/update/delete Link units in search index
- [ ] 17.3 Verify LINK units appear in search results with URL and siteName display fields

## 18. Cleanup and Validation

- [ ] 18.1 Remove all bookmark imports and references across the codebase: `grep -r "Bookmark\|bookmark" --include="*.ts" --include="*.tsx"` and clean up
- [ ] 18.2 Remove old readlist imports and references if not already cleaned by unit-architecture
- [ ] 18.3 Run full TypeScript type-check across all packages: verify no compile errors from removed types
- [ ] 18.4 Run existing tests: verify no regressions from reaction decoupling
- [ ] 18.5 Verify open question 5 answer in `openspec/changes/unit-architecture/design.md` is accurate and cross-references this change
