## Why

The current platform has three separate, disconnected systems for saving and organizing content: Bookmark (personal saves via the Reaction system), ReadList (curated ordered lists), and SeriesBook (series ordering). These overlap in purpose, diverge in implementation, and none support the full vision: a universal, extensible collection system that works across all content types, supports review-driven curation, personal keyword organization, external URLs, and multiple display modes.

The `unit-architecture` change defines Shelf as a replacement for ReadList and SeriesBook, but scopes it as a structural migration — not a product redesign. The collection UX (how users save, organize, and browse content) remains unaddressed: bookmarks are still coupled to the Reaction system, there is no collection modal, no personal keyword system, no review-attachment model, and no support for external links.

This change completes the Shelf vision: a unified collection system that replaces Bookmark, ReadList, and SeriesBook with a single, well-designed product feature.

## What Changes

### Bookmark Replacement
- **BREAKING**: `Bookmark` model removed entirely. All bookmark functionality migrated to Shelf.
- **BREAKING**: Bookmark-reaction coupling removed. The `reaction.service.ts` auto-creation of Bookmark rows on "bookmark" reaction is deleted. Shelf is fully independent from the Reaction system.
- New "Favorites" default shelf auto-created per user on registration.
- Dedicated favorite button (heart icon) for instant save to Favorites — no modal, no friction.

### ShelfItem Enhancement
- **BREAKING**: `ShelfItem.reviewPostUnitId` (single nullable FK) replaced by `ShelfItemReview` junction table supporting multiple reviews per shelf item.
- `ShelfItem` gains `keywords: String[]` for personal annotation per item.
- `ShelfItem` comment updated: `itemUnitId` references any Unit, not exclusively works. Reviews can also be collected as independent units.

### ShelfItemReview Junction
- New `ShelfItemReview` model: `(shelfUnitId, itemUnitId, reviewUnitId)` composite PK.
- When a user collects a review, the review's target work is auto-collected to the shelf (if not already present), and the review is attached via `ShelfItemReview`.
- FK cascade: deleting a review Unit cascades to `ShelfItemReview`. Deleting a `ShelfItem` cascades to all its `ShelfItemReview` rows.
- Indexed by `reviewUnitId` for fast lookup: "which shelves contain this review?"

### User Keywords
- `User` model gains `keywords: String[]` for autocomplete source.
- Keywords are appended when the user tags shelf items with new keywords.
- User can manage (add/remove) keywords independently.

### Collection API
- New `/collect` endpoint: save a unit to multiple shelves with keywords in a single mutation.
- New `/collect/toggle-favorite` endpoint: instant add/remove from Favorites shelf.
- New `/collect/status/:targetId` endpoint: returns which of the user's shelves contain this item (powers checkbox state in collection modal and filled button indicators).
- New keyword management endpoints on the user resource.

### Collection Modal UX
- Collect button opens a dialog/modal (replacing the existing BookmarkTagManager Popper).
- Modal shows the user's shelves with checkbox multi-select, filtered by the shelf's UnitTags.
- Content-type seed tags (book, game, media, post, url) used as filter chips — priority display for UnitType-matching tags, expanded search for others.
- Keywords input with autocomplete from `User.keywords`.

### Shelf View Modes
- Shelves support display mode stored in `Shelf.extra.viewMode`: `grid`, `list`, `review`.
- `review` mode merges multiple reviews of the same work into tabs for information density.
- Created vs. collected filter on shelf item listing — derived from unit authorship at query time (no denormalized field on ShelfItem).

### External Unit Support (LINK type)
- New `Link` type extension: `{ unitId, url, siteName?, faviconUrl?, extra? }`.
- Title and description stored in `UnitTranslation` (consistent with all Unit types).
- LINK units are first-class: can be tagged (UnitTag), collected (ShelfItem), discussed (Post).

### Seed Content-Type Tags
- Database init seed creates Tag Units for core content types: `book`, `game`, `media`, `post`, `link`.
- These tags receive official score boost (high admin-set score).
- Frontend uses these as primary filter chips in the collection modal's shelf list.
- Users tag their shelves with these content-type tags to indicate what kind of items the shelf holds.

## Capabilities

### New Capabilities
- `shelf-collection`: Core collection system — Shelf replaces Bookmark, collection modal, favorites quick-save, review auto-collection via ShelfItemReview, dual collection mode for reviews, view modes, created/collected query-time filter
- `shelf-keywords`: Personal keyword system — ShelfItem.keywords for per-item annotation, User.keywords for autocomplete, keyword management API
- `type-extension-link`: LINK type extension for external URLs — Link model, UnitTranslation for title/description, first-class Unit participation
- `shelf-seed-tags`: Database seed for content-type tags — Tag Units for book/game/media/post/link, official score boost, frontend filter chip support

### Modified Capabilities
- `type-extension-shelf`: ShelfItem.reviewPostUnitId replaced by ShelfItemReview junction table. ShelfItem gains keywords field. Shelf.extra gains viewMode convention.

## Impact

### Affected Packages
- **`@rezics/server`**: New `shelf` domain (service, API, mapper, types) replacing combined readlist + bookmark logic. Bookmark model removed from Prisma schema. Reaction service bookmark coupling removed. New collection endpoints. User model updated with keywords field.
- **`@rezics/contract`**: New Shelf/ShelfItem/Collection DTOs and input types. BookmarkTagsResponse and related types removed. New LinkDTO and collection-related contracts.
- **`@rezics/api`**: New collection hooks (useCollect, useToggleFavorite, useCollectionStatus) and shelf query options replacing readlist and bookmark hooks.
- **`@rezics/app`**: Collection modal component replacing BookmarkTagManager. Favorites heart button on unit cards. Shelf view page with view mode switching and created/collected filter. Existing bookmark page (`/user/me/bookmark`) replaced by shelf-based collection view.
- **`@rezics/admin`**: Shelf management in admin panel.
- **`@rezics/search`**: LINK units added to content index. ShelfItem keywords indexed for user-scoped personal search.

### Dependencies
- **Depends on `unit-architecture`** (must be complete before this change begins): Requires the post-migration schema — Unit model with `visibility`, Shelf/ShelfItem base models (with `reviewPostUnitId` still present, which this change replaces), UnitTag scoring system, TagVote, Post model with `authorUserId`/`targetUnitId`/`kindKey`, UnitTranslation, Bookmark model still present (removed by this change).
- **Depends on `search-redesign`** (must be complete before this change begins): Requires the unified content index for LINK unit indexing and personal keyword search.
- **Answers unit-architecture open question 5**: "Bookmark.tags: Should bookmarks use the new UnitTag system, or remain a simple personal tagging mechanism?" — Answer: Neither. Bookmark is removed entirely; personal tagging becomes `ShelfItem.keywords`, fully separate from UnitTag.
- **Unit.visibility**: The `unit-architecture` design must include `visibility` on the Unit model (public/private/draft/unlisted). If not already present, this should be patched into that proposal.
- **Unit.creatorUserId**: The created/collected filter benefits from a universal `creatorUserId` on Unit. If unit-architecture does not provide this, the filter falls back to type-specific joins (Post.authorUserId, Attribution).

### Backward Compatibility
- **BREAKING**: No backward compatibility with existing Bookmark or ReadList APIs. Both are fully replaced by the Shelf collection system.
- Migration path: existing Bookmark rows → ShelfItems in user's auto-created Favorites shelf. Bookmark.tags → ShelfItem.keywords. Existing ReadLists → Shelves (already handled by unit-architecture migration).

### Migration
- Create Favorites shelf for all existing users.
- Migrate Bookmark rows to ShelfItems (target → itemUnitId, tags → keywords).
- Merge existing bookmark tags into User.keywords.
- Remove Bookmark model and reaction-bookmark coupling.
- Create seed Tag Units for content types.
- Drop deprecated bookmark API endpoints.
