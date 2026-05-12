## ADDED Requirements

### Requirement: Shelf replaces Bookmark as the collection mechanism

The Shelf system SHALL serve as the sole mechanism for users to save and organize content. The Bookmark model SHALL be removed. All bookmark functionality — saving units and tagging saved units — SHALL be handled through `Shelf`, `ShelfUnit`, and `ShelfUnitRelation`.

#### Scenario: User saves a unit via shelf instead of bookmark

- **WHEN** a user collects a unit of any type
- **THEN** a `ShelfUnit` SHALL be created in each selected shelf with `unitId` referencing the unit and `kind` determined from the unit's type
- **AND** the `ShelfUnit` SHALL receive a generated `position` string at the end of the shelf's current order
- **AND** no `role='primary'` relation SHALL be created
- **AND** no Bookmark row SHALL be created

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
- **AND** all existing Bookmark rows SHALL be migrated to `ShelfUnit` rows in the user's Favorites shelf
- **AND** Bookmark.tags SHALL be migrated by ensuring tag `ShelfUnit` rows exist and inserting `ShelfUnitRelation(role='tag')` edges from the migrated unit to those tag units

### Requirement: Favorites toggle (heart button)

The system SHALL provide a dedicated toggle endpoint for adding/removing a unit from the user's Favorites shelf. This operation SHALL be independent of the collection modal and the Reaction system.

#### Scenario: Favorite a unit

- **WHEN** a user triggers the favorite toggle on a unit NOT in their Favorites shelf
- **THEN** a `ShelfUnit` SHALL be created in the Favorites shelf with `unitId` referencing the unit and `kind` determined from the unit's type
- **AND** the `ShelfUnit` SHALL receive a generated `position` string
- **AND** the response SHALL indicate `isFavorited: true`

#### Scenario: Unfavorite a unit

- **WHEN** a user triggers the favorite toggle on a unit that IS in their Favorites shelf
- **THEN** the `ShelfUnit` SHALL be deleted from the Favorites shelf
- **AND** relation rows involving that shelf unit SHALL be cascade-deleted
- **AND** the response SHALL indicate `isFavorited: false`

#### Scenario: Favorite a review auto-collects the target work

- **WHEN** a user triggers the favorite toggle on a Post with `kind = REVIEW` and `targetUnitId` pointing to a work
- **THEN** a `ShelfUnit` SHALL exist for the target work
- **AND** a `ShelfUnit` SHALL exist for the review
- **AND** a `ShelfUnitRelation` with `role='review'` SHALL link the target work parent to the review child

### Requirement: Collection to multiple shelves

The system SHALL support saving a unit to multiple shelves in a single operation.

#### Scenario: Collect a unit to three shelves

- **WHEN** a user submits a collection request with `targetId` and three `shelfIds`
- **THEN** a `ShelfUnit` SHALL be created in each of the three shelves with the correct `kind`
- **AND** each new unit SHALL receive a generated `position` string in its shelf

#### Scenario: Collect to a shelf where the unit already exists

- **WHEN** a user collects a unit to a shelf that already contains that unit
- **THEN** no duplicate `ShelfUnit` row SHALL be created
- **AND** the existing row's `position` SHALL NOT be modified

### Requirement: Collection status check

The system SHALL provide an endpoint to check which of the user's shelves contain a given unit, and whether it is in the Favorites shelf.

#### Scenario: Check status of a collected unit

- **WHEN** a user requests the collection status of a unit that is in two shelves including Favorites
- **THEN** the response SHALL include `isFavorited: true`
- **AND** the response SHALL include the list of shelves containing this unit with their IDs and titles
- **AND** the check SHALL query `ShelfUnit` containment by `unitId`

#### Scenario: Check status of a review resolves to target work

- **WHEN** a user requests the collection status of a review Post
- **THEN** the system SHALL resolve the review's `targetUnitId`
- **AND** return the collection status of the target work
- **AND** additionally indicate whether the review's unit id appears as a `role='review'` child in any of the user's shelves

### Requirement: Review auto-collection

When a user collects a review with a valid `targetUnitId`, the system SHALL auto-collect the target work, create or reuse a review child `ShelfUnit`, and record the review attachment via `ShelfUnitRelation(role='review')`.

#### Scenario: Collect a review of a book not yet in the shelf

- **WHEN** a user collects a review whose `targetUnitId` references Book A, and Book A is not yet in the selected shelf
- **THEN** a `ShelfUnit` SHALL be created for Book A
- **AND** a `ShelfUnit` SHALL be created for the review
- **AND** a `ShelfUnitRelation` SHALL link Book A to the review with `role='review'`

#### Scenario: Collect a review of a book already in the shelf

- **WHEN** a user collects a review whose `targetUnitId` references Book A, and Book A is already in the selected shelf
- **THEN** no new Book A `ShelfUnit` SHALL be created
- **AND** a review child `ShelfUnit` and `role='review'` relation SHALL be created if missing

#### Scenario: Review with no targetUnitId is collected as a regular unit

- **WHEN** a user collects a Post with `kind = REVIEW` and `targetUnitId` is null
- **THEN** the Post SHALL be collected as a regular `ShelfUnit` (`unitId` = the review's own unit id, `kind = "review"`)
- **AND** no `ShelfUnitRelation` row SHALL be created

### Requirement: Dual collection mode for reviews

Reviews SHALL support two collection modes: (1) collect the target work with the review attached via a `ShelfUnitRelation(role='review')` edge (default), and (2) collect the review as an independent unit.

#### Scenario: Collect review as independent unit

- **WHEN** a user explicitly chooses to collect a review as an independent unit
- **THEN** a `ShelfUnit` SHALL be created with `unitId` referencing the review's own unit id and `kind = "review"`
- **AND** no `ShelfUnitRelation` SHALL be created for that unit
- **AND** the review's target work SHALL NOT be auto-collected

### Requirement: Remove a review from a shelf item

A user SHALL be able to remove a single review attachment from a parent shelf unit without removing either shelf unit itself.

#### Scenario: Remove one review from a parent with two reviews

- **GIVEN** parent unit `B` has `role='review'` children `[X, Y]`
- **WHEN** a user removes review `X` from `B`
- **THEN** the `ShelfUnitRelation(B, X, 'review')` row SHALL be deleted
- **AND** the relation for `Y` SHALL remain
- **AND** both `ShelfUnit(B)` and `ShelfUnit(X)` SHALL remain in the shelf unless separately deleted

### Requirement: Reaction-shelf decoupling

The Shelf system SHALL be fully independent of the Reaction system. No reaction creation, deletion, or modification SHALL trigger any shelf-related side effect.

#### Scenario: Creating a bookmark reaction does not affect shelves

- **WHEN** a "bookmark" reaction type exists and a user creates such a reaction
- **THEN** no `ShelfUnit` SHALL be created or modified
- **AND** no Bookmark row SHALL be created (Bookmark model is removed)

#### Scenario: Deleting a reaction does not affect shelf units

- **WHEN** a user deletes any reaction on a unit that is in their shelf
- **THEN** the `ShelfUnit` SHALL remain unchanged
