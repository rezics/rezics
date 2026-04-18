## ADDED Requirements

### Requirement: Shelf structure JSON field

The Shelf model SHALL have a `structure` Json column (default `{}`) containing two arrays: `tag` (an ordered list of tagUnitIds representing the author's curated tag vocabulary) and `units` (an ordered list of itemRefs defining manual sort order).

#### Scenario: New shelf has empty structure

- **WHEN** a new shelf is created without specifying structure
- **THEN** the shelf SHALL have `structure = {}` (empty object)

#### Scenario: Structure with tags and units

- **WHEN** a shelf has `structure = { tag: ["tag-1", "tag-2"], units: ["book-1", "post-2", "tag-1"] }`
- **THEN** `structure.tag` SHALL define the author's curated tag vocabulary in display order
- **AND** `structure.units` SHALL define the item rendering order

### Requirement: structure.tag synchronization with unitTags

When the shelf author adds a tag to `structure.tag`, the system SHALL also create a `unitTag` row linking the tag to the shelf's Unit for search indexing. When the author removes a tag from `structure.tag`, the corresponding `unitTag` row SHALL be deleted. Community/non-author tags SHALL exist in `unitTags` only and SHALL NOT be added to `structure.tag`.

#### Scenario: Author adds a tag to shelf

- **WHEN** the shelf author adds tagUnitId "tag-1" to the shelf
- **THEN** "tag-1" SHALL be appended to `structure.tag`
- **AND** a `unitTag` row SHALL be created linking "tag-1" to the shelf's Unit

#### Scenario: Author removes a tag from shelf

- **WHEN** the shelf author removes tagUnitId "tag-1" from the shelf
- **THEN** "tag-1" SHALL be removed from `structure.tag`
- **AND** the corresponding `unitTag` row SHALL be deleted

#### Scenario: Community tag does not appear in structure.tag

- **WHEN** a non-author user tags the shelf with "tag-5"
- **THEN** a `unitTag` row SHALL be created
- **AND** `structure.tag` SHALL NOT be modified

### Requirement: structure.units defines manual sort order

The `structure.units` array SHALL be the single source of truth for manual item ordering. Drag/drop reorder operations SHALL only modify `structure.units` without touching ShelfItem rows.

#### Scenario: Reorder items via drag/drop

- **WHEN** the author reorders items from `["a", "b", "c"]` to `["c", "a", "b"]`
- **THEN** `structure.units` SHALL be updated to `["c", "a", "b"]`
- **AND** no ShelfItem rows SHALL be modified

#### Scenario: Add item appends to structure.units

- **WHEN** a new item "book-3" is added to a shelf with `structure.units = ["book-1", "book-2"]`
- **THEN** `structure.units` SHALL become `["book-1", "book-2", "book-3"]`
- **AND** a ShelfItem row SHALL be created in the same transaction

#### Scenario: Remove item removes from structure.units

- **WHEN** item "book-2" is removed from a shelf with `structure.units = ["book-1", "book-2", "book-3"]`
- **THEN** `structure.units` SHALL become `["book-1", "book-3"]`
- **AND** the ShelfItem row SHALL be deleted in the same transaction

### Requirement: Consistency between structure.units and ShelfItem rows

Add and remove operations SHALL modify both `structure.units` and ShelfItem rows within a single database transaction. On read, items present in `structure.units` but missing from ShelfItem rows (orphans from external Unit deletion) SHALL be filtered out during rendering.

#### Scenario: Orphan in structure.units after external Unit deletion

- **WHEN** a Unit referenced in `structure.units` is deleted externally
- **THEN** the corresponding itemRef remains in `structure.units` (no cascade)
- **AND** on render, the frontend SHALL hide items that fail hydration
- **AND** on next author commit, the frontend SHALL send a cleanup request to remove orphaned entries

#### Scenario: Transaction failure rolls back both writes

- **WHEN** adding an item fails during the ShelfItem INSERT
- **THEN** the `structure.units` update SHALL also be rolled back
- **AND** the shelf state SHALL remain unchanged

### Requirement: Pagination of shelf items

The API SHALL return shelf items paginated with a default page size of 100. Items SHALL be returned in `structure.units` order. The API SHALL support offset-based pagination.

#### Scenario: Shelf with fewer than 100 items

- **WHEN** a shelf has 50 items and the client requests items without pagination params
- **THEN** all 50 items SHALL be returned in `structure.units` order

#### Scenario: Shelf with more than 100 items

- **WHEN** a shelf has 200 items and the client requests the second page (offset=100, limit=100)
- **THEN** items 101-200 from `structure.units` SHALL be returned
- **AND** the response SHALL indicate whether more items exist
