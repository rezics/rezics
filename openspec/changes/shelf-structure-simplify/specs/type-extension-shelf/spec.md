## MODIFIED Requirements

### Requirement: Adding items to a shelf in pure mode

A ShelfItem SHALL link a Shelf to any item via a composite primary key of (`shelfUnitId`, `itemRef`). The `itemRef` SHALL be a plain String without a foreign key constraint to Unit. Each ShelfItem SHALL have a `kind` String field (max 32 chars) as a render discriminator and an optional `data` Json field for per-item structured extras. The `itemRef` MAY reference any Unit — reviews collected as independent units, books, games, media, links, or any other Unit.

#### Scenario: Add an item to a shelf

- **GIVEN** a Shelf "shelf-1" and a Unit "book-1" of type BOOK
- **WHEN** the user adds "book-1" to "shelf-1"
- **THEN** a ShelfItem record SHALL be created with `shelfUnitId = "shelf-1"`, `itemRef = "book-1"`, `kind = "book"`, `data = null`
- **AND** "book-1" SHALL be appended to `Shelf.structure.units`

#### Scenario: Add an item with per-item tags

- **GIVEN** a Shelf "shelf-1" and a Unit "book-1"
- **WHEN** the user adds "book-1" to "shelf-1" with tags `["tag-3", "tag-4"]`
- **THEN** a ShelfItem record SHALL be created with `data = { tag: ["tag-3", "tag-4"] }`

#### Scenario: Prevent duplicate items in a shelf

- **GIVEN** a Shelf "shelf-1" already containing "book-1"
- **WHEN** the user attempts to add "book-1" to "shelf-1" again
- **THEN** the system SHALL reject the request due to the composite primary key constraint
- **AND** no duplicate ShelfItem record SHALL be created

### Requirement: Shelf structure column

The Shelf model SHALL have a `structure` Json column (default `{}`) storing the shelf's tag vocabulary and item ordering. The structure SHALL contain `tag` (ordered array of tagUnitIds) and `units` (ordered array of itemRefs).

#### Scenario: Shelf with structure

- **GIVEN** a Shelf with `structure = { tag: ["tag-1"], units: ["book-1", "book-2"] }`
- **WHEN** the shelf data is read
- **THEN** `structure.tag` SHALL provide the author's curated tag list
- **AND** `structure.units` SHALL define the manual sort order of items

#### Scenario: New shelf default structure

- **WHEN** a new shelf is created
- **THEN** `structure` SHALL default to `{}`

## REMOVED Requirements

### Requirement: Review-driven shelf items via ShelfItemReview junction

**Reason**: The `ShelfItemReview` junction table is deleted. Review attachments are now stored as an array of reviewUnitIds in `ShelfItem.data.review`. This eliminates a third table, simplifies queries, and aligns with the JSON-based per-item extras pattern.

**Migration**: All existing `ShelfItemReview` rows SHALL be migrated into the corresponding `ShelfItem.data.review` arrays. The `ShelfItemReview` model SHALL then be dropped from the Prisma schema.

### Requirement: Adding items to a shelf in pure mode (sortOrder, keywords, label, extra fields)

**Reason**: `sortOrder` is replaced by `Shelf.structure.units` ordering. `keywords[]` is replaced by `ShelfItem.data.tag` with unitId references. `label` and `extra` are removed as unused/superseded by `data` Json field.

**Migration**: `sortOrder` SHALL be used to build the initial `structure.units` array during migration. `keywords[]` values that map to existing Tag units SHALL be converted to `data.tag` entries. `label` and `extra` data SHALL be preserved in `data` if non-null during migration, then the columns SHALL be dropped.
