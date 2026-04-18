## MODIFIED Requirements

### Requirement: Adding items to a shelf in pure mode

A ShelfItem SHALL link a Shelf to any Unit via a composite primary key of (`shelfUnitId`, `itemRef`). The `itemRef` SHALL be `String @db.Uuid` without a foreign key constraint to `Unit`. Each ShelfItem SHALL carry:

- `kind: String @db.VarChar(32)` — render discriminator, determined at write time.
- `position: String @db.VarChar(64)` — fractional-index key for manual ordering.
- `reviewIds: String[] @db.Uuid @default([])` — unit ids of reviews attached to this item.
- `tagIds: String[] @db.Uuid @default([])` — unit ids of Tag units applied to this item within this shelf.

The `itemRef` MAY reference any Unit type — reviews collected as independent units, books, games, media, links, or any other Unit. ShelfItem SHALL NOT carry `sortOrder`, `keywords`, `label`, `extra`, or a `data: Json` field.

#### Scenario: Add a book to a shelf

- **GIVEN** a Shelf `shelf-1` and a Unit `book-1` of type `BOOK`
- **WHEN** the user adds `book-1` to `shelf-1`
- **THEN** a ShelfItem SHALL be created with `shelfUnitId = "shelf-1"`, `itemRef = "book-1"`, `kind = "book"`, `reviewIds = []`, `tagIds = []`, and a generated `position` string
- **AND** no FK constraint SHALL tie `itemRef` to `Unit.id`

#### Scenario: Add an item with per-item tags

- **GIVEN** a Shelf `shelf-1`, a Unit `book-1`, and Tag unit ids `[T1, T2]`
- **WHEN** the user adds `book-1` to `shelf-1` with `tagIds = [T1, T2]`
- **THEN** the ShelfItem SHALL be created with `tagIds = [T1, T2]`

#### Scenario: Prevent duplicate items in a shelf

- **GIVEN** a Shelf `shelf-1` already containing `book-1`
- **WHEN** the user attempts to add `book-1` to `shelf-1` again
- **THEN** the composite primary key `@@id([shelfUnitId, itemRef])` SHALL reject the insert
- **AND** no duplicate ShelfItem row SHALL be created

#### Scenario: itemRef reverse lookup

- **WHEN** the system queries "which shelves contain unit `book-1`"
- **THEN** the query SHALL use `WHERE itemRef = "book-1"` and hit `@@index([itemRef])`
- **AND** SHALL NOT require a JOIN to `Unit`

## REMOVED Requirements

### Requirement: Review-driven shelf items via ShelfItemReview junction

**Reason**: The `ShelfItemReview` junction table is deleted. Review attachments are stored as a unit-id array in `ShelfItem.reviewIds: String[] @db.Uuid` with a GIN index for reverse lookup. The array approach eliminates one table and one JOIN at the expected low cardinality (typically 0–3 reviews per item), and makes attach / detach single-row UPDATEs.

**Migration**: For each existing ShelfItem, populate `reviewIds` by aggregating the `reviewUnitId` values from matching `ShelfItemReview` rows. After backfill, drop the `ShelfItemReview` model from the Prisma schema and remove the `shelfItemReviews` relation from the `Unit` model.
