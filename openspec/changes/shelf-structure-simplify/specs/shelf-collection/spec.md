## MODIFIED Requirements

### Requirement: Shelf replaces Bookmark as the collection mechanism

The Shelf system SHALL serve as the sole mechanism for users to save and organize content. The Bookmark model SHALL be removed. All bookmark functionality — saving units, tagging saved items — SHALL be handled through Shelf and ShelfItem.

#### Scenario: User saves a unit via shelf instead of bookmark

- **WHEN** a user collects a unit of any type (BOOK, GAME, MEDIA, POST, LINK, SHELF, TAG)
- **THEN** a ShelfItem SHALL be created in the selected shelf(s) with `itemRef` referencing the unit and `kind` set from the unit's type
- **AND** the itemRef SHALL be appended to the shelf's `structure.units` array in the same transaction
- **AND** no Bookmark row SHALL be created
- **AND** no Reaction of type "bookmark" SHALL be created

### Requirement: Favorites toggle (heart button)

The system SHALL provide a dedicated toggle endpoint for adding/removing a unit from the user's Favorites shelf. This operation SHALL be independent of the collection modal and the Reaction system.

#### Scenario: Favorite a unit

- **WHEN** a user triggers the favorite toggle on a unit that is NOT in their Favorites shelf
- **THEN** a ShelfItem SHALL be created in the Favorites shelf with `itemRef` referencing the unit and `kind` set from the unit's type
- **AND** the itemRef SHALL be appended to the Favorites shelf's `structure.units`
- **AND** the response SHALL indicate `isFavorited: true`

#### Scenario: Unfavorite a unit

- **WHEN** a user triggers the favorite toggle on a unit that IS in their Favorites shelf
- **THEN** the ShelfItem SHALL be removed from the Favorites shelf
- **AND** the itemRef SHALL be removed from `structure.units`
- **AND** the response SHALL indicate `isFavorited: false`

#### Scenario: Favorite a review auto-collects the target work

- **WHEN** a user triggers the favorite toggle on a Post with `kind = REVIEW` and `targetUnitId` pointing to a work
- **THEN** the ShelfItem SHALL be created with `itemRef` referencing the target work (not the review itself) and `kind` set from the target work's type
- **AND** the review SHALL be recorded in `ShelfItem.data.review` array
- **AND** the itemRef SHALL be appended to `structure.units`

### Requirement: Collection to multiple shelves

The system SHALL support saving a unit to multiple shelves in a single operation.

#### Scenario: Collect a unit to three shelves

- **WHEN** a user submits a collection request with `targetId` and three `shelfIds`
- **THEN** a ShelfItem SHALL be created (or updated) in each of the three shelves with appropriate `kind`
- **AND** each shelf's `structure.units` SHALL be updated to include the new itemRef

#### Scenario: Collect to a shelf where the item already exists

- **WHEN** a user collects a unit to a shelf that already contains that unit
- **THEN** no duplicate ShelfItem SHALL be created
- **AND** `structure.units` SHALL NOT be modified

### Requirement: Review auto-collection

When a user collects a review (Post with `kind = REVIEW` and a valid `targetUnitId`), the system SHALL auto-collect the target work and attach the review via ShelfItem.data.

#### Scenario: Collect a review of a book not yet in the shelf

- **WHEN** a user collects a review whose `targetUnitId` references Book A, and Book A is not yet in the selected shelf
- **THEN** a ShelfItem SHALL be created with `itemRef = Book A` and `kind = "book"`
- **AND** `ShelfItem.data` SHALL be set to `{ review: ["review-id"] }`
- **AND** Book A's itemRef SHALL be appended to `structure.units`

#### Scenario: Collect a review of a book already in the shelf

- **WHEN** a user collects a review whose `targetUnitId` references Book A, and Book A is already in the selected shelf
- **THEN** the existing ShelfItem's `data.review` array SHALL be updated to include the new review's unitId
- **AND** no new ShelfItem SHALL be created
- **AND** `structure.units` SHALL NOT be modified

### Requirement: Collection status check

The system SHALL provide an endpoint to check which of the user's shelves contain a given unit, and whether it is in the Favorites shelf.

#### Scenario: Check status of a collected unit

- **WHEN** a user requests the collection status of a unit that is in two shelves including Favorites
- **THEN** the response SHALL include `isFavorited: true`
- **AND** the response SHALL include the list of shelves containing this unit with their IDs and titles

#### Scenario: Check status of a review resolves to target work

- **WHEN** a user requests the collection status of a review Post
- **THEN** the system SHALL resolve the review's `targetUnitId`
- **AND** return the collection status of the target work

## REMOVED Requirements

### Requirement: Collection with keywords merging

**Reason**: The `keywords: string[]` field on ShelfItem is removed. Per-item tagging now uses unitId-based tag references in `ShelfItem.data.tag`, which are managed separately from the collection flow.

**Migration**: Existing ShelfItem keywords that map to Tag units SHALL be converted to `data.tag` entries during migration. Unmappable free-text keywords SHALL be dropped. `User.keywords` merging during collection is removed.

### Requirement: Collection status includes review attachment via ShelfItemReview

**Reason**: ShelfItemReview table is deleted. Review attachments are now stored in `ShelfItem.data.review`.

**Migration**: The collection status endpoint SHALL check `ShelfItem.data.review` instead of querying the ShelfItemReview table.
