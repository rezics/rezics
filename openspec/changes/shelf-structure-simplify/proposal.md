## Why

The current Shelf architecture spans three Prisma models (`Shelf`, `ShelfItem`, `ShelfItemReview`) and overloads `ShelfItem` with mixed concerns: ordering (`sortOrder`), free-text tagging (`keywords[]`), labeling (`label`), and free-form metadata (`extra`). Drag/drop reorder requires N-row UPDATE transactions on `sortOrder`. The `all/created/collected` filter joins across Post domain boundaries using the viewer's userId, producing nonsensical results on non-owned shelves. The `ShelfItem → Unit` FK forces a 1:1 view even though a shelf slot is conceptually a composition (primary unit plus attached reviews plus per-item tags), and reverse lookups ("which shelves contain this unit / this review / this tag") get scattered across multiple columns.

This change splits two responsibilities into two models:

1. **`ShelfItem` becomes a purely utilitarian slot** — it serves shelf-local render only. It carries slot identity (`itemRef` as the primary unit pointer), the render discriminator (`kind`), ordering (`position`), and timestamps. It holds no reverse-lookup indexes and no per-item unit-id arrays. `ShelfItem` is never consulted for "which shelves contain unit X" style queries.
2. **`ShelfUnit` is a new m:m junction** between `Shelf` and `Unit` with a `role` discriminator (`primary | review | tag | ...`). It is the single source of truth for shelf ↔ unit membership. All reverse-lookup indexes live here. Both `Shelf` and `Unit` gain a `shelfUnits` back-reference, making the relation Prisma-navigable from either side.

The reorder problem is solved by replacing integer `sortOrder` with a fractional-index string. The `WorkRelease` self-relation on `Unit` is intentionally **not** renamed — specialized column names remain consistent with this change's philosophy.

## What Changes

**Prisma schema**

- **BREAKING: Slim `ShelfItem`** — remove `sortOrder: Int`, `keywords: String[]`, `label: String?`, `extra: Json?`, the `itemUnitId` column, and the FK relation to `Unit`.
- **BREAKING: Add minimal `ShelfItem` columns** — `itemRef: String @db.Uuid` (slot identity + primary unit pointer, **no** FK, **no** reverse-lookup index), `kind: String @db.VarChar(32)` (render discriminator), `position: String @db.VarChar(64)` (fractional index), `createdAt`, `updatedAt`. No `reviewIds` or `tagIds` arrays.
- **BREAKING: Replace composite primary key** — from `@@id([shelfUnitId, itemUnitId])` to `@@id([shelfUnitId, itemRef])`.
- **BREAKING: Replace ordering index** — from `@@index([shelfUnitId, sortOrder])` to `@@index([shelfUnitId, position])`.
- **BREAKING: No `@@index([itemRef])`** — ShelfItem does not serve reverse queries; reverse-lookup indexes live on `ShelfUnit` only.
- **NEW: Add `ShelfUnit` model** — columns `shelfUnitId`, `itemRef` (slot binding), `unitId`, `role`. Composite PK `@@id([shelfUnitId, itemRef, unitId, role])`. FK relations to `Shelf`, to `ShelfItem` via composite `(shelfUnitId, itemRef)`, and to `Unit`. All three relations cascade on delete.
- **NEW: Back-references on both sides** — `Shelf.shelfUnits ShelfUnit[]` and `Unit.shelfUnits ShelfUnit[]`. `ShelfItem.shelfUnits ShelfUnit[]` for per-slot traversal.
- **NEW: ShelfUnit indexes** — `@@index([unitId])` (general reverse), `@@index([unitId, role])` (typed reverse), `@@index([shelfUnitId, role])` (in-shelf role filter).
- **BREAKING: Delete `ShelfItemReview` model** — review attachments become `ShelfUnit` rows with `role = 'review'`.
- **BREAKING: Remove `User.keywords` field** — no longer referenced.

**API surface**

- **BREAKING: Remove `all/created/collected` filter** from the shelf items query — filtering by viewer userId is semantically broken.
- **BREAKING: Remove `keywords` query parameter and `sort` modes from backend** — sorting becomes frontend-driven.
- **Add fractional indexing** — append, prepend, insert-between, and reorder are single-row operations. Collision-triggered n-reorder rebalances a local window when keys grow too dense.
- **Backend returns thin rows** — the shelf items endpoint returns `ShelfItem` slots (`itemRef`, `kind`, `position`, `createdAt`) together with a sibling `attachments` projection that groups `ShelfUnit` rows by `(itemRef, role)` so the frontend can read per-slot `reviewIds` / `tagIds` without a second round-trip. The authoritative storage is always `ShelfUnit`; the projection is a read-time convenience.
- **Frontend batch hydration** — group items by `kind`, issue one list-API call per kind, seed per-item TanStack Query detail cache via `setQueryData` for cross-feature reuse.
- **Frontend-only sorting** — three modes: manual (API position order), time (`createdAt` desc), title (hydrated title via `Intl.Collator`).
- **Default page size of 100** — most shelves load fully in one request.
- **Orphan handling** — items whose `itemRef` fails hydration are hidden during render; on the author's next save, orphaned refs are submitted for cleanup.

### Explicitly NOT Changed

- `Unit.workUnitId` / `@relation("WorkRelease")` preserved as-is. A generic `parentUnitId` rename was considered and rejected.
- `Shelf.structure: Json` not added. Ordering lives entirely on `ShelfItem.position`.

### Explicitly Rejected Alternatives

- **`ShelfItem.reviewIds: String[] @db.Uuid` / `tagIds: String[] @db.Uuid` with GIN indexes** (from a prior iteration of this change). Rejected — (a) conflates `ShelfItem`'s render-only role with reverse-lookup indexing; (b) GIN-on-uuid-array is heavier than B-tree for single-value equality, the dominant reverse-lookup shape; (c) scaling to new ref kinds (e.g. contributors, annotations) requires a schema change and a new GIN index each time. `ShelfUnit` with a `role` column achieves the same coverage with uniform B-tree indexes and is extensible via new role values.
- **Generic `UnitEdge(fromUnitId, toUnitId, role)` Unit self-reference junction**. Rejected — `Shelf` is a Unit type-extension, so a shelf↔unit m:m can be expressed as a Unit self-reference. But that conflicts with the codebase's specialization-over-abstraction principle already established by `UnitTag`, `RealmUnit`, `RealmMember`, and all `type-extension-*` tables. Domain-specific `ShelfUnit` keeps the `role` vocabulary scoped and avoids cross-domain index contention.

## Capabilities

### New Capabilities

- `shelf-structure`: ShelfItem fractional-index ordering, itemRef as slot identity with no FK, ShelfItem as utilitarian render-only model with no reverse-lookup indexes, orphan semantics, pagination by position.
- `shelf-item-kind`: ShelfItem `kind` render discriminator — value set, derivation from Unit type / Post subtype at write time.
- `shelf-unit-junction`: `ShelfUnit` m:m junction — role-discriminated shelf↔unit membership, reverse-lookup indexes, write-dual with ShelfItem on slot add, attach/detach semantics for `review` and `tag` roles, cascade rules.
- `shelf-batch-hydration`: Frontend grouping by kind, per-kind batch list calls, detail cache seeding, frontend-driven sort modes, orphan detection and cleanup.

### Modified Capabilities

- `shelf-collection`: Collection flow rewrites — `collect`, `toggleFavorite`, and review auto-collection use `itemRef` + `kind` on the slot, plus `ShelfUnit` rows with `role='review'` or `role='tag'` for attachments. Keywords merging and `User.keywords` side effects removed.
- `type-extension-shelf`: ShelfItem schema requirements rewritten — minimal columns, no `data: Json`, no `reviewIds/tagIds` arrays, no `ShelfItemReview` junction, no `Shelf.structure` field. Adds the `ShelfUnit` model requirements.
- `shelf-keywords`: All requirements removed — `ShelfItem.keywords: String[]` and `User.keywords: String[]` dropped. Per-item tagging migrates to `ShelfUnit` rows with `role = 'tag'` (unit-id references).

## Impact

- **`@rezics/server`** — Prisma schema migration (slim `ShelfItem`, new `ShelfUnit`, drop `ShelfItemReview`, drop `User.keywords`). `ShelfService` rewrite with fractional indexing and dual-write pattern (slot INSERT + `ShelfUnit` `role='primary'` INSERT in one transaction). `CollectionService` rewrite using `ShelfUnit` rows for reviews/tags. Data migration script mapping existing rows.
- **`@rezics/contract`** — New `ShelfItemKind` type, new `ShelfUnitRole` type, new `shelfUnitDTOSchema`. Updated `shelfItemDTOSchema` (slim slot + derived `reviewIds` / `tagIds` arrays for read convenience). Removed `shelfItemReviewDTOSchema`, `reorderShelfItemsSchema`, filter/sort/keyword query fields from `shelfItemsQuerySchema`. Updated `collectInputSchema`.
- **`@rezics/api`** — Query key updates. Batch hydration hook (`useShelfHydration`). Cache seeding via `setQueryData`. Mutations: `addItem`, `removeItem`, `reorderItem` (single-row UPDATE of position), `attachReview`, `detachReview`, `setItemTags`, `cleanupOrphans`.
- **`@rezics/app`** — `ShelfPage` refactor: remove filter chips, add sort-mode toggle, kind-based rendering, integrate batch hydration, orphan hiding + cleanup-on-save. `ShelfItemCard` adapts to new shape.
- **Backward compatibility** — Breaking schema change. Existing rows migrated: `sortOrder` → `position`, `keywords` dropped or mapped to `ShelfUnit` `role='tag'` where resolvable to an existing Tag unit, `ShelfItemReview` rows → `ShelfUnit` `role='review'`, `label`/`extra` dropped. No API backward compatibility — single cutover.
