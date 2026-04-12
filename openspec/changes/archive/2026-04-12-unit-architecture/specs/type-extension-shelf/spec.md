## ADDED Requirements

### Requirement: Shelf creation with optional kindKey

A Shelf SHALL be created as a 1:1 extension on a Unit with `type = SHELF`. The Shelf model SHALL have `unitId` as the primary key and foreign key to the parent Unit. A Shelf MAY specify a `kindKey` to indicate its purpose. Valid kindKey values include `collection`, `series`, `review-shelf`, and `ranked`. The Shelf model SHALL have an `extra` field of type Json for extensible metadata.

#### Scenario: Create a shelf with kindKey

- GIVEN an authenticated user with userId "user-1"
- WHEN the user creates a Shelf with `kindKey = "collection"`
- THEN a Unit with `type = SHELF` SHALL be created
- AND a Shelf extension record SHALL be created with `kindKey = "collection"`

#### Scenario: Create a shelf without kindKey

- GIVEN an authenticated user with userId "user-1"
- WHEN the user creates a Shelf without specifying `kindKey`
- THEN a Shelf extension record SHALL be created with `kindKey` set to its default or null

### Requirement: Adding items to a shelf in pure mode

A ShelfItem SHALL link a Shelf to any other Unit via a composite primary key of (`shelfUnitId`, `itemUnitId`). Each ShelfItem SHALL have a `sortOrder` integer for positioning. A ShelfItem MAY have an optional `label` and an `extra` Json field.

#### Scenario: Add an item to a shelf

- GIVEN a Shelf "shelf-1" and a Unit "book-1" of type BOOK
- WHEN the user adds "book-1" to "shelf-1" with `sortOrder = 1`
- THEN a ShelfItem record SHALL be created with `shelfUnitId = "shelf-1"`, `itemUnitId = "book-1"`, `sortOrder = 1`

#### Scenario: Prevent duplicate items in a shelf

- GIVEN a Shelf "shelf-1" already containing "book-1"
- WHEN the user attempts to add "book-1" to "shelf-1" again
- THEN the system SHALL reject the request due to the composite primary key constraint
- AND no duplicate ShelfItem record SHALL be created

### Requirement: Review-driven shelf auto-creates ShelfItem from review

When a review Post is added to a review-driven Shelf, the system SHALL auto-create a ShelfItem with `reviewPostUnitId` set to the review's unitId and `itemUnitId` derived from the review's `targetUnitId`. This enables shelves where each item is backed by a user's review.

#### Scenario: Add a review to a review-driven shelf

- GIVEN a Shelf "shelf-1" with `kindKey = "review-shelf"` and a Post "review-1" with `kindKey = "review"` and `targetUnitId = "book-1"`
- WHEN the user adds "review-1" to "shelf-1"
- THEN a ShelfItem SHALL be created with `shelfUnitId = "shelf-1"`, `itemUnitId = "book-1"`, `reviewPostUnitId = "review-1"`

#### Scenario: itemUnitId is derived from review's targetUnitId

- GIVEN a Post "review-2" with `kindKey = "review"` and `targetUnitId = "game-1"`
- WHEN the review is added to a review-driven Shelf
- THEN the resulting ShelfItem's `itemUnitId` SHALL equal "game-1" (the review's targetUnitId)
- AND the caller SHALL NOT need to specify `itemUnitId` explicitly

### Requirement: Series mode with labels and ordering

In series mode (`kindKey = "series"`), ShelfItems SHALL support a `label` field for volume or episode identifiers (e.g., "Vol. 1", "Vol. 2", "Episode 5"). Items SHALL be ordered by `sortOrder`.

#### Scenario: Create a series shelf with labeled items

- GIVEN a Shelf "series-1" with `kindKey = "series"`
- WHEN the user adds items with labels "Vol. 1" (sortOrder 1), "Vol. 2" (sortOrder 2), "Vol. 3" (sortOrder 3)
- THEN three ShelfItem records SHALL be created with the respective `label` and `sortOrder` values

#### Scenario: Retrieve series items in order

- GIVEN a Shelf "series-1" with three ShelfItems at sortOrder 1, 2, 3
- WHEN querying ShelfItems by `shelfUnitId = "series-1"` ordered by `sortOrder`
- THEN the items SHALL be returned in sequence: sortOrder 1, 2, 3 with their respective labels

### Requirement: ShelfItem.reviewPostUnitId references a matching Post

When a ShelfItem has a `reviewPostUnitId`, the referenced Post's `targetUnitId` MUST match the ShelfItem's `itemUnitId`. This constraint ensures that a review on a shelf item is actually a review of that item's target work.

#### Scenario: Valid review reference on a shelf item

- GIVEN a Post "review-1" with `targetUnitId = "book-1"` and a ShelfItem with `itemUnitId = "book-1"`
- WHEN `reviewPostUnitId` is set to "review-1"
- THEN the reference SHALL be accepted because `review-1.targetUnitId` matches `ShelfItem.itemUnitId`

#### Scenario: Reject mismatched review reference

- GIVEN a Post "review-1" with `targetUnitId = "book-1"` and a ShelfItem with `itemUnitId = "game-1"`
- WHEN a caller attempts to set `reviewPostUnitId = "review-1"` on the ShelfItem
- THEN the system SHALL reject the operation with a validation error
- AND the ShelfItem's `reviewPostUnitId` SHALL remain unchanged

### Requirement: Shelf is universal and not limited to books

The Shelf model SHALL accept any Unit as an item regardless of its type. ShelfItems MAY reference Units of type BOOK, GAME, MEDIA, or any other UnitType. A single Shelf MAY contain items of mixed types.

#### Scenario: Shelf contains mixed content types

- GIVEN a Shelf "shelf-1" with `kindKey = "collection"`
- WHEN the user adds a BOOK unit, a GAME unit, and a MEDIA unit to the shelf
- THEN three ShelfItem records SHALL be created, each referencing a different UnitType
- AND the Shelf SHALL not restrict items by type

#### Scenario: Add a game to a shelf

- GIVEN a Shelf "shelf-1" and a Unit "game-1" of type GAME
- WHEN the user adds "game-1" to "shelf-1"
- THEN a ShelfItem SHALL be created with `itemUnitId = "game-1"` without type restriction

### Requirement: Shelf replaces ReadList and SeriesBook

The Shelf model SHALL serve as the unified replacement for the legacy ReadList and SeriesBook models. All functionality previously provided by ReadList (user-curated lists of works) and SeriesBook (ordered series entries) SHALL be achievable through Shelf and ShelfItem with the appropriate `kindKey`.

#### Scenario: ReadList functionality via collection shelf

- GIVEN a user who previously maintained a ReadList of books
- WHEN the user creates a Shelf with `kindKey = "collection"` and adds the same books as ShelfItems
- THEN all ReadList functionality SHALL be replicated: ordered items, add/remove, reorder

#### Scenario: SeriesBook functionality via series shelf

- GIVEN a book series previously modeled as SeriesBook entries
- WHEN the series is represented as a Shelf with `kindKey = "series"` and ShelfItems with `label` values ("Vol. 1", "Vol. 2") and `sortOrder`
- THEN all SeriesBook functionality SHALL be replicated: ordered volumes with labels

### Requirement: Item ordering via sortOrder

Every ShelfItem SHALL have a `sortOrder` integer field that determines its position within the Shelf. When items are reordered, the system MUST update `sortOrder` values to reflect the new arrangement.

#### Scenario: Reorder items in a shelf

- GIVEN a Shelf "shelf-1" with items A (sortOrder 1), B (sortOrder 2), C (sortOrder 3)
- WHEN the user moves item C to position 1
- THEN the sortOrder values SHALL be updated so that C has the lowest sortOrder
- AND the items SHALL be retrievable in the new order: C, A, B

#### Scenario: Insert item at a specific position

- GIVEN a Shelf "shelf-1" with items at sortOrder 1 and sortOrder 2
- WHEN the user adds a new item at position 2
- THEN the new item SHALL have `sortOrder = 2`
- AND existing items at or after position 2 SHALL have their sortOrder adjusted accordingly
