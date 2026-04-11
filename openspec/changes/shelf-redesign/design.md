## Context

**This change executes after `unit-architecture` and `search-redesign` are complete.** The baseline state is the post-unit-architecture schema — Unit with `visibility`, `workUnitId`, `defaultLanguage`; Shelf and ShelfItem models deployed; ReadList and SeriesBook dropped; UnitTag scoring and TagVote live; Post model unifying reviews/comments; UnitTranslation for all text. The search-redesign's unified content index is also deployed.

This change answers **unit-architecture open question 5**: "Should bookmarks use the new UnitTag system, or remain a simple personal tagging mechanism?" **Answer: Neither — Bookmark is removed entirely. Shelf replaces it with personal keywords (`ShelfItem.keywords`) for organization, completely separate from the community UnitTag system.**

### Post-unit-architecture State (baseline for this change)

In the post-unit-architecture world:
- **Shelf** and **ShelfItem** exist as defined in unit-architecture's design.md (ShelfItem has `reviewPostUnitId` nullable FK, `sortOrder`, `label`, `extra`)
- **Bookmark** model still exists with `tags: String[]`, still coupled to Reaction system
- **ReadList** and **SeriesBook** are dropped (migrated to Shelf/ShelfItem by unit-architecture)
- **UnitTag** scored junction and **TagVote** are live
- **Post** model unifies reviews, comments, discussions (with `authorUserId`, `targetUnitId`, `kindKey`)
- **UnitTranslation** handles all display text
- **Unit.visibility** is available (public/private/draft/unlisted)

### What This Change Adds on Top

| Area | Post-unit-architecture State | After shelf-redesign |
|------|-------------------------------|----------------------|
| Bookmark | Still exists, coupled to Reactions | Removed — migrated to Favorites shelf |
| ShelfItem.reviewPostUnitId | Single nullable FK | Replaced by ShelfItemReview junction (supports multiple reviews per item) |
| ShelfItem.keywords | Does not exist | `String[]` for personal annotation |
| User.keywords | Does not exist | `String[]` for autocomplete source |
| Link type | Does not exist | New LINK UnitType + Link extension table |
| Collection API | No dedicated endpoints | /collect, /collect/toggle-favorite, /collect/status |
| Frontend UX | BookmarkTagManager Popper, BookmarkPage | CollectionModal (Dialog), FavoriteButton, ShelfPage with view modes |
| Reaction coupling | "bookmark" reaction auto-creates Bookmark row | Fully decoupled — Shelf is independent |
| Seed tags | No content-type tags exist | Seed Tag Units for book/game/media/post/link with official score boost |

## Goals / Non-Goals

**Goals:**
- Replace Bookmark, ReadList, and SeriesBook with a single Shelf collection system
- Design the collection modal UX and the APIs that power it
- Support review-driven collection with auto-collect of target works
- Provide personal keyword organization on shelf items with user-level autocomplete
- Support external URLs as first-class LINK units
- Enable multiple shelf view modes (grid, list, review-tab)
- Fully decouple collection from the Reaction system

**Non-Goals:**
- Publishable keyword taxonomies with import/share/strategy engine (future scope)
- URL-based auto-classification strategies and plugin API (future scope)
- Real-time collaboration on shelves
- Shelf permission/sharing model beyond public/private (via Unit.visibility)
- Admin moderation tools for public shelves

## Decisions

### D1: ShelfItemReview Junction Table over String Array

**Decision**: Use a `ShelfItemReview` junction table instead of `reviewUnitIds: String[]` on ShelfItem.

**Rationale**: The access pattern "which shelves contain this review?" requires scanning all ShelfItem arrays with `ANY()` + GIN index for the array approach, versus a simple B-tree index lookup on `ShelfItemReview.reviewUnitId` for the junction approach. Additionally:
- FK cascade on review deletion is automatic with a junction (no dangling IDs in arrays)
- Per-review metadata (`addedAt`) is naturally supported
- No array rewrite on append (Postgres MVCC rewrites entire row for array mutation)

**Alternative considered**: `reviewUnitIds: String[]` with GIN index. Simpler schema (no extra table), but write amplification on array append, no FK integrity, and full GIN scan for containment queries. Rejected for a feature where review attachment/detachment is frequent.

### D2: Review Auto-Collection Semantics

**Decision**: When a user collects a review, the system auto-collects the review's target work (the unit referenced by `Post.targetUnitId`) and attaches the review via `ShelfItemReview`. The work is the primary entity; reviews are supplementary.

**Rationale**: The purpose of collecting reviews is to understand a work and decide whether to engage with it. The work (book, game, etc.) is always the anchor — multiple reviews of the same work should group under it, not scatter as independent items.

**Dual collection mode**: Reviews can ALSO be collected as independent units (ShelfItem where `itemUnitId` = the review's own unitId, no ShelfItemReview created). This is opt-in via the collection modal, defaulting to "collect the work with this review attached."

**Flow**:
```
Collect a review of Book A:
  1. Resolve review → Post.targetUnitId = Book A
  2. Upsert ShelfItem(shelf, itemUnitId: Book A)
  3. Insert ShelfItemReview(shelf, Book A, review)

Collect Book A directly:
  1. Upsert ShelfItem(shelf, itemUnitId: Book A)
  2. No ShelfItemReview created
```

### D3: Favorites Decoupled from Reactions

**Decision**: The "Favorites" shelf is an independent Shelf entity with no connection to the Reaction system. The favorite button (heart icon) is a dedicated UI element separate from the collect button.

**Rationale**: The current coupling (bookmark reaction → auto-creates Bookmark row in `reaction.service.ts:151-166`) conflates engagement signals (reactions) with personal organization (collections). Reactions will be decoupled from all content as a separate initiative. Shelf needs to work independently from day one.

**UX**:
- Heart button (♡): instant toggle to Favorites shelf, no modal
- Collect button (📁): opens collection modal for shelf selection + keywords

### D4: Created vs. Collected Filter at Query Time

**Decision**: Determine whether a shelf item was "created" or "collected" by the shelf owner at query time via joins, not via a denormalized `isOwned` field on ShelfItem.

**Rationale**: Authorship is already modeled:
- `Post.authorUserId` for reviews, notes, discussions
- `PersonCredit`/`OrgCredit` for books, games, media via Attribution
- For this change, the primary use case is filtering reviews (Post.authorUserId) and works (Attribution)

A denormalized boolean introduces staleness risk (ownership transfer, attribution correction) and duplicates existing data. The query joins are against indexed columns within a user's own shelf (typically < 1000 items), so performance is acceptable.

**Dependency**: If `unit-architecture` adds a universal `creatorUserId` on Unit, this filter simplifies to a single-column comparison. Without it, type-specific joins are needed.

### D5: View Mode in Shelf.extra

**Decision**: Store the shelf's display mode in `Shelf.extra` JSON (`{ "viewMode": "grid" }`) rather than adding a dedicated column.

**Rationale**: View mode is a frontend presentation preference with no backend query implications. It doesn't warrant schema migration or column addition. The `extra` field already exists for this purpose. Supported values: `grid`, `list`, `review`.

### D6: User.keywords as String Array

**Decision**: Store the user's keyword vocabulary as `String[]` on the User model, not as a separate `UserKeyword` table.

**Rationale**: Keywords are a lightweight autocomplete source. A user might have 20-100 keywords. Reading a single array column is one indexed fetch with zero joins. Frequency/recency metadata (which a table would provide) is unnecessary — autocomplete just needs the list. If ranking is later desired, frequency can be derived at query time from `ShelfItem.keywords` with `unnest` + `GROUP BY`.

### D7: LINK as a Unit Type Extension

**Decision**: External URLs are modeled as Units of type `LINK` with a `Link` extension table, following the same pattern as Book, Game, Media.

**Rationale**: Making external links first-class Units means they participate in all Unit-level systems: UnitTag (tagging), Shelf (collection), Post (discussion), search (content index). The alternative — adding optional URL fields to ShelfItem — would create a second-class item that can't be tagged, discussed, or discovered independently.

**Extension model**:
```
Link { unitId, url, siteName?, faviconUrl?, extra? }
```
Title and description live in `UnitTranslation`.

### D8: Shelf UnitTags as Content-Type Filters

**Decision**: The collection modal's shelf filter uses the shelf's own UnitTags, not a separate `kindFilter` field. Seed tags for core content types (book, game, media, post, link) are created at database init with official score boost.

**Rationale**: Using UnitTags for shelf filtering leverages the existing tag infrastructure — no new field, no new query path. The frontend knows which tag Unit IDs are content-type tags (deterministic IDs from the seed script, stored as constants). The save panel fetches user's shelves with their UnitTags and filters client-side.

## Schema

### New Models

```prisma
model ShelfItemReview {
  shelfUnitId  String   @db.Uuid
  itemUnitId   String   @db.Uuid
  reviewUnitId String   @db.Uuid
  addedAt      DateTime @default(now())

  shelfItem    ShelfItem @relation(fields: [shelfUnitId, itemUnitId],
                                   references: [shelfUnitId, itemUnitId],
                                   onDelete: Cascade)
  review       Unit      @relation("ShelfItemReviewUnit",
                                   fields: [reviewUnitId], references: [id],
                                   onDelete: Cascade)

  @@id([shelfUnitId, itemUnitId, reviewUnitId])
  @@index([reviewUnitId])
}

model Link {
  unitId      String  @id @db.Uuid
  unit        Unit    @relation(fields: [unitId], references: [id], onDelete: Cascade)

  url         String
  siteName    String? @db.VarChar(128)
  faviconUrl  String?

  extra       Json?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### Modified Models (delta from unit-architecture)

```prisma
// Unit: add LINK to UnitType enum, ensure visibility field exists

// ShelfItem: add keywords, remove reviewPostUnitId, add reviews relation
model ShelfItem {
  shelfUnitId       String   @db.Uuid
  itemUnitId        String   @db.Uuid
  sortOrder         Int      @default(0)
  keywords          String[] @default([])   // NEW: personal annotation
  label             String?
  extra             Json?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  shelf             Shelf    @relation(fields: [shelfUnitId], references: [unitId], onDelete: Cascade)
  item              Unit     @relation("ShelfItemUnit", fields: [itemUnitId], references: [id], onDelete: Cascade)
  reviews           ShelfItemReview[]       // NEW: replaces reviewPostUnitId

  @@id([shelfUnitId, itemUnitId])
  @@index([itemUnitId])
  @@index([shelfUnitId, sortOrder])
}

// User: add keywords
model User {
  // ... existing fields ...
  keywords          String[] @default([])   // NEW: autocomplete source
}
```

### Removed Models

```prisma
// Bookmark: removed entirely (migrated to ShelfItem in Favorites shelf)
// ShelfItem.reviewPostUnitId: removed (replaced by ShelfItemReview junction)
```

## API Design

### Collection Endpoints (new domain: `shelf`)

```
POST   /collect
  Body: { targetId: string, shelfIds: string[], keywords: string[] }
  Behavior:
    - If target is a review (Post with kindKey=review):
      - Resolve targetUnitId from Post
      - For each shelf: upsert ShelfItem(item=targetUnit), insert ShelfItemReview
    - Else:
      - For each shelf: upsert ShelfItem(item=targetId, keywords)
    - Merge new keywords into User.keywords
  Returns: { savedTo: string[], isNew: boolean }

POST   /collect/toggle-favorite
  Body: { targetId: string }
  Behavior:
    - Same review resolution as /collect
    - If item in Favorites: remove ShelfItem (and cascaded ShelfItemReviews)
    - Else: create ShelfItem in Favorites shelf (attach review if applicable)
  Returns: { isFavorited: boolean }

GET    /collect/status/:targetId
  Behavior:
    - If target is a review: resolve to target work, also check review attachment
    - Returns which shelves contain this item
  Returns: { isFavorited: boolean, shelves: [{ id: string, title: string }] }

DELETE /collect/:shelfId/:itemUnitId
  Behavior: Remove ShelfItem (cascades ShelfItemReviews)
```

### Shelf CRUD Endpoints

```
POST   /shelves
  Body: { title: string, kindKey?: string, visibility?: string, tagIds?: string[] }
  Returns: ShelfDTO

GET    /shelves/me
  Returns: ShelfSummaryDTO[] (id, title, kindKey, itemCount, tags)
  Use: powers collection modal shelf list

GET    /shelves/:unitId
  Returns: ShelfDetailDTO (metadata + first page of items)

PUT    /shelves/:unitId
  Body: { title?, kindKey?, visibility?, extra? }

DELETE /shelves/:unitId
```

### Shelf Item Endpoints

```
GET    /shelves/:unitId/items
  Query: filter=all|created|collected, keyword=string, sort=newest|oldest|manual, cursor, limit
  Returns: paginated ShelfItemDTO[]
    Each item includes: unit summary, unitTranslation, reviews (ShelfItemReview[]), keywords

PATCH  /shelves/:unitId/items/:itemUnitId
  Body: { keywords?: string[], label?, sortOrder? }

PUT    /shelves/:unitId/items/reorder
  Body: { items: [{ itemUnitId: string, sortOrder: number }] }

DELETE /shelves/:unitId/items/:itemUnitId
  Cascades ShelfItemReviews

DELETE /shelves/:unitId/items/:itemUnitId/reviews/:reviewUnitId
  Removes single ShelfItemReview only (ShelfItem stays)
```

### User Keyword Endpoints

```
GET    /users/me/keywords
  Returns: string[]

PATCH  /users/me/keywords
  Body: { add?: string[], remove?: string[] }
```

## Data Flow

### Collection Modal Flow

```
1. User clicks [📁 Collect] on a unit
2. Frontend: GET /collect/status/:targetId
   → receives { isFavorited, shelves: [...] }
3. Frontend: GET /shelves/me
   → receives all user's shelves with UnitTags
4. Modal renders:
   - Pre-checked shelves from status response
   - Shelf list filtered by content-type UnitTags
   - Keywords input with autocomplete from cached User.keywords
5. User selects shelves + enters keywords → clicks Save
6. Frontend: POST /collect { targetId, shelfIds, keywords }
7. Backend fan-out: upsert ShelfItems, handle review resolution, merge keywords
```

### Favorites Toggle Flow

```
1. User clicks ♡ on a unit
2. Frontend: POST /collect/toggle-favorite { targetId }
3. Backend: resolve review if applicable, toggle ShelfItem in Favorites
4. Frontend: update heart icon state from response
```

### Shelf View with Review Tabs

```
1. User opens shelf page with viewMode=review
2. Frontend: GET /shelves/:unitId/items?sort=manual&limit=20
3. Response includes ShelfItemReview[] per item
4. For items with reviews:
   - Render unit card as primary display
   - Render reviews as tabs beneath the unit card
   - Tab content shows review author, rating, body excerpt
5. For items without reviews:
   - Render unit card normally
```

## Risks / Trade-offs

### [Risk] Bookmark migration data loss → Mitigation: phased migration with validation
Existing Bookmark.tags may contain tags that don't cleanly map to keywords. Migration copies tags verbatim to ShelfItem.keywords and User.keywords. Edge case: users with identical bookmarks to the same unit (impossible due to PK constraint, but verify).

### [Risk] ShelfItemReview orphans on review deletion → Mitigation: FK cascade
`ShelfItemReview.reviewUnitId` has `onDelete: Cascade`. When a review Unit is deleted, all ShelfItemReview rows referencing it are automatically removed. The parent ShelfItem survives — the work is still in the shelf, just with fewer attached reviews.

### [Risk] Review target resolution depends on Post model → Mitigation: service-layer validation
The collection endpoint must verify that `Post.targetUnitId` exists and is a valid work before auto-collecting. If the review has no targetUnitId (e.g., a standalone discussion post), treat it as a regular unit collection — no ShelfItemReview created.

### [Risk] User.keywords unbounded growth → Mitigation: reasonable limit
A `String[]` on User has no natural bound. Apply a service-layer limit (e.g., 500 keywords). Keyword cleanup can be offered in the UI (show unused keywords).

### [Risk] Seed tag IDs must be deterministic → Mitigation: use well-known UUIDs
The init seed must produce the same tag Unit IDs across environments (dev, staging, prod) so the frontend constants file references stable IDs. Use UUIDv5 with a namespace + tag name as input.

### [Trade-off] No denormalized isOwned on ShelfItem
Query-time joins for created/collected filter are slower than a boolean column filter. Acceptable for user-scoped shelf views (< 1000 items per shelf typically). If performance becomes an issue, denormalization can be added later without API changes.

### [Trade-off] View mode in extra JSON
Not queryable at the database level ("find all shelves with review view mode"). This is acceptable because view mode has no backend query implications — it's purely a frontend rendering hint.

## Migration Plan

### Prerequisites
- `unit-architecture` completed: Unit.visibility exists, Shelf/ShelfItem base models exist, Bookmark model still present
- `search-redesign` completed: content index supports new Unit types

### Phase 1: Schema Changes
1. Add `keywords: String[]` to ShelfItem
2. Remove `reviewPostUnitId` from ShelfItem
3. Create `ShelfItemReview` table
4. Create `Link` extension table
5. Add `LINK` to UnitType enum
6. Add `keywords: String[]` to User model

### Phase 2: Bookmark Migration
1. Create "Favorites" shelf for every existing user
2. For each Bookmark row:
   - Create ShelfItem in the user's Favorites shelf (itemUnitId = Bookmark.targetId)
   - Copy Bookmark.tags → ShelfItem.keywords
   - Merge tags into User.keywords (deduplicated)
3. Validate: count(Bookmarks) == count(new ShelfItems from migration)

### Phase 3: Seed Data
1. Create seed Tag Units for content types (book, game, media, post, link) with deterministic UUIDv5 IDs
2. Create UnitTranslation for each seed tag (English, plus other supported languages)
3. Set official score boost on each seed tag's UnitTag entries

### Phase 4: Backend Deployment
1. Deploy new shelf domain (service, API, mapper)
2. Deploy collection endpoints (/collect, /collect/toggle-favorite, /collect/status)
3. Deploy keyword endpoints
4. Remove bookmark coupling from reaction.service.ts
5. Remove old bookmark API endpoints

### Phase 5: Frontend Deployment
1. Deploy CollectionModal component
2. Replace BookmarkTagManager with collection modal
3. Add favorites heart button to unit cards
4. Deploy shelf view page with view modes
5. Remove BookmarkPage, replace with shelf-based collection view

### Phase 6: Cleanup
1. Drop Bookmark table
2. Remove bookmark-related types from contract
3. Remove bookmark hooks from api package

### Rollback Strategy
- Phases 1-3 are additive (new tables/columns). Rollback: drop new tables, remove new columns.
- Phase 4: Keep old bookmark endpoints behind a feature flag during rollout. Rollback: re-enable old endpoints, re-add reaction coupling.
- Phase 5: Frontend rollback via deployment revert.
- Phase 6 is destructive. Take backup before executing.

## Open Questions

1. **Default shelf per new user**: Should the "Favorites" shelf be created lazily (on first collection action) or eagerly (on user registration)? Lazy avoids empty shelves for users who never collect; eager simplifies the toggle-favorite endpoint (no "create if not exists" check).

2. **Dual collection mode UI**: For reviews, should the modal default to "collect the work" (Mode 1) with "collect as independent unit" (Mode 2) as a secondary option? Or present both equally?

3. **Keyword sync on removal**: When all ShelfItems using keyword "X" are removed or the keyword is deleted from all items, should "X" be auto-removed from User.keywords? Or only via explicit user action in keyword management?
