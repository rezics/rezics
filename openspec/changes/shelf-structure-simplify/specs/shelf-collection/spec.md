## MODIFIED Requirements

### Requirement: Shelf replaces Bookmark as the collection mechanism

The Shelf system SHALL serve as the sole mechanism for users to save and organize content. The Bookmark model SHALL be removed. All bookmark functionality — saving units, tagging saved items — SHALL be handled through Shelf and ShelfItem.

#### Scenario: User saves a unit via shelf instead of bookmark

- **WHEN** a user collects a unit of any type (BOOK, GAME, MEDIA, POST, LINK, SHELF, TAG)
- **THEN** a ShelfItem SHALL be created in each selected shelf with `itemRef` referencing the unit and `kind` determined from the unit's type (and Post subtype where applicable)
- **AND** the ShelfItem SHALL have `reviewIds = []` and `tagIds = []` unless explicitly provided
- **AND** the ShelfItem SHALL receive a generated `position` string at the end of the shelf's current order
- **AND** no Bookmark row SHALL be created
- **AND** no Reaction of type "bookmark" SHALL be created

### Requirement: Favorites toggle (heart button)

The system SHALL provide a dedicated toggle endpoint for adding/removing a unit from the user's Favorites shelf. This operation SHALL be independent of the collection modal and the Reaction system.

#### Scenario: Favorite a unit

- **WHEN** a user triggers the favorite toggle on a unit NOT in their Favorites shelf
- **THEN** a ShelfItem SHALL be created in the Favorites shelf with `itemRef` referencing the unit and `kind` determined from the unit's type
- **AND** the ShelfItem SHALL receive a generated `position` string
- **AND** the response SHALL indicate `isFavorited: true`

#### Scenario: Unfavorite a unit

- **WHEN** a user triggers the favorite toggle on a unit that IS in their Favorites shelf
- **THEN** the ShelfItem SHALL be deleted from the Favorites shelf
- **AND** no separate ShelfItemReview cleanup SHALL be required (reviews live inline on the ShelfItem's `reviewIds`)
- **AND** the response SHALL indicate `isFavorited: false`

#### Scenario: Favorite a review auto-collects the target work

- **WHEN** a user triggers the favorite toggle on a Post with `kind = REVIEW` and `targetUnitId` pointing to a work
- **THEN** the ShelfItem SHALL be created with `itemRef` referencing the target work (not the review) and `kind` determined from the target work's type
- **AND** `ShelfItem.reviewIds` SHALL contain the review's unit id
- **AND** if a ShelfItem for the target work already exists in the Favorites shelf, the review's unit id SHALL be appended to its `reviewIds` array without creating a new row

### Requirement: Collection to multiple shelves

The system SHALL support saving a unit to multiple shelves in a single operation.

#### Scenario: Collect a unit to three shelves

- **WHEN** a user submits a collection request with `targetId` and three `shelfIds`
- **THEN** a ShelfItem SHALL be created or updated in each of the three shelves with the correct `kind`
- **AND** each new ShelfItem SHALL receive a generated `position` string in its shelf

#### Scenario: Collect to a shelf where the item already exists

- **WHEN** a user collects a unit to a shelf that already contains that unit
- **THEN** no duplicate ShelfItem row SHALL be created
- **AND** the existing row's `position` SHALL NOT be modified

### Requirement: Review auto-collection

When a user collects a review (Post with `kind = REVIEW` and a valid `targetUnitId`), the system SHALL auto-collect the target work and record the review on the target work's ShelfItem via `reviewIds`.

#### Scenario: Collect a review of a book not yet in the shelf

- **WHEN** a user collects a review whose `targetUnitId` references Book A, and Book A is not yet in the selected shelf
- **THEN** a ShelfItem SHALL be created with `itemRef = BookA` and `kind = "book"`
- **AND** `ShelfItem.reviewIds` SHALL be `[reviewId]`

#### Scenario: Collect a review of a book already in the shelf

- **WHEN** a user collects a review whose `targetUnitId` references Book A, and Book A is already in the selected shelf
- **THEN** no new ShelfItem SHALL be created
- **AND** the existing ShelfItem's `reviewIds` SHALL be updated to include the new `reviewId` if not already present

#### Scenario: Collect a second review of the same book

- **WHEN** a user collects a second review of Book A in the same shelf
- **THEN** the existing ShelfItem's `reviewIds` SHALL contain both review ids

#### Scenario: Review with no targetUnitId is collected as a regular unit

- **WHEN** a user collects a Post with `kind = REVIEW` and `targetUnitId` is null
- **THEN** the Post SHALL be collected as a regular unit (`itemRef` = the review's own unit id, `kind = "review"`)
- **AND** `reviewIds` SHALL be `[]`

### Requirement: Dual collection mode for reviews

Reviews SHALL support two collection modes: (1) collect the target work with the review attached via `reviewIds` (default), and (2) collect the review as an independent unit.

#### Scenario: Collect review as independent unit

- **WHEN** a user explicitly chooses to collect a review as an independent unit
- **THEN** a ShelfItem SHALL be created with `itemRef` referencing the review's own unit id and `kind = "review"`
- **AND** `reviewIds` SHALL be `[]`
- **AND** the review's target work SHALL NOT be auto-collected

### Requirement: Remove a review from a shelf item

A user SHALL be able to remove a single review attachment from a shelf item without removing the item itself.

#### Scenario: Remove one review from a shelf item with two reviews

- **WHEN** a user removes review X from a ShelfItem whose `reviewIds = [X, Y]`
- **THEN** the ShelfItem's `reviewIds` SHALL be updated to `[Y]`
- **AND** the ShelfItem itself SHALL remain in the shelf

### Requirement: Collection status check

The system SHALL provide an endpoint to check which of the user's shelves contain a given unit, and whether it is in the Favorites shelf.

#### Scenario: Check status of a collected unit

- **WHEN** a user requests the collection status of a unit that is in two shelves including Favorites
- **THEN** the response SHALL include `isFavorited: true`
- **AND** the response SHALL include the list of shelves containing this unit with their IDs and titles
- **AND** the check SHALL use `WHERE itemRef = U` queries against ShelfItem, not a JOIN to Unit

#### Scenario: Check status of a review resolves to target work

- **WHEN** a user requests the collection status of a review Post
- **THEN** the system SHALL resolve the review's `targetUnitId`
- **AND** return the collection status of the target work
- **AND** additionally indicate whether this specific review's unit id appears in the target work's ShelfItem `reviewIds` array (using the GIN index on `reviewIds`)

## REMOVED Requirements

### Requirement: Collection with keywords merging

**Reason**: The `keywords: String[]` field on ShelfItem is deleted. Per-item tagging is now expressed via `ShelfItem.tagIds: String[] @db.Uuid` (unit-id references), which is managed separately from the collection flow. The `User.keywords` vocabulary field is also deleted as it no longer has any consumer.

**Migration**: Existing `keywords` values that resolve to an existing Tag unit SHALL be migrated to `tagIds` entries during the data migration. Unresolvable free-text keywords SHALL be dropped. `User.keywords` SHALL be dropped without replacement.

### Requirement: Collection status includes review attachment via ShelfItemReview

**Reason**: `ShelfItemReview` is deleted. Review attachments live in `ShelfItem.reviewIds: String[] @db.Uuid` with a GIN index.

**Migration**: The collection status endpoint SHALL check `ShelfItem.reviewIds @> ARRAY[reviewId]::uuid[]` instead of querying `ShelfItemReview`.

### Requirement: Created vs. collected filter

**Reason**: The `all/created/collected` filter used the viewer's userId to classify items by authorship — meaningless on non-owner shelves and conceptually misplaced (authorship metadata is not shelf curation). The filter is removed with no replacement.

**Migration**: Clients SHALL remove the `filter` query parameter. If authorship-based views are needed in the future, they SHALL be implemented as a separate endpoint or as a frontend filter over hydrated data.

### Requirement: Shelf view modes

**Reason**: The `Shelf.extra.viewMode` mechanism and its `review` mode depended on rendering `ShelfItemReview` attachments beneath each unit. With reviews inlined into `ShelfItem.reviewIds` and rendering fully driven by `kind`, view modes are a pure frontend-presentation concern managed by the client (not the server). Removing the requirement simplifies contract and avoids locking a frontend decision in the schema.

**Migration**: Existing `Shelf.extra.viewMode` values MAY be preserved in `Shelf.extra` for future frontend consumption, but the backend SHALL NOT enforce or interpret them. No data loss.
