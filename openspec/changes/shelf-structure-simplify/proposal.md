## Why

The current Shelf architecture spans three Prisma models (`Shelf`, `ShelfItem`, `ShelfItemReview`) and overloads `ShelfItem` with mixed concerns: ordering (`sortOrder`), free-text tagging (`keywords[]`), labeling (`label`), and free-form metadata (`extra`). Drag/drop reorder requires N-row UPDATE transactions on `sortOrder`. The `all/created/collected` filter joins across Post domain boundaries using the viewer's userId, producing nonsensical results on non-owned shelves. `ShelfItem` forces a 1:1 FK to `Unit`, but conceptually a shelf item is a composition (primary unit plus attached reviews and per-item tags), not a single unit pointer.

This change collapses three tables to two with specialized columns, replaces integer `sortOrder` with a fractional-index string that turns reorder into a single-row UPDATE, and removes the `ShelfItem → Unit` FK so the frontend can render via a denormalized `kind` discriminator and hydrate items in batch. The design favors **specialization over abstraction** — concrete `reviewIds` and `tagIds` Postgres array columns replace the `ShelfItemReview` junction and the `keywords[]` free-text field, giving precise types, GIN-indexable reverse lookups, and low-overhead nulls. The `WorkRelease` self-relation on `Unit` is intentionally **not** renamed — preserving specialized column names is consistent with this change's philosophy.

## What Changes

- **BREAKING: Simplify `ShelfItem`** — remove `sortOrder: Int`, `keywords: String[]`, `label: String?`, `extra: Json?`, and the `itemUnitId` FK relation to `Unit`.
- **BREAKING: Add new `ShelfItem` columns** — `itemRef: String` (no FK, primary unit reference), `kind: String @db.VarChar(32)` (render discriminator), `position: String @db.VarChar(64)` (fractional index for ordering), `reviewIds: String[] @db.Uuid` (attached review unit ids), `tagIds: String[] @db.Uuid` (per-item tag unit ids).
- **BREAKING: Replace composite primary key** — from `@@id([shelfUnitId, itemUnitId])` to `@@id([shelfUnitId, itemRef])`.
- **BREAKING: Replace ordering index** — from `@@index([shelfUnitId, sortOrder])` to `@@index([shelfUnitId, position])`.
- **BREAKING: Delete `ShelfItemReview` model** — review attachments move to `ShelfItem.reviewIds: String[]`.
- **BREAKING: Remove `all/created/collected` filter** from the shelf items query — filtering on authorship via viewer userId is semantically broken.
- **BREAKING: Remove `keywords` query parameter and `sort` modes from backend** — sorting becomes frontend-driven on hydrated items.
- **BREAKING: Remove `User.keywords` vocabulary field** — no longer needed since ShelfItem no longer carries free-text keywords.
- **Add fractional indexing** — append, prepend, insert-between, and reorder are single-row operations. Collision-triggered n-reorder rebalances a local window when keys grow too dense.
- **Add GIN indexes** — on `ShelfItem.reviewIds` and `ShelfItem.tagIds` to support efficient reverse lookups ("which shelf items reference review X" / "which shelf items carry tag Y").
- **Backend returns thin rows** — `ShelfItem` responses carry `itemRef`, `kind`, `reviewIds`, `tagIds`, `position`, `createdAt` only. No Unit join, no hydrated detail.
- **Frontend batch hydration** — group items by `kind`, issue one list-API call per kind, seed per-item TanStack Query detail cache via `setQueryData` for cross-feature reuse.
- **Frontend-only sorting** — three modes: manual (API position order, default), time (ShelfItem.createdAt desc), title (hydrated title via `Intl.Collator(userLocale)`).
- **Default page size of 100** — most shelves load fully in one request.
- **Orphan handling** — items whose itemRef fails hydration are hidden during render; on the author's next save, orphaned refs are submitted for cleanup.

### Explicitly NOT Changed

- `Unit.workUnitId` / `@relation("WorkRelease")` is **preserved as-is**. Renaming to a generic `parentUnitId` was considered and rejected — specialized column names help indexing and reader comprehension, and modern Postgres makes nullable specialized columns effectively free.
- `Shelf.structure: Json` (proposed earlier) is **rejected**. Ordering lives entirely on `ShelfItem.position`; there is no Shelf-level JSON container for the item list.
- `ShelfItem.data: Json` (proposed earlier) is **rejected** in favor of specialized array columns (`reviewIds`, `tagIds`). JSONB path queries would have been required for reverse lookups; typed arrays get native GIN indexes.

## Capabilities

### New Capabilities

- `shelf-structure`: ShelfItem fractional-index ordering, itemRef without FK, orphan semantics, pagination by position.
- `shelf-item-kind`: ShelfItem schema — `kind` render discriminator, `reviewIds` and `tagIds` array columns, and their mapping from Unit type / Post subtype at write time.
- `shelf-batch-hydration`: Frontend grouping by kind, per-kind batch list calls, detail cache seeding, frontend-driven sorting, orphan detection and cleanup.

### Modified Capabilities

- `shelf-collection`: Collection flow rewrites — `collect`, `toggleFavorite`, and review auto-collection use `itemRef` + `kind` + `reviewIds`. Keywords merging and `User.keywords` side effects are removed.
- `type-extension-shelf`: ShelfItem schema requirements rewritten — specialized columns, no `data: Json`, no `ShelfItemReview` junction, no `Shelf.structure` field.
- `shelf-keywords`: All requirements removed — `ShelfItem.keywords: String[]` and `User.keywords: String[]` are both dropped. Per-item tagging migrates to `ShelfItem.tagIds: String[]` (unit-id references).

## Impact

- **`@rezics/server`** — Prisma schema migration (new columns, drop columns, drop `ShelfItemReview`, drop `User.keywords`, new GIN indexes). `ShelfService` rewrite for fractional indexing + new shape. `CollectionService` rewrite for `reviewIds`/`tagIds`. Data migration script for existing rows.
- **`@rezics/contract`** — New `ShelfItemKind` type. Updated `shelfItemDTOSchema`. Removed `shelfItemReviewDTOSchema`, `reorderShelfItemsSchema`, filter/sort/keyword query fields from `shelfItemsQuerySchema`. Updated `collectInputSchema` (no keywords).
- **`@rezics/api`** — Query key updates (no filter/sort keys). Batch hydration hook (`useShelfHydration`). Cache seeding via `setQueryData`. Mutations: `addItem`, `removeItem`, `reorderItem` (single-row UPDATE of position), `attachReview`, `detachReview`, `setItemTags`, `cleanupOrphans`.
- **`@rezics/app`** — `ShelfPage` refactor: remove filter chips, add sort-mode toggle (manual/time/title), kind-based rendering, integrate batch hydration, orphan hiding + cleanup-on-save. Update `ShelfItemCard` to new shape.
- **Backward compatibility** — Breaking schema change. Existing `ShelfItem` rows migrated: `sortOrder` → fractional `position`, `keywords` dropped (free-text, not mappable to unit ids deterministically), `ShelfItemReview` rows → `reviewIds` arrays, `label`/`extra` dropped. No API backward compatibility — all shelf endpoints change shape in a single cutover.
