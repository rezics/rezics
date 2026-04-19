## ADDED Requirements

### Requirement: Shelf replaces Bookmark as the collection mechanism

The Shelf system SHALL serve as the sole mechanism for users to save and organize content. The Bookmark model SHALL be removed. All bookmark functionality — saving units, tagging saved items — SHALL be handled through `Shelf`, `ShelfItem`, and `ShelfUnit`.

#### Scenario: User saves a unit via shelf instead of bookmark

- **WHEN** a user collects a unit of any type (BOOK, GAME, MEDIA, POST, LINK, SHELF, TAG)
- **THEN** a `ShelfItem` SHALL be created in each selected shelf with `itemRef` referencing the unit and `kind` determined from the unit's type (and `Post.kind` where applicable)
- **AND** a `ShelfUnit` row with `role = 'primary'` SHALL be inserted in the same transaction, with `unitId = itemRef`
- **AND** the `ShelfItem` SHALL receive a generated `position` string at the end of the shelf's current order
- **AND** no Bookmark row SHALL be created
- **AND** no Reaction of type "bookmark" SHALL be created

### Requirement: Default Favorites shelf per user

Every user SHALL have a "Favorites" shelf. This shelf SHALL be a Shelf Unit with `kindKey = "collection"` and `visibility = "private"`. The Favorites shelf SHALL be created for existing users during migration and for new users at registration time.

#### Scenario: New user registration creates Favorites shelf

- **WHEN** a new user account is created
- **THEN** a Shelf Unit with kindKey "collection" SHALL be automatically created for that user
- **AND** the shelf SHALL have a default title (localizable, e.g., "Favorites")
- **AND** the shelf's visibility SHALL be "private"

#### Scenario: Existing user migration

- **WHEN** the bookmark migration runs
- **THEN** each existing user SHALL receive a Favorites shelf
- **AND** all existing Bookmark rows SHALL be migrated to ShelfItems in the user's Favorites shelf
- **AND** Bookmark.tags SHALL be copied to ShelfItem.keywords

### Requirement: Favorites toggle (heart button)

The system SHALL provide a dedicated toggle endpoint for adding/removing a unit from the user's Favorites shelf. This operation SHALL be independent of the collection modal and the Reaction system.

#### Scenario: Favorite a unit

- **WHEN** a user triggers the favorite toggle on a unit NOT in their Favorites shelf
- **THEN** a `ShelfItem` SHALL be created in the Favorites shelf with `itemRef` referencing the unit and `kind` determined from the unit's type
- **AND** a `ShelfUnit` row with `role='primary'` SHALL be inserted in the same transaction
- **AND** the `ShelfItem` SHALL receive a generated `position` string
- **AND** the response SHALL indicate `isFavorited: true`

#### Scenario: Unfavorite a unit

- **WHEN** a user triggers the favorite toggle on a unit that IS in their Favorites shelf
- **THEN** the `ShelfItem` SHALL be deleted from the Favorites shelf
- **AND** all corresponding `ShelfUnit` rows for that slot SHALL be cascade-deleted via the composite FK from `ShelfUnit` to `ShelfItem`
- **AND** no separate `ShelfItemReview` cleanup SHALL be required (the model has been removed)
- **AND** the response SHALL indicate `isFavorited: false`

#### Scenario: Favorite a review auto-collects the target work

- **WHEN** a user triggers the favorite toggle on a Post with `kind = REVIEW` and `targetUnitId` pointing to a work
- **THEN** the `ShelfItem` SHALL be created with `itemRef` referencing the target work (not the review) and `kind` determined from the target work's type
- **AND** a `ShelfUnit` row with `role='primary'` SHALL be inserted for the target work
- **AND** a `ShelfUnit` row with `role='review'` and `unitId = reviewUnitId` SHALL be inserted in the same transaction, bound to the target work's slot
- **AND** if a `ShelfItem` for the target work already exists in the Favorites shelf, only the `role='review'` `ShelfUnit` row SHALL be inserted (no new slot, no duplicate `role='primary'`)

### Requirement: Collection to multiple shelves

The system SHALL support saving a unit to multiple shelves in a single operation.

#### Scenario: Collect a unit to three shelves

- **WHEN** a user submits a collection request with `targetId` and three `shelfIds`
- **THEN** a `ShelfItem` (plus its `role='primary'` `ShelfUnit` row) SHALL be created in each of the three shelves with the correct `kind`
- **AND** each new slot SHALL receive a generated `position` string in its shelf

#### Scenario: Collect to a shelf where the item already exists

- **WHEN** a user collects a unit to a shelf that already contains that unit
- **THEN** no duplicate `ShelfItem` row SHALL be created
- **AND** no duplicate `role='primary'` `ShelfUnit` row SHALL be created
- **AND** the existing row's `position` SHALL NOT be modified

### Requirement: Collection status check

The system SHALL provide an endpoint to check which of the user's shelves contain a given unit, and whether it is in the Favorites shelf.

#### Scenario: Check status of a collected unit

- **WHEN** a user requests the collection status of a unit that is in two shelves including Favorites
- **THEN** the response SHALL include `isFavorited: true`
- **AND** the response SHALL include the list of shelves containing this unit with their IDs and titles
- **AND** the check SHALL query `ShelfUnit` with `WHERE unitId = U AND role = 'primary'` using the `@@index([unitId, role])` B-tree index

#### Scenario: Check status of a review resolves to target work

- **WHEN** a user requests the collection status of a review Post
- **THEN** the system SHALL resolve the review's `targetUnitId`
- **AND** return the collection status of the target work using the `role='primary'` query above
- **AND** additionally indicate whether the review's unit id appears as a `role='review'` attachment in any of the user's shelves using `WHERE unitId = reviewId AND role = 'review'` against the same B-tree index

### Requirement: Review auto-collection

When a user collects a review (Post with `kind = REVIEW` and a valid `targetUnitId`), the system SHALL auto-collect the target work and record the review on the target work's slot via a `ShelfUnit` row with `role='review'`.

#### Scenario: Collect a review of a book not yet in the shelf

- **WHEN** a user collects a review whose `targetUnitId` references Book A, and Book A is not yet in the selected shelf
- **THEN** a `ShelfItem` SHALL be created with `itemRef = BookA` and `kind = "book"`
- **AND** a `ShelfUnit` row with `role='primary'` for Book A SHALL be inserted
- **AND** a `ShelfUnit` row with `role='review'` and `unitId = reviewUnitId` SHALL be inserted bound to that slot

#### Scenario: Collect a review of a book already in the shelf

- **WHEN** a user collects a review whose `targetUnitId` references Book A, and Book A is already in the selected shelf
- **THEN** no new `ShelfItem` SHALL be created
- **AND** a single `ShelfUnit` row with `role='review'` and `unitId = reviewUnitId` SHALL be inserted bound to Book A's slot, if not already present

#### Scenario: Collect a second review of the same book

- **WHEN** a user collects a second review of Book A in the same shelf
- **THEN** a second `ShelfUnit` row with `role='review'` SHALL exist for Book A's slot, with the new review's unit id
- **AND** the existing review row SHALL be unaffected

#### Scenario: Review with no targetUnitId is collected as a regular unit

- **WHEN** a user collects a Post with `kind = REVIEW` and `targetUnitId` is null
- **THEN** the Post SHALL be collected as a regular slot (`itemRef` = the review's own unit id, `kind = "review"`)
- **AND** only a `role='primary'` `ShelfUnit` row SHALL be inserted (no `role='review'` attachment, since the review is itself the primary)

### Requirement: Dual collection mode for reviews

Reviews SHALL support two collection modes: (1) collect the target work with the review attached via a `role='review'` `ShelfUnit` row (default), and (2) collect the review as an independent slot.

#### Scenario: Collect review as independent unit

- **WHEN** a user explicitly chooses to collect a review as an independent slot
- **THEN** a `ShelfItem` SHALL be created with `itemRef` referencing the review's own unit id and `kind = "review"`
- **AND** only a `role='primary'` `ShelfUnit` row SHALL be inserted for that slot
- **AND** the review's target work SHALL NOT be auto-collected

### Requirement: Remove a review from a shelf item

A user SHALL be able to remove a single review attachment from a shelf slot without removing the slot itself.

#### Scenario: Remove one review from a slot with two reviews

- **GIVEN** a slot `(S, U)` has `role='review'` `ShelfUnit` rows for `[X, Y]`
- **WHEN** a user removes review `X` from the slot
- **THEN** the `ShelfUnit` row `(S, U, X, 'review')` SHALL be deleted
- **AND** the row for `Y` SHALL remain
- **AND** the `ShelfItem` row itself SHALL remain in the shelf

### Requirement: Reaction-shelf decoupling

The Shelf system SHALL be fully independent of the Reaction system. No reaction creation, deletion, or modification SHALL trigger any shelf-related side effect.

#### Scenario: Creating a bookmark reaction does not affect shelves

- **WHEN** a "bookmark" reaction type exists and a user creates such a reaction
- **THEN** no ShelfItem SHALL be created or modified
- **AND** no Bookmark row SHALL be created (Bookmark model is removed)

#### Scenario: Deleting a reaction does not affect shelf items

- **WHEN** a user deletes any reaction on a unit that is in their shelf
- **THEN** the ShelfItem SHALL remain unchanged
