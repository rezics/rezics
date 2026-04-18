## Why

The current Shelf architecture mixes concerns across three tables (`Shelf`, `ShelfItem`, `ShelfItemReview`) and multiple column types (`sortOrder`, `keywords[]`, `label`, `extra`). Ordering requires N row UPDATEs for drag/drop. The `all/created/collected` filter is semantically broken for non-owner viewers. Tags use free-text `keywords: string[]` instead of proper unitId references. This complexity slows feature development and creates confusing query patterns that reach across domain boundaries.

## What Changes

- **Add `structure: Json` to Shelf** — stores author-curated tag subset and ordered item reference list. Tag ids sync with `unitTags` for search indexing; unit ids define manual sort order.
- **BREAKING: Simplify ShelfItem** — remove `sortOrder`, `keywords[]`, `label`, `extra` columns. Add `kind: ShelfItemKind` (render discriminator) and `data: Json?` (per-item structured extras like attached reviews and tags).
- **BREAKING: Remove ShelfItem → Unit FK** — `itemRef` replaces `itemUnitId` as a plain string. Frontend hydrates via batch list queries grouped by kind, no backend join needed.
- **BREAKING: Delete `ShelfItemReview` table** — review attachments collapse into `ShelfItem.data.review: [reviewUnitId, ...]`.
- **BREAKING: Remove `all/created/collected` filter** — replaced by frontend-driven tag/title filtering.
- **Add batch cache seeding** — frontend splits list query results into per-item TanStack Query cache entries via `setQueryData` for cross-feature reuse.
- **Frontend-only title sorting** — uses `Intl.Collator(userLocale)` on hydrated items. Manual and time-based sorting also supported.
- **Default page size of 100** — most shelves load fully in one request.

## Capabilities

### New Capabilities
- `shelf-structure`: Shelf JSON structure field (tag vocabulary + ordered unit list) and its consistency model with ShelfItem rows and unitTags.
- `shelf-item-kind`: ShelfItemKind enum and render discriminator contract between backend and frontend.
- `shelf-batch-hydration`: Frontend pattern for grouping shelf items by kind, batch-fetching via existing list APIs, and seeding per-item cache.

### Modified Capabilities
- `shelf-collection`: Collection flow changes — collect/toggleFavorite must write to both ShelfItem and Shelf.structure in a transaction; review attachment moves from ShelfItemReview to ShelfItem.data.
- `type-extension-shelf`: Shelf Prisma model changes — new `structure` column, removal of ShelfItemReview relation.

## Impact

- **`@rezics/server`** — Prisma schema migration (add `structure`, add `kind`/`data` to ShelfItem, drop `ShelfItemReview`, drop columns). ShelfService and CollectionService rewrite. Migration script to convert existing data.
- **`@rezics/contract`** — New `ShelfItemKind` enum, updated ShelfItem DTO, new Shelf structure typebox schema, remove ShelfItemReview types, remove filter/sort query types.
- **`@rezics/api`** — Query key updates, batch hydration utilities, cache seeding pattern, remove filter/sort params from shelf queries.
- **`@rezics/app`** — ShelfPage refactor (remove filter chips, kind-based rendering, frontend sorting via Intl.Collator, pagination at 100).
- **Backward compatibility** — This is a breaking schema change requiring a data migration. Existing ShelfItem rows must be converted (sortOrder → structure.units ordering, keywords → data.tag, ShelfItemReview → data.review). No API backward compatibility — all shelf endpoints change shape.
