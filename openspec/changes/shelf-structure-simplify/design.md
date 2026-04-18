## Context

The Shelf system currently uses three Prisma models (`Shelf`, `ShelfItem`, `ShelfItemReview`) with ShelfItem carrying mixed concerns: ordering (`sortOrder`), free-text tagging (`keywords[]`), presentation (`label`, `extra`), and a FK to Unit (`itemUnitId`). The `all/created/collected` filter joins across Post domain boundaries using the viewer's userId, producing nonsensical results on non-owned shelves.

This design simplifies the architecture to two models with clear separation: Shelf owns the structural layout (ordering + tag vocabulary) via a JSON column, while ShelfItem serves as the M:M index edge plus per-item structured data. The Unit FK is removed to give the frontend full rendering control via a `kind` discriminator.

## Goals / Non-Goals

**Goals:**
- Reduce Shelf models from 3 to 2 (drop `ShelfItemReview`)
- Move ordering from per-row `sortOrder` to a single JSON array on Shelf
- Replace free-text `keywords[]` with unitId-based tag references
- Decouple ShelfItem from Unit FK; add `kind` field for frontend rendering
- Remove the broken `all/created/collected` filter
- Establish batch hydration pattern: frontend groups items by kind, fetches via existing list APIs, seeds TanStack Query cache

**Non-Goals:**
- Large shelf degradation strategy (threshold, feature reduction) — deferred
- Adding list APIs for missing types (link, image, video, media, game) — added as needed
- Changing how community tags (unitTags) work on Shelf's Unit — existing mechanism stays
- Real-time collaboration on shelf editing

## Decisions

### 1. JSON `structure` field on Shelf

**Decision**: Add `structure Json @default("{}")` to the Shelf model.

**Shape**:
```typescript
interface ShelfStructure {
  tag: string[];    // tagUnitId[] — author-curated subset, synced with unitTags
  units: string[];  // itemRef[] — ordered list, defines manual sort
}
```

**Why not a separate table for ordering**: A separate `ShelfOrder` table or `sortOrder` column requires N writes for drag/drop. JSON rewrite is atomic — one UPDATE replaces the entire order. For shelves under 1000 items (99%+ of cases), the JSON payload is well under 100KB.

**Why not put per-item data in this JSON**: Per-item data (reviews, tags) changes independently from ordering. Embedding it in the shelf-level JSON creates write contention (editing one item's reviews requires locking the entire shelf structure). Keeping per-item data in ShelfItem rows isolates writes.

### 2. ShelfItem FK removal

**Decision**: Rename `itemUnitId` to `itemRef: String`. Drop the FK constraint to Unit. Add `kind: String @db.VarChar(32)` as a denormalized render discriminator.

**Alternatives considered**:
- Keep FK, add `kind` as denormalized column → still requires Unit join for hydration, limits flexibility
- Keep FK, derive kind from Unit.type at query time → N+1 join, defeats simplification goal

**Why remove FK**:
- Frontend renders via `kind` without fetching Unit first
- Batch hydration via list APIs is the designated data path
- No cascade on Unit delete — frontend detects orphans and cleans up on commit
- Opens future possibility for non-Unit items (though not in current scope)

**ShelfItemKind values** (determined at write time):
```
book | review | quote | post | chapter | tag | realm | image | video | media | game | link
```

Mapping: `Unit.type` maps directly for most types. For `POST`, the `Post.kind` subtype determines: `REVIEW → review`, `QUOTE → quote`, otherwise `post`.

### 3. ShelfItem.data JSON for per-item extras

**Decision**: Add `data Json?` (default null) to ShelfItem.

**Shape**:
```typescript
interface ShelfItemData {
  review?: string[];  // reviewUnitId[] attached to this item
  tag?: string[];     // tagUnitId[] applied to this item within this shelf
}
```

**Why JSON instead of a separate table**: ShelfItemReview existed solely to link reviews to shelf items. With typically 0-3 reviews per item, a JSON array is simpler and avoids a third table. The same applies to per-item tags.

### 4. structure.tag ↔ unitTags synchronization

**Decision**: Application-level sync, no DB-level constraint.

When the author adds a tag to `structure.tag`:
1. Create a `unitTag` row (tag → shelf's Unit) for search indexing
2. Append the tagUnitId to `structure.tag` for display order

When the author removes a tag from `structure.tag`:
1. Delete the corresponding `unitTag` row
2. Remove from `structure.tag`

Community/non-author tags go to `unitTags` only, never into `structure.tag`. The `structure.tag` array is purely the author's curated selection and ordering.

No validation that `structure.tag ⊆ unitTags` — the author's additions directly CREATE unitTag entries. All tag IDs must reference existing Tag units in Rezics.

### 5. Consistency model between structure.units and ShelfItem rows

**Decision**: Dual source of truth — ShelfItem rows are the existence truth, `structure.units` is the ordering truth.

| Operation | ShelfItem | structure.units |
|-----------|-----------|-----------------|
| Add item | INSERT row | push to array |
| Remove item | DELETE row | remove from array |
| Reorder | — | rewrite array |
| Add review/tag | UPDATE data | — |

All add/remove operations run in a single transaction.

**Orphan handling**: When a Unit is deleted externally, the ShelfItem row stays (no FK cascade). The `structure.units` array references a now-missing item. On frontend render, items that fail hydration are hidden. When the author next commits changes (any edit to the shelf), the frontend sends a cleanup request to remove orphaned ShelfItem rows and their references from `structure.units`.

### 6. Frontend batch hydration and cache seeding

**Decision**: Frontend groups ShelfItem[] by `kind`, calls existing POST list APIs with `{ ids: [...] }`, and seeds per-item detail cache.

```
ShelfItem[] grouped by kind:
  book:   [id1, id2, id5] → POST /book/list { ids: [...] }
  review: [id3]           → POST /post/list { ids: [...], kind: 'REVIEW' }
  tag:    [id4]           → POST /tag/list  { ids: [...] }

Each result item → queryClient.setQueryData(['books','detail', id], bookData)
```

This reuses existing list endpoints (which already accept `ids` arrays, max 200) and populates the same cache keys used by detail pages, search results, and other features.

### 7. Pagination

**Decision**: Default page size of 100. Backend returns ShelfItems ordered by `structure.units` position.

Backend implementation:
1. Read `structure.units` array
2. Slice to requested page (offset-based, e.g., items 0-99, 100-199)
3. Query ShelfItem rows for those itemRefs
4. Return in structure.units order

Most shelves have <100 items → single request, no pagination needed.

### 8. Sorting

**Decision**: Three sort modes, all frontend-driven.

| Mode | Source | Implementation |
|------|--------|----------------|
| manual | `structure.units` order | Default — items returned in this order from API |
| time | `ShelfItem.createdAt` | Frontend sorts hydrated items |
| title | Hydrated item title | Frontend sorts via `Intl.Collator(userLocale)` |

Title sort only covers items loaded into TanStack Query cache (accumulated across pages). This is intentional — sorting items the user hasn't seen yet by a field that depends on locale makes no sense.

## Risks / Trade-offs

**[Orphan accumulation]** → Without FK cascade, deleted Units leave orphan ShelfItem rows. Mitigation: frontend cleanup on author edit. Additional safety net: periodic background job (future, not in scope) to scan for orphans.

**[structure.units ↔ ShelfItem desync]** → Bug in transaction logic could leave structure.units referencing an itemRef with no ShelfItem row, or vice versa. Mitigation: inner-join on read (only render items present in BOTH); transaction discipline on write.

**[JSON size for large shelves]** → A shelf with 5000 items produces a ~200KB structure.units array. Mitigation: acceptable for Postgres JSON columns; large shelf degradation deferred but the architecture doesn't prevent it.

**[Batch hydration latency]** → First render of a shelf triggers 3-5 batch list API calls. Mitigation: TanStack Query parallel fetching; progressive rendering (show items as each kind's batch resolves); cache hits for previously-seen items.

**[No FK integrity on itemRef]** → The `kind` field could drift if a Unit's type changes (unlikely but possible for Post subtype changes). Mitigation: kind is determined at write time and stable for the lifetime of the ShelfItem. If a Post's kind changes (extremely rare), the ShelfItem's kind becomes stale but still renders — just with the wrong card type until re-collected.

## Migration Plan

### Data Migration Steps

1. **Add new columns**: `Shelf.structure` (Json, default `{}`), `ShelfItem.kind` (String), `ShelfItem.data` (Json, nullable), `ShelfItem.itemRef` (String)
2. **Populate `itemRef`**: Copy `itemUnitId` → `itemRef` for all existing ShelfItem rows
3. **Populate `kind`**: Join ShelfItem → Unit → (optionally Post) to determine kind per row. Default `post` for unknown types.
4. **Build `structure.units`**: For each shelf, query its ShelfItems ordered by `sortOrder ASC, createdAt ASC`, produce the ordered array of itemRefs, write to `Shelf.structure.units`
5. **Build `structure.tag`**: For each shelf, query its `unitTags` where the tag was added by the shelf owner, write those tagUnitIds to `Shelf.structure.tag`
6. **Migrate ShelfItemReview → data.review**: For each ShelfItem with associated ShelfItemReview rows, set `data = { review: [reviewUnitId, ...] }`
7. **Migrate keywords → data.tag**: For ShelfItems with non-empty `keywords[]`, map keyword strings to tag unitIds where possible. Unmappable keywords are dropped (they were free-text, not tag references).
8. **Drop old columns/tables**: Remove `ShelfItem.sortOrder`, `ShelfItem.keywords`, `ShelfItem.label`, `ShelfItem.extra`, `ShelfItem.itemUnitId`. Drop `ShelfItemReview` table.

### Rollback Strategy

Keep the old columns for one release cycle (mark as deprecated). If issues arise, revert the API/frontend code while old columns still contain valid data. Once stable, drop deprecated columns in a follow-up migration.

## Open Questions

1. **keywords → tag migration fidelity**: Existing `keywords[]` are free-text strings, not tag unitIds. How many existing keywords map to real Tag units? If most don't, the migration effectively drops per-item tagging data. Needs a data audit before migration.
2. **Review collection without FK**: When collecting a review, the backend currently follows `Post.targetUnitId` to auto-collect the target work. Without FK on ShelfItem, the backend still needs to query the Post to determine the target — this query path remains unchanged but is worth noting.
