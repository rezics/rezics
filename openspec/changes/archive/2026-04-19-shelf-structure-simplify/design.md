## Context

The current shelf system carries structural debt:

1. **`ShelfItem` mixes concerns.** `sortOrder`, `keywords[]`, `label`, `extra` conflate ordering, filtering, labeling, and metadata on one row. Drag/drop reorder requires N-row UPDATE transactions on `sortOrder`.
2. **`ShelfItemReview` is a third junction table for what amounts to "review ids attached to this shelf item".** Two tables worth of JOINs to render a shelf.
3. **`ShelfItem` forces a 1:1 FK to `Unit`, but is conceptually a composition** — a primary unit plus attached reviews plus per-item tags. The FK limits cascade flexibility and blocks frontend-driven rendering.
4. **The `all/created/collected` filter is semantically broken** — it classifies items by the viewer's userId, which is meaningless on non-owner shelves.
5. **Free-text `keywords: String[]`** on `ShelfItem` (plus a mirrored `User.keywords` vocabulary) cannot participate in tag search indexing and drifts from the unit-id-based tag system used elsewhere in the codebase.
6. **Shelf ↔ Unit membership reverse lookups are awkward** — "which shelves contain unit X", "which shelves attach review R", "which shelves carry tag T" have no clean home today and would need fan-out across multiple columns in any design that keeps those references inside `ShelfItem`.

Two earlier iterations of this design were discussed and rejected:

- **Iteration 1**: `Shelf.structure: Json` (author-curated tag list + ordered unit refs), `ShelfItem.data: Json` (per-item extras), generic `Unit.parentUnitId` rename. Rejected — abstract JSON containers lose type safety and native index support; generic column names drift toward mixed semantics.
- **Iteration 2**: `ShelfItem.reviewIds: String[] @db.Uuid` and `tagIds: String[] @db.Uuid` with GIN indexes. This moved away from JSON but still conflated `ShelfItem`'s role (shelf-local render) with reverse-lookup indexing, used GIN-on-uuid-array (heavy for single-value equality — the dominant reverse-lookup shape), and required a schema change plus a new GIN index per new ref kind.

The final design separates two distinct responsibilities into two models: `ShelfItem` stays as a utilitarian slot (render-only, no reverse-lookup indexes, shelf-local read path) and a new `ShelfUnit` junction carries the real shelf ↔ unit many-to-many with a `role` discriminator and B-tree reverse-lookup indexes.

## Goals / Non-Goals

**Goals:**

- Scope `ShelfItem` to shelf-local render only — carrying slot identity (`itemRef`), render discriminator (`kind`), ordering (`position`), and timestamps; no reverse indexes, no per-item unit-id arrays.
- Introduce `ShelfUnit` as the authoritative shelf↔unit m:m junction with a `role` discriminator and B-tree reverse-lookup indexes (`@@index([unitId])`, `@@index([unitId, role])`, `@@index([shelfUnitId, role])`).
- Replace integer `sortOrder` with fractional-index `position: String` so reorder becomes a single-row UPDATE.
- Drop `ShelfItemReview`; review attachments become `ShelfUnit` rows with `role='review'`.
- Drop `ShelfItem.keywords: String[]` (free-text) and `User.keywords` entirely; per-item tagging migrates to `ShelfUnit` rows with `role='tag'` (unit-id references).
- Remove the `ShelfItem → Unit` FK (no DB-level referential integrity on `itemRef`); hydrate via frontend batch calls using the denormalized `kind` discriminator.
- Remove the broken `all/created/collected` filter.
- Establish the frontend pattern: group by `kind`, batch-fetch via existing list APIs, seed per-item detail cache, then render.

**Non-Goals:**

- Renaming `Unit.workUnitId` / `@relation("WorkRelease")`. Specialized naming stays.
- A generic `UnitEdge(fromUnitId, toUnitId, role)` Unit self-reference junction. Each domain keeps its own junction.
- Adding list APIs for missing kinds (link/image/video/media/game). Items of kinds without a list endpoint render a generic card; endpoints are added as individual kinds need them.
- Large-shelf degradation strategy (threshold, feature reduction).
- Real-time collaborative shelf editing.
- DB-level FK on `ShelfItem.itemRef`. Referential integrity for the primary slot is application-level (orphan detection + author-triggered cleanup).

## Decisions

### 1. Specialization over abstraction

**Decision:** Every concrete concept gets its own typed column / typed relation / typed table. No generic `data: Json` container, no generic `parentUnitId` rename on `Unit`, no generic `UnitEdge` Unit self-reference junction.

**Rationale:**

- Modern Postgres NULL cost: 1 bit per column in the per-row NULL bitmap. Nullable specialized columns are effectively free.
- Specialized columns get specialized indexes. Typed tables get typed cascades. The planner sees the semantic and can plan precisely.
- Specialized names are self-documenting and match the codebase pattern (`Book`, `Game`, `Media`, `Shelf`, `UnitTag`, `RealmUnit`, `RealmMember` are all domain-specific extensions).

**Alternatives considered:**

- `ShelfItem.data: Json` with `{ review?, tag? }` shape. Rejected — loses native operators and forces JSON-path queries for reverse lookups.
- `ShelfItem.reviewIds` / `tagIds` as uuid arrays with GIN indexes. Rejected — see Decision 4.
- Rename `workUnitId` → `parentUnitId` to pre-generalize the hierarchy. Rejected — would invite stuffing multiple semantics into one column later, which defeats the planner.

### 2. Fractional indexing on `ShelfItem.position`

**Decision:** `position String @db.VarChar(64)` — a lexicographically-sortable fractional index key (base-62 encoding recommended). All ordering operations are single-row UPDATEs or INSERTs.

| Operation | Behavior |
|-----------|----------|
| Append | Generate a key after the last item's position. Single INSERT. |
| Prepend | Generate a key before the first item's position. Single INSERT. |
| Insert between | Generate a key between two adjacent items' positions. Single INSERT. |
| Drag/drop reorder | UPDATE one row's `position` to between its new neighbors. Single UPDATE. |
| Key-density exhaustion | When the generated key between two neighbors exceeds a threshold length (e.g. 16 chars), trigger an **n-reorder**: read N surrounding items (e.g. 50), redistribute positions evenly, UPDATE N rows in one transaction. |

**Index:** `@@index([shelfUnitId, position])` supports `ORDER BY position ASC` ranged reads for pagination.

**Ties:** If two concurrent inserts produce identical positions (rare — shelves are single-author), the composite PK `@@id([shelfUnitId, itemRef])` prevents duplicate items; for the same item, the later write wins. For distinct items with colliding positions, ties break by `createdAt` at render time.

**Alternatives considered:**

- Keep `sortOrder: Int`. Rejected — any insert-between requires rewriting all subsequent rows.
- Use a linked list (`prevItemRef`/`nextItemRef`). Rejected — reorder is cheap but reads require recursive CTE; pagination becomes complex.

### 3. `ShelfItem` is a utilitarian, render-only slot

**Decision:** `ShelfItem` carries exactly:

- `shelfUnitId` — which shelf
- `itemRef: String @db.Uuid` — primary unit pointer and slot identity, **no FK, no reverse-lookup index**
- `kind: String @db.VarChar(32)` — render discriminator written at slot creation
- `position: String @db.VarChar(64)` — fractional index
- `createdAt`, `updatedAt`

Indexes: **only** `@@index([shelfUnitId, position])`. No `@@index([itemRef])`. No GIN on any array.

Relations: `shelf Shelf @relation(...)` (FK, cascade from shelf delete). `shelfUnits ShelfUnit[]` (back-reference for per-slot traversal). No `unit Unit @relation(...)` — `itemRef` is a bare uuid.

**Rationale:**

- `ShelfItem` serves exactly one read path: "open shelf S → list its slots in position order". That path needs `(shelfUnitId, position)` and nothing else.
- All reverse-lookup queries ("which shelves contain unit X", "which shelves have review R as an attachment") are answered by `ShelfUnit`, not `ShelfItem`. Indexing `ShelfItem` for reverse lookups would duplicate information already indexed in `ShelfUnit`.
- `kind` is denormalized at write time so the shelf page can dispatch render components without hydrating the referenced Unit first; hydration is a separate batched step.
- External Unit deletion does **not** cascade into `ShelfItem`. The slot persists as an orphan (its `itemRef` points to a deleted Unit) until the author's next save triggers cleanup. This is the author-visible orphan UX.

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

### 4. `ShelfUnit` junction carries the real shelf ↔ unit m:m

**Decision:** Introduce a new model:

```prisma
model ShelfUnit {
  shelfUnitId String @db.Uuid
  itemRef     String @db.Uuid      // slot binding: which ShelfItem this row belongs to
  unitId      String @db.Uuid      // the Unit being referenced
  role        String @db.VarChar(32) // "primary" | "review" | "tag" | ...

  shelf Shelf     @relation(fields: [shelfUnitId], references: [unitId], onDelete: Cascade)
  slot  ShelfItem @relation(fields: [shelfUnitId, itemRef], references: [shelfUnitId, itemRef], onDelete: Cascade)
  unit  Unit      @relation(fields: [unitId], references: [id], onDelete: Cascade)

  @@id([shelfUnitId, itemRef, unitId, role])
  @@index([unitId])               // "unit U is in which shelves"
  @@index([unitId, role])         // "unit U as role X is in which shelves"
  @@index([shelfUnitId, role])    // "in shelf S, all rows of role X"
}
```

`Shelf.shelfUnits ShelfUnit[]` and `Unit.shelfUnits ShelfUnit[]` back-references give the relation full Prisma navigability from either side.

**Role vocabulary (initial):** `primary` (the slot's main unit), `review` (an attached review), `tag` (a per-item tag unit id). New roles added by string literal — no schema change.

**Write pattern for each operation:**

| Operation | Writes |
|-----------|--------|
| Add slot (collect a unit) | 1 INSERT into `ShelfItem` + 1 INSERT into `ShelfUnit(role='primary', unitId = itemRef)` |
| Attach review to existing slot | 1 INSERT into `ShelfUnit(role='review', unitId = reviewUnitId)` |
| Detach review | 1 DELETE from `ShelfUnit` matching `(shelfUnitId, itemRef, unitId=reviewUnitId, role='review')` |
| Set per-item tags | DELETE existing `ShelfUnit(role='tag')` rows for slot + INSERT new ones (or compute diff) in a single transaction |
| Remove slot | 1 DELETE of `ShelfItem` — cascades to every `ShelfUnit` row for that slot |
| Unit U deleted externally | `ShelfUnit` rows referencing U are cascade-deleted (FK). `ShelfItem.itemRef` is not FK-cascaded → if `U` was a slot's primary, the slot becomes an orphan (its `role='primary'` row is gone, rendering fails) → picked up by orphan cleanup UX |

**Read-time projection:** The shelf items endpoint reads `ShelfItem` slots plus the corresponding `ShelfUnit` rows for those slots (filtered by `itemRef IN (...)`) and projects `reviewIds: string[]` and `tagIds: string[]` per slot into the response. Authoritative storage remains `ShelfUnit`; the projection is a read-time convenience so the frontend sees a flat shape.

**Rationale:**

- B-tree on `(unitId)` is the tightest index for single-value equality — the dominant shape of reverse lookups. GIN on `uuid[]` has a larger footprint and more update overhead without winning on this shape.
- A single junction table uniformly covers primary, review, tag, and any future ref kind. Adding a new kind is a new role value — no new columns, no new indexes.
- Having `slot ShelfItem @relation(...)` cascade on slot delete gives clean cleanup semantics and keeps the slot as the unit of curation.
- Having `unit Unit @relation(...)` cascade on unit delete removes secondary attachment rows automatically. Primary-role rows are also removed, which is exactly what turns the surviving `ShelfItem` into an orphan — the intended author-visible UX.
- Both back-references (`Shelf.shelfUnits`, `Unit.shelfUnits`) give full Prisma type support for navigation in either direction.

**Alternatives considered:**

- Keep `ShelfItemReview` and add a parallel `ShelfItemTag`. Rejected — two junction tables instead of one; cost per additional ref kind is linear.
- Store attachments as uuid arrays on `ShelfItem` with GIN indexes. Rejected — see Iteration 2 in Context, and Decision 4 rationale above.
- Generic `UnitEdge` Unit self-reference junction. Rejected — a shelf↔unit m:m *could* be expressed as "Unit self-reference with role in {`shelf-primary`, `shelf-review`, ...}", but this mixes shelf semantics with every other Unit↔Unit relation in the codebase. Specialized `ShelfUnit` matches the pattern of `UnitTag`, `RealmUnit`, `RealmMember`.
- Drop `itemRef` from `ShelfItem` and make `ShelfUnit(role='primary')` the single source of truth for the primary unit. Rejected — `itemRef` is natural slot identity (one primary per slot per shelf is exactly what the PK enforces), and keeping it lets the shelf read path use `ShelfItem` alone for basic rendering when attachments aren't needed.

### 5. Cascade semantics and orphan UX

**Decision:**

| Event | Cascade |
|-------|---------|
| Delete `Shelf` | Cascade to all `ShelfItem` rows → cascade to all `ShelfUnit` rows |
| Delete `ShelfItem` | Cascade to all `ShelfUnit` rows for that slot |
| Delete `Unit` (external) | Cascade to all `ShelfUnit` rows referencing it (any role). **Does NOT cascade to `ShelfItem`** (no FK on `itemRef`). Slots whose primary unit was deleted survive as orphans. |

**Orphan UX:**

- The frontend hydrates by `kind` (batch list calls). If hydration returns no entity for a slot's `itemRef`, the slot is an orphan.
- Orphans are hidden from render. No error is shown.
- On the shelf author's next save action (add/remove/reorder/attach/detach/retag), the accumulated orphan `itemRef[]` is sent with the request and the backend deletes those `ShelfItem` rows.

**Rationale:** Author-triggered cleanup makes orphan resolution visible (author saw it, author confirmed it) without punishing readers who happen to load a shelf mid-deletion. The backend keeps the data until asked to remove it.

### 6. Composite primary key and uniqueness

**Decision:**

- `ShelfItem`: `@@id([shelfUnitId, itemRef])` — a primary unit can appear in a shelf at most once.
- `ShelfUnit`: `@@id([shelfUnitId, itemRef, unitId, role])` — a given (slot, unit, role) triple is unique. The same unit can appear in the same slot under multiple roles if that ever becomes meaningful (not currently used).

This matches the user-facing model: one slot per primary unit per shelf; arbitrary attachments per role within a slot.

### 7. Removal of shelf-level JSON structure

**Decision:** `Shelf.structure: Json` is **not** added. The Shelf model is unchanged except for the cascade implications of the new `ShelfUnit` junction.

```prisma
model Shelf {
  unitId    String @id @db.Uuid
  unit      Unit   @relation(fields: [unitId], references: [id], onDelete: Cascade)
  kindKey   String? @db.VarChar(64)
  extra     Json?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  items       ShelfItem[]
  shelfUnits  ShelfUnit[]
}
```

**Rationale:** Ordering lives on `ShelfItem.position`. Per-shelf tag vocabulary is not a feature. Community/author tags on a shelf itself go through the existing `UnitTag` mechanism (tagging the Shelf's Unit).

### 8. Frontend batch hydration pattern

**Decision:** After fetching a page of `ShelfItem[]` (with projected `reviewIds` / `tagIds` per slot), the frontend:

1. Groups slots by `kind`: `{ book: [ids...], review: [ids...], tag: [ids...], ... }`.
2. Issues one parallel list call per kind: `POST /book/list { ids }`, `POST /post/list { ids }`, `POST /tag/list { ids }`, etc.
3. For each returned entity, seeds the per-item detail cache: `queryClient.setQueryData(bookKeys.detail(id), data)` — reusable by detail pages, search, and other features.
4. Renders in `position` order, matching hydrated data by id. Slots whose primary hydration fails are hidden as orphans.

Attachments (`reviewIds`, `tagIds`) hydrate through the same mechanism — they are unit ids, grouped by their respective kinds and batched alongside the primary fetch.

### 9. Frontend-driven sorting

**Decision:** Three modes; all operate on loaded slots:

| Mode | Source | Notes |
|------|--------|-------|
| `manual` (default) | `ShelfItem.position` (lex order) | As returned by API |
| `time` | `ShelfItem.createdAt` (desc) | Pure client-side |
| `title` | Hydrated item title via `Intl.Collator(userLocale)` | Covers currently-loaded slots; expanding the set re-sorts |

Backend has **no** sort parameter.

### 10. Pagination

**Decision:** Default page size 100. Cursor-based on `position` (or offset+limit; both work with the `(shelfUnitId, position)` index).

Most shelves have well under 100 items and load in a single request. Large shelves paginate transparently.

## Risks / Trade-offs

- **[Dual-write consistency]** — A slot add writes both a `ShelfItem` row and a `ShelfUnit(role='primary')` row. These must happen in one transaction. `ShelfService.addItem` uses `prisma.$transaction` (or Prisma's nested writes). Mitigation: a compile-time assertion that slot mutations go through a single service function.
- **[Fractional-index key growth]** — Pathological cases (many sequential insert-between at the same gap) lengthen keys before n-reorder triggers. Starting threshold: rebalance when a newly-generated key would exceed 16 chars, covering 50 surrounding items. Tunable once we have usage data.
- **[Primary orphan accumulation]** — `itemRef` has no FK cascade. If an author never revisits a shelf after the referenced Unit is deleted, orphan `ShelfItem` rows linger. Acceptable — they're filtered on read and cleaned on next save. A background reconciliation job is out of scope.
- **[`kind` drift]** — `kind` is denormalized at write time. If a Post subtype changes (e.g. REVIEW → QUOTE), the slot's `kind` becomes stale. Rare in practice; worst case is the wrong card type rendered until the item is re-added.
- **[Write amplification for `tag` role]** — Setting tags for a slot replaces the entire role='tag' row set. At expected cardinality (0–10 tags) this is fine. A future optimization could diff instead of replace.
- **[No backend sort/filter]** — Frontend sorting means title sort only covers loaded items. Acceptable — the product UX for "sort 5,000 items by title" is degenerate anyway; we'd paginate-into-view first.
- **[Concurrent position conflicts]** — Two clients inserting at the same gap could pick colliding positions. Mitigated by composite PK on `(shelfUnitId, itemRef)` (distinct items can't duplicate) and `createdAt` tiebreak at render.
- **[Breaking schema change]** — No API backward compat. The migration is a single cutover; the frontend and backend ship together.

## Migration Plan

### Data Migration Steps

1. **Schema: add columns and model.**
   - On `ShelfItem`: add `itemRef String @db.Uuid`, `kind String @db.VarChar(32)`, `position String @db.VarChar(64)`. All initially populated via the data-migration script; not nullable in the final state.
   - Create the new `ShelfUnit` model with its composite PK and indexes.
2. **Backfill `ShelfItem.itemRef`.** `UPDATE ShelfItem SET itemRef = itemUnitId`.
3. **Backfill `ShelfItem.kind`.** JOIN to `Unit` (and `Post` where `Unit.type = POST`) to compute per row. Default to lowercased `Unit.type` for unmapped values.
4. **Backfill `ShelfItem.position`.** For each shelf, sort existing items by `(sortOrder ASC, createdAt ASC)` and assign evenly spaced fractional keys across the lex range.
5. **Backfill `ShelfUnit` primary rows.** For each `ShelfItem`, insert `ShelfUnit(shelfUnitId, itemRef, unitId = itemRef, role = 'primary')`.
6. **Backfill `ShelfUnit` review rows.** For each `ShelfItemReview` row, insert `ShelfUnit(shelfUnitId, itemRef = itemUnitId, unitId = reviewUnitId, role = 'review')`.
7. **Backfill `ShelfUnit` tag rows.** For each non-empty `ShelfItem.keywords[]`, attempt to resolve each keyword string to a Tag unit id. Resolved entries become `ShelfUnit(role='tag')` rows. Unresolved keywords are dropped; a count is reported.
8. **Drop columns/relations/tables.** `ShelfItem.sortOrder`, `ShelfItem.keywords`, `ShelfItem.label`, `ShelfItem.extra`, `ShelfItem.itemUnitId`, the FK relation from `ShelfItem` to `Unit`, the `shelfItemReviews` relation on `Unit`, the `ShelfItemReview` model, `User.keywords`.
9. **Recreate constraints & indexes.** New PK on `ShelfItem`: `@@id([shelfUnitId, itemRef])`. New index: `@@index([shelfUnitId, position])`. On `ShelfUnit`: PK `@@id([shelfUnitId, itemRef, unitId, role])`, indexes `@@index([unitId])`, `@@index([unitId, role])`, `@@index([shelfUnitId, role])`.
10. **Verify.** Row counts match. Sample render against old-vs-new. Orphan scan (slots whose `itemRef` has no Unit) for reporting.

### Rollback Strategy

This is a single-cutover migration. Rollback requires restoring `itemUnitId`, `sortOrder`, `keywords`, `label`, `extra`, the `ShelfItemReview` table, and `User.keywords` from backup, and dropping `ShelfUnit`. A DB snapshot before step 8 is the rollback point. The API/frontend ship with the schema change — rolling back the DB also requires reverting the application deploy.

## Open Questions

1. **`keywords → tagIds` mapping fidelity.** How many existing `keywords` strings resolve to real Tag units? A pre-migration audit (count of distinct keyword strings vs. matchable Tag titles) determines whether users perceive data loss.
2. **Fractional-index library vs. in-house.** JavaScript/TypeScript options exist (e.g. `fractional-indexing`). Decision before implementation: take a dependency or implement the ~50 lines of base-62 midpoint logic in-house.
3. **Shelf items response shape.** Two equivalent options: (a) per-slot projected arrays (`reviewIds: string[]`, `tagIds: string[]`) on each `ShelfItemDTO`, or (b) a sibling `attachments: ShelfUnitDTO[]` collection the frontend groups. (a) is simpler for the frontend but denormalizes on the wire; (b) matches storage exactly. Leaning toward (a) for ergonomics — decision finalized during contract updates.
4. **`ShelfUnit.role` as string vs enum.** String keeps the set open (no migration to add a role). Enum gives compile-time type safety. Leaning toward string + exported union type in `@rezics/contract` for type safety on the TS side.
