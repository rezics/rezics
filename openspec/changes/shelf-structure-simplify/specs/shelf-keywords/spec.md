## REMOVED Requirements

### Requirement: ShelfItem keywords for personal annotation

**Reason**: The `ShelfItem.keywords: String[]` field is a free-text column that cannot participate in tag search indexing and drifts from the unit-id-based tag system used elsewhere in the codebase. Per-item labelling is replaced by `ShelfUnit` rows with `role = 'tag'` — unit-id references to Tag units, with a B-tree `@@index([unitId, role])` on the `ShelfUnit` junction for reverse lookup.

**Migration**: During the data migration, each existing `keywords` string is resolved against Tag unit titles. Matches become `ShelfUnit` rows with `role = 'tag'` bound to the slot (`shelfUnitId`, `itemRef = itemUnitId`, `unitId = resolvedTagId`). Unresolvable strings are dropped. After migration, the `keywords` column is dropped from `ShelfItem`.

### Requirement: User-level keyword vocabulary for autocomplete

**Reason**: With `ShelfItem.keywords` removed and per-item tagging going through unit-id references, there is no free-text vocabulary to autocomplete. Tag discovery uses the existing Tag search index.

**Migration**: `User.keywords` is dropped without replacement. No data is migrated — the field had no canonical role outside the keywords flow being removed.

### Requirement: Keyword management API

**Reason**: Keyword vocabulary management was a thin CRUD over `User.keywords`. With that field gone, the endpoint has no purpose.

**Migration**: The keyword management endpoint is removed. Clients SHALL stop calling it. Tag-based per-item labelling uses the existing Tag selection UI and writes through the `setItemTags` endpoint which maintains `ShelfUnit` `role='tag'` rows.

### Requirement: Filter shelf items by keyword

**Reason**: Filtering shelf items by `keyword=` is removed together with the column. Filtering by tag on a shelf is a frontend concern over hydrated items, or — if scale requires it — a future backend filter over `ShelfUnit` with `WHERE shelfUnitId = S AND role = 'tag' AND unitId = T` using the existing B-tree indexes.

**Migration**: The `keyword` query parameter is removed from the shelf items endpoint. Clients SHALL remove any usage.

### Requirement: User keyword vocabulary limit

**Reason**: The limit applies to `User.keywords`, which is deleted.

**Migration**: No migration needed — the column and its limit are dropped together.
