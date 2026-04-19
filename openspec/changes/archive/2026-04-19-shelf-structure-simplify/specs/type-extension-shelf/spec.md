## MODIFIED Requirements

### Requirement: Adding items to a shelf in pure mode

A `ShelfItem` SHALL link a `Shelf` to any `Unit` via a composite primary key of (`shelfUnitId`, `itemRef`). The `itemRef` SHALL be `String @db.Uuid` without a foreign key constraint to `Unit`. Each `ShelfItem` SHALL carry exactly:

- `kind: String @db.VarChar(32)` — render discriminator, determined at write time.
- `position: String @db.VarChar(64)` — fractional-index key for manual ordering.
- `createdAt: DateTime`, `updatedAt: DateTime`.

The `itemRef` MAY reference any Unit type — reviews collected as independent units, books, games, media, links, or any other Unit. `ShelfItem` SHALL NOT carry `sortOrder`, `keywords`, `label`, `extra`, `reviewIds`, `tagIds`, or a `data: Json` field. Per-item review and tag attachments SHALL live in the `ShelfUnit` junction model (see capability `shelf-unit-junction`), not on the `ShelfItem` row itself.

Adding a unit to a shelf SHALL be a single transaction that inserts both a `ShelfItem` row and a `ShelfUnit` row with `role='primary'` pointing to the same `itemRef`.

#### Scenario: Add a book to a shelf

- **GIVEN** a Shelf `shelf-1` and a Unit `book-1` of type `BOOK`
- **WHEN** the user adds `book-1` to `shelf-1`
- **THEN** a `ShelfItem` SHALL be created with `shelfUnitId = "shelf-1"`, `itemRef = "book-1"`, `kind = "book"`, and a generated `position` string
- **AND** a `ShelfUnit` row SHALL be created with `(shelfUnitId = "shelf-1", itemRef = "book-1", unitId = "book-1", role = "primary")` in the same transaction
- **AND** no FK constraint SHALL tie `ShelfItem.itemRef` to `Unit.id`

#### Scenario: Add an item with per-item tags

- **GIVEN** a Shelf `shelf-1`, a Unit `book-1`, and Tag unit ids `[T1, T2]`
- **WHEN** the user adds `book-1` to `shelf-1` with tags `[T1, T2]`
- **THEN** one `ShelfItem` row SHALL be created as above
- **AND** three `ShelfUnit` rows SHALL be created: one `role='primary'` and two `role='tag'` (one per tag unit id)
- **AND** the `ShelfItem` row itself SHALL NOT contain a `tagIds` field

#### Scenario: Prevent duplicate items in a shelf

- **GIVEN** a Shelf `shelf-1` already containing `book-1`
- **WHEN** the user attempts to add `book-1` to `shelf-1` again
- **THEN** the composite primary key `@@id([shelfUnitId, itemRef])` SHALL reject the insert
- **AND** no duplicate `ShelfItem` row SHALL be created
- **AND** no duplicate `ShelfUnit` `role='primary'` row SHALL be created

#### Scenario: itemRef is not indexed on ShelfItem for reverse lookup

- **WHEN** the system needs to answer "which shelves contain unit X"
- **THEN** the query SHALL target the `ShelfUnit` junction via `WHERE unitId = X`
- **AND** SHALL NOT query `ShelfItem.itemRef` for the reverse lookup
- **AND** `ShelfItem` SHALL NOT declare `@@index([itemRef])`

## REMOVED Requirements

### Requirement: Review-driven shelf items via ShelfItemReview junction

**Reason**: The `ShelfItemReview` model is deleted. Review attachments move to the new `ShelfUnit` junction with `role = 'review'`, which uniformly handles every shelf ↔ unit association (primary, review, tag, future roles) with B-tree reverse-lookup indexes. See the `shelf-unit-junction` capability for the replacement semantics and indexes.

**Migration**: For each existing `ShelfItemReview(shelfUnitId, itemUnitId, reviewUnitId)` row, insert a `ShelfUnit(shelfUnitId, itemRef = itemUnitId, unitId = reviewUnitId, role = 'review')` row. After backfill, drop the `ShelfItemReview` model from the Prisma schema and remove the `shelfItemReviews` relation from the `Unit` model.
