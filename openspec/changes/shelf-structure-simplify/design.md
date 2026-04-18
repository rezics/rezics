## Context

The current shelf system carries structural debt:

1. **`ShelfItem` mixes concerns.** `sortOrder`, `keywords[]`, `label`, `extra` conflate ordering, filtering, labeling, and metadata on one row. Drag/drop reorder requires N-row UPDATE transactions.
2. **`ShelfItemReview` is a third junction table for what amounts to "review ids attached to this item".** A Postgres array column achieves the same semantics with one less table and one less JOIN.
3. **`ShelfItem` has a 1:1 FK to `Unit`, but is conceptually a composition** — a primary unit plus attached reviews plus per-item tags. Forcing `itemUnitId FK → Unit` limits cascade behavior and blocks frontend-driven rendering.
4. **`all/created/collected` filter is semantically broken** — it classifies items using the viewer's userId, which is meaningless on non-owner shelves.
5. **Free-text `keywords: String[]`** on `ShelfItem` (and mirrored `User.keywords` vocabulary) cannot participate in tag search indexing and drifts from the unit-id-based tag system used elsewhere in the codebase.

A prior iteration of this design proposed `Shelf.structure: Json` (author-curated tag list + ordered unit refs), `ShelfItem.data: Json` (per-item extras), and a generic `Unit.parentUnitId` rename. All three were rejected in discussion: abstract JSON containers lose type safety and native index support, and generic column names drift toward mixed semantics which hurt query planning. The final design is uniformly specialized — typed columns, typed arrays, no JSON-as-container, no speculative renames.

## Goals / Non-Goals

**Goals:**

- Reduce shelf Prisma models from 3 to 2 (drop `ShelfItemReview`).
- Replace integer `sortOrder` with fractional-index `position: String` so reorder becomes a single-row UPDATE.
- Replace `ShelfItemReview` junction with `ShelfItem.reviewIds: String[] @db.Uuid` + GIN index.
- Replace `ShelfItem.keywords: String[]` (free-text) with `ShelfItem.tagIds: String[] @db.Uuid` (unit-id refs) + GIN index. Drop `User.keywords` entirely.
- Remove the `ShelfItem → Unit` FK; hydrate via frontend batch calls using the denormalized `kind` discriminator.
- Remove the broken `all/created/collected` filter.
- Establish the frontend pattern: group by `kind`, batch-fetch via existing list APIs, seed per-item detail cache, then render.

**Non-Goals:**

- Renaming `Unit.workUnitId` / `@relation("WorkRelease")`. Specialized naming stays.
- A generic `UnitEdge` or `ShelfStructure` JSON abstraction. Each domain keeps its own junction with its own columns.
- Adding list APIs for missing kinds (link/image/video/media/game). Items of kinds without a list endpoint render a generic card; endpoints are added as individual kinds need them.
- Large-shelf degradation strategy (threshold, feature reduction).
- Real-time collaborative shelf editing.
- DB-level FK on `ShelfItem.itemRef`. Referential integrity for shelf items is application-level (orphan detection + author-triggered cleanup).

## Decisions

### 1. Specialization over abstraction

**Decision:** Every per-item extra becomes a typed column on `ShelfItem` — no generic `data: Json` container, no generic `parentUnitId` rename on `Unit`.

**Rationale:**

- Modern Postgres NULL cost: 1 bit per column in the per-row NULL bitmap. Nullable specialized columns are effectively free.
- Specialized columns get specialized indexes. The planner sees the semantic and can plan precisely. Generic columns force composite indexes or JSON path operators, both of which hurt estimates and plans.
- Specialized names are self-documenting. `reviewIds` and `tagIds` say what they are; `data.review[]` requires discovery.
- Specialized naming is the existing codebase pattern (`Book`, `Game`, `Media`, `Shelf`, etc. are all type-specific extensions of `Unit` with dedicated columns).

**Alternatives considered:**

- `ShelfItem.data: Json` with `{ review?, tag? }` shape. Rejected — loses native array operators, forces GIN-on-whole-document indexing, and reverse lookups ("which items reference review X") become expensive JSON path queries.
- Rename `workUnitId` → `parentUnitId` to pre-generalize the hierarchy. Rejected — would invite stuffing multiple semantics into one column later, which defeats the planner. Keep `workUnitId` specialized; if a second kind of unit hierarchy is ever needed, add a separate specialized column.

### 2. Fractional indexing on `ShelfItem.position`

**Decision:** `position String @db.VarChar(64)` — a lexicographically-sortable fractional index key (base-62 encoding recommended). All ordering operations are single-row UPDATEs or INSERTs.

| Operation | Behavior |
|-----------|----------|
| Append | Generate a key after the last item's position. Single INSERT. |
| Prepend | Generate a key before the first item's position. Single INSERT. |
| Insert between | Generate a key between two adjacent items' positions. Single INSERT. |
| Drag/drop reorder | UPDATE one row's `position` to between its new neighbors. Single UPDATE. |
| Key-density exhaustion | When the generated key between two neighbors exceeds a threshold length (e.g. 16 chars), trigger an **n-reorder**: read N surrounding items (e.g. 50), redistribute positions evenly, UPDATE N rows in one transaction. Rare under normal usage. |

**Index:** `@@index([shelfUnitId, position])` supports `ORDER BY position ASC` ranged reads for pagination.

**Ties:** If two concurrent inserts produce identical positions (rare — shelves are single-author), the composite PK `@@id([shelfUnitId, itemRef])` prevents duplicate items; for the same item, the later write wins. For distinct items with colliding positions, ties break by `createdAt` at render time.

**Alternatives considered:**

- Keep `sortOrder: Int`. Rejected — any insert-between requires rewriting all subsequent rows.
- Use a linked list (`prevItemRef`/`nextItemRef`). Rejected — reorder is cheap but reads require recursive CTE; pagination becomes complex.

### 3. `ShelfItem.itemRef` — denormalized, no FK

**Decision:** `itemRef: String @db.Uuid` replaces `itemUnitId` with **no** `@relation` to `Unit`. A `kind` discriminator (`String @db.VarChar(32)`) is written at the same time.

**Rationale:**

- A `ShelfItem` is conceptually a composition (primary unit + attached reviews + per-item tags). The FK to Unit was a convenience for JOINs, not a correctness requirement.
- Frontend renders cards from `kind` alone without first fetching the Unit row. Hydration is a separate batched step.
- External Unit deletion should not implicitly mutate shelves. Deletion is handled by author-triggered orphan cleanup, which is visible and reversible before save.

**`kind` derivation at write time:**

| Source | Kind |
|--------|------|
| `Unit.type = BOOK` | `book` |
| `Unit.type = POST` AND `Post.kind = REVIEW` | `review` |
| `Unit.type = POST` AND `Post.kind = QUOTE` | `quote` |
| `Unit.type = POST` (other) | `post` |
| `Unit.type = TAG` | `tag` |
| `Unit.type = REALM` | `realm` |
| `Unit.type = LINK` | `link` |
| `Unit.type = IMAGE` / `VIDEO` / `MEDIA` / `GAME` / `CHAPTER` | lowercased type string |
| Unknown | lowercased `Unit.type` as fallback |

### 4. `reviewIds` and `tagIds` as Postgres uuid arrays

**Decision:**

```prisma
reviewIds String[] @db.Uuid @default([])
tagIds    String[] @db.Uuid @default([])
```

GIN indexes on both:

```prisma
@@index([reviewIds], type: Gin)
@@index([tagIds], type: Gin)
```

**Semantics:**

- `reviewIds` replaces the `ShelfItemReview` junction table. A ShelfItem for "War and Peace" in a shelf can have `reviewIds = [reviewA, reviewB]` meaning both reviews are attached to this slot.
- `tagIds` replaces `ShelfItem.keywords`. Values are unit ids of Tag units, not free-text.
- Reverse lookup ("which ShelfItems reference review X") uses `WHERE reviewIds @> ARRAY[X]::uuid[]` against the GIN index. Same for tags.
- Cardinality per item is small (0–10 typical). Updates are full-array rewrites, which is fine at this cardinality.

**Alternatives considered:**

- Keep `ShelfItemReview` junction. Rejected — extra table, extra JOIN, no gain over an array at expected cardinality.
- Store review ids in `data: Json`. Rejected — see Decision 1.

### 5. Composite primary key and unique constraint

**Decision:** `@@id([shelfUnitId, itemRef])`. The primary unit can appear in a shelf at most once. Multiple reviews of the same book in the same shelf collapse into one ShelfItem row with `reviewIds = [r1, r2, ...]`.

This matches the user-facing model: one "slot" per primary unit per shelf.

### 6. Removal of shelf-level JSON structure

**Decision:** `Shelf.structure: Json` is **not** added. The Shelf model is unchanged except for the cascade implications of removing `ShelfItemReview`.

```prisma
model Shelf {
  unitId    String   @id @db.Uuid
  unit      Unit     @relation(fields: [unitId], references: [id], onDelete: Cascade)
  kindKey   String?  @db.VarChar(64)
  coverUrl  String?
  extra     Json?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  items     ShelfItem[]
}
```

**Rationale:** With `ShelfItem.position` carrying ordering, and with no author-curated per-shelf tag vocabulary in the final design, there is nothing for `structure` to hold. Community/author tags on a shelf itself go through the existing `UnitTag` mechanism (tagging a Shelf's Unit).

### 7. Frontend batch hydration pattern

**Decision:** After fetching a page of `ShelfItem[]`, the frontend:

1. Groups items by `kind`: `{ book: [ids...], review: [ids...], tag: [ids...], ... }`.
2. Issues one parallel list call per kind: `POST /book/list { ids }`, `POST /post/list { ids }`, `POST /tag/list { ids }`, etc.
3. For each returned entity, seeds the per-item detail cache: `queryClient.setQueryData(bookKeys.detail(id), data)` — reusable by detail pages, search, and other features.
4. Renders in `position` order, matching hydrated data by id. Items whose hydration fails (404 from the list endpoint) are hidden.

**Orphan cleanup:** Hidden orphan itemRefs are tracked in frontend state. On the author's next save of any kind (add, remove, reorder, retag), the orphan list is sent with the request and the backend deletes those ShelfItem rows.

### 8. Frontend-driven sorting

**Decision:** Three modes; all operate on loaded items:

| Mode | Source | Notes |
|------|--------|-------|
| `manual` (default) | `ShelfItem.position` (lex order) | As returned by API |
| `time` | `ShelfItem.createdAt` (desc) | Pure client-side |
| `title` | Hydrated item title via `Intl.Collator(userLocale)` | Covers currently-loaded items; expanding the set re-sorts |

Backend has **no** sort parameter.

### 9. Pagination

**Decision:** Default page size 100. Cursor-based on `position` (or offset+limit; both work with the `(shelfUnitId, position)` index).

Most shelves have well under 100 items and load in a single request. Large shelves paginate transparently.

## Risks / Trade-offs

- **[Fractional-index key growth]** → In pathological cases (many sequential insert-between at the same gap), keys lengthen before n-reorder triggers. Starting threshold: rebalance when a newly-generated key would exceed 16 chars, covering 50 surrounding items. Tunable once we have usage data.
- **[Orphan-ref accumulation]** → `itemRef` has no FK cascade. If an author never revisits a shelf after the referenced Unit is deleted, orphan ShelfItem rows linger. Acceptable — they're filtered out on read and cleaned on next save. A background reconciliation job is out of scope.
- **[`reviewIds` / `tagIds` orphan refs]** → Same shape of problem as itemRef, same application-level cleanup. GIN reverse lookup makes it cheap to find impacted items when a Unit is deleted (if we later want a reconciliation job).
- **[`kind` drift]** → `kind` is denormalized at write time. If a Post subtype changes (e.g. REVIEW → QUOTE), the ShelfItem's kind becomes stale. Rare in practice; worst case is the wrong card type rendered until the item is re-added.
- **[No backend sort/filter]** → Frontend sorting means title sort only covers loaded items. Acceptable — the product UX for "sort 5,000 items by title" is degenerate anyway; we'd paginate-into-view first.
- **[Concurrent position conflicts]** → Two clients inserting at the same gap could pick colliding positions. Mitigated by composite PK on `itemRef` (different items can't clash on `itemRef`; same item can't duplicate) and by `createdAt` tiebreak at render.
- **[Breaking schema change]** → No API backward compat. The migration is a single cutover; the frontend and backend ship together.

## Migration Plan

### Data Migration Steps

1. **Schema: add columns.** `ShelfItem.itemRef String @db.Uuid`, `ShelfItem.kind String @db.VarChar(32)`, `ShelfItem.position String @db.VarChar(64)`, `ShelfItem.reviewIds String[] @db.Uuid @default([])`, `ShelfItem.tagIds String[] @db.Uuid @default([])`. All initially populated via the data-migration script; none nullable in the final state (except via `@default([])` for arrays).
2. **Backfill `itemRef`.** `UPDATE ShelfItem SET itemRef = itemUnitId`.
3. **Backfill `kind`.** JOIN to `Unit` (and `Post` where `Unit.type = POST`) to compute per row. Default to lowercased `Unit.type` for unmapped values.
4. **Backfill `position`.** For each shelf, sort existing items by `(sortOrder ASC, createdAt ASC)` and assign evenly spaced fractional keys across the lex range.
5. **Backfill `reviewIds`.** `UPDATE ShelfItem si SET reviewIds = ARRAY(SELECT reviewUnitId FROM ShelfItemReview WHERE shelfUnitId = si.shelfUnitId AND itemUnitId = si.itemUnitId)::uuid[]`.
6. **Backfill `tagIds`.** For each non-empty `keywords` array, attempt to resolve each keyword string to a Tag unit id. Unresolved keywords are dropped — free-text keywords were never FK-backed. Record a count for reporting.
7. **Drop columns/relations/tables.** `ShelfItem.sortOrder`, `ShelfItem.keywords`, `ShelfItem.label`, `ShelfItem.extra`, `ShelfItem.itemUnitId`, the FK relation from `ShelfItem` to `Unit`, the `shelfItemReviews` relation on `Unit`, the `ShelfItemReview` model, `User.keywords`.
8. **Recreate constraints & indexes.** New PK `@@id([shelfUnitId, itemRef])`. New indexes: `@@index([itemRef])`, `@@index([shelfUnitId, position])`, GIN on `reviewIds`, GIN on `tagIds`.
9. **Verify.** Row counts match. Sample render against old-vs-new. Orphan scan (items whose `itemRef` has no Unit) for reporting.

### Rollback Strategy

This is a single-cutover migration. Rollback requires restoring `itemUnitId`, `sortOrder`, `keywords`, `label`, `extra`, and the `ShelfItemReview` table from backup. Because drops happen in step 7, a DB snapshot before step 7 is the rollback point. The API/frontend ship with the schema change — rolling back the DB also requires reverting the application deploy.

## Open Questions

1. **`keywords → tagIds` mapping fidelity.** How many existing `keywords` strings resolve to real Tag units? A pre-migration audit (count of distinct keyword strings vs. matchable Tag titles) determines whether users perceive data loss. If matches are low, a user-facing notice may be warranted.
2. **Fractional-index library vs. in-house.** JavaScript/TypeScript options exist (e.g. `fractional-indexing`). Decision before implementation: take a dependency or implement the ~50 lines of base-62 midpoint logic in-house.
3. **GIN index on `@db.Uuid[]`.** Confirm Prisma generates the correct DDL for `@@index([reviewIds], type: Gin)` on a uuid array; if not, the migration script supplements with raw SQL.
