## MODIFIED Requirements

### Requirement: Adding items to a shelf in pure mode

A ShelfItem SHALL link a Shelf to any other Unit via a composite primary key of (`shelfUnitId`, `itemUnitId`). Each ShelfItem SHALL have a `sortOrder` integer for positioning. A ShelfItem MAY have an optional `label`, an `extra` Json field, and a `keywords` String array (default empty) for personal annotation. The `itemUnitId` MAY reference any Unit type — reviews collected as independent units, books, games, media, links, or any other Unit.

#### Scenario: Add an item to a shelf

- **GIVEN** a Shelf "shelf-1" and a Unit "book-1" of type BOOK
- **WHEN** the user adds "book-1" to "shelf-1" with `sortOrder = 1`
- **THEN** a ShelfItem record SHALL be created with `shelfUnitId = "shelf-1"`, `itemUnitId = "book-1"`, `sortOrder = 1`, `keywords = []`

#### Scenario: Add an item with keywords

- **GIVEN** a Shelf "shelf-1" and a Unit "book-1"
- **WHEN** the user adds "book-1" to "shelf-1" with keywords `["to-read", "summer"]`
- **THEN** a ShelfItem record SHALL be created with `keywords: ["to-read", "summer"]`

#### Scenario: Prevent duplicate items in a shelf

- **GIVEN** a Shelf "shelf-1" already containing "book-1"
- **WHEN** the user attempts to add "book-1" to "shelf-1" again
- **THEN** the system SHALL reject the request due to the composite primary key constraint
- **AND** no duplicate ShelfItem record SHALL be created

### Requirement: Review-driven shelf items via ShelfItemReview junction

When a review is attached to a shelf item, the attachment SHALL be recorded in the `ShelfItemReview` junction table with composite primary key `(shelfUnitId, itemUnitId, reviewUnitId)`. A ShelfItem MAY have zero or more associated ShelfItemReviews. The junction replaces the previous `reviewPostUnitId` nullable field on ShelfItem.

#### Scenario: Attach a review to a shelf item

- **GIVEN** a ShelfItem for "book-1" in "shelf-1"
- **WHEN** a review "review-1" (Post with `targetUnitId = "book-1"`) is attached
- **THEN** a ShelfItemReview SHALL be created with `shelfUnitId = "shelf-1"`, `itemUnitId = "book-1"`, `reviewUnitId = "review-1"`

#### Scenario: Attach multiple reviews to the same shelf item

- **GIVEN** a ShelfItem for "book-1" in "shelf-1" with review "review-1" already attached
- **WHEN** review "review-2" (also with `targetUnitId = "book-1"`) is attached
- **THEN** a second ShelfItemReview SHALL be created
- **AND** both ShelfItemReviews SHALL coexist for the same ShelfItem

#### Scenario: Prevent duplicate review attachment

- **GIVEN** a ShelfItem for "book-1" in "shelf-1" with review "review-1" already attached
- **WHEN** the user attempts to attach "review-1" again
- **THEN** the system SHALL reject the request due to the composite primary key constraint

#### Scenario: Deleting a review cascades to ShelfItemReview

- **GIVEN** a ShelfItemReview linking "review-1" to a ShelfItem
- **WHEN** the Unit for "review-1" is deleted
- **THEN** the ShelfItemReview row SHALL be cascade-deleted
- **AND** the parent ShelfItem SHALL remain in the shelf

#### Scenario: Deleting a ShelfItem cascades to ShelfItemReviews

- **GIVEN** a ShelfItem with three associated ShelfItemReviews
- **WHEN** the ShelfItem is deleted
- **THEN** all three ShelfItemReview rows SHALL be cascade-deleted

#### Scenario: Query shelf items containing a specific review

- **GIVEN** review "review-1" is attached to ShelfItems in three different shelves
- **WHEN** querying for ShelfItemReviews by `reviewUnitId = "review-1"`
- **THEN** the query SHALL use the `@@index([reviewUnitId])` index
- **AND** all three ShelfItemReview rows SHALL be returned

## REMOVED Requirements

### Requirement: Review-driven shelf auto-creates ShelfItem from review

**Reason**: Replaced by the ShelfItemReview junction table. The single `reviewPostUnitId` field on ShelfItem cannot support multiple reviews per item and lacks FK integrity for reverse lookups.

**Migration**: ShelfItems with non-null `reviewPostUnitId` SHALL be migrated to ShelfItemReview rows. The `reviewPostUnitId` column SHALL then be dropped from ShelfItem.
