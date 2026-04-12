## ADDED Requirements

### Requirement: Shelf replaces Bookmark as the collection mechanism

The Shelf system SHALL serve as the sole mechanism for users to save and organize content. The Bookmark model SHALL be removed. All bookmark functionality — saving units, tagging saved items — SHALL be handled through Shelf and ShelfItem.

#### Scenario: User saves a unit via shelf instead of bookmark

- **WHEN** a user collects a unit of any type (BOOK, GAME, MEDIA, POST, LINK, SHELF, TAG)
- **THEN** a ShelfItem SHALL be created in the selected shelf(s) with `itemUnitId` referencing the unit
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

- **WHEN** a user triggers the favorite toggle on a unit that is NOT in their Favorites shelf
- **THEN** a ShelfItem SHALL be created in the Favorites shelf with `itemUnitId` referencing the unit
- **AND** the response SHALL indicate `isFavorited: true`

#### Scenario: Unfavorite a unit

- **WHEN** a user triggers the favorite toggle on a unit that IS in their Favorites shelf
- **THEN** the ShelfItem SHALL be removed from the Favorites shelf
- **AND** all associated ShelfItemReview rows SHALL be cascade-deleted
- **AND** the response SHALL indicate `isFavorited: false`

#### Scenario: Favorite a review auto-collects the target work

- **WHEN** a user triggers the favorite toggle on a Post with `kindKey = "review"` and `targetUnitId` pointing to a work
- **THEN** the ShelfItem SHALL be created with `itemUnitId` referencing the target work (not the review itself)
- **AND** a ShelfItemReview row SHALL be created linking the review to the ShelfItem

### Requirement: Collection to multiple shelves

The system SHALL support saving a unit to multiple shelves in a single operation. Keywords provided SHALL be applied to all selected shelves.

#### Scenario: Collect a unit to three shelves with keywords

- **WHEN** a user submits a collection request with `targetId`, three `shelfIds`, and keywords `["summer", "gift"]`
- **THEN** a ShelfItem SHALL be created (or updated) in each of the three shelves
- **AND** each ShelfItem SHALL have `keywords: ["summer", "gift"]`
- **AND** the keywords "summer" and "gift" SHALL be merged into `User.keywords` if not already present

#### Scenario: Collect to a shelf where the item already exists

- **WHEN** a user collects a unit to a shelf that already contains that unit
- **THEN** the existing ShelfItem SHALL be updated (keywords merged, not replaced)
- **AND** no duplicate ShelfItem SHALL be created

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
- **AND** additionally indicate whether this specific review is attached as a ShelfItemReview

### Requirement: Review auto-collection

When a user collects a review (Post with `kindKey = "review"` and a valid `targetUnitId`), the system SHALL auto-collect the target work and attach the review.

#### Scenario: Collect a review of a book not yet in the shelf

- **WHEN** a user collects a review whose `targetUnitId` references Book A, and Book A is not yet in the selected shelf
- **THEN** a ShelfItem SHALL be created with `itemUnitId = Book A`
- **AND** a ShelfItemReview SHALL be created with `reviewUnitId = review`

#### Scenario: Collect a review of a book already in the shelf

- **WHEN** a user collects a review whose `targetUnitId` references Book A, and Book A is already in the selected shelf
- **THEN** no new ShelfItem SHALL be created
- **AND** a ShelfItemReview SHALL be created linking the review to the existing ShelfItem

#### Scenario: Collect a second review of the same book

- **WHEN** a user collects a second review of Book A in the same shelf
- **THEN** a second ShelfItemReview SHALL be created alongside the first
- **AND** the ShelfItem for Book A SHALL now have two associated ShelfItemReviews

#### Scenario: Review with no targetUnitId is collected as a regular unit

- **WHEN** a user collects a Post that has `kindKey = "review"` but `targetUnitId` is null
- **THEN** the Post SHALL be collected as a regular unit (ShelfItem with `itemUnitId = post unitId`)
- **AND** no ShelfItemReview SHALL be created

### Requirement: Dual collection mode for reviews

Reviews SHALL support two collection modes: (1) collect the target work with the review attached (default), and (2) collect the review as an independent unit.

#### Scenario: Collect review as independent unit

- **WHEN** a user explicitly chooses to collect a review as an independent unit
- **THEN** a ShelfItem SHALL be created with `itemUnitId` referencing the review's own unitId
- **AND** no ShelfItemReview SHALL be created
- **AND** the review's target work SHALL NOT be auto-collected

### Requirement: Remove a review from a shelf item

A user SHALL be able to remove a single review attachment from a shelf item without removing the item itself.

#### Scenario: Remove one review from a shelf item with two reviews

- **WHEN** a user removes review X from a ShelfItem that has reviews X and Y attached
- **THEN** the ShelfItemReview for review X SHALL be deleted
- **AND** the ShelfItemReview for review Y SHALL remain
- **AND** the ShelfItem itself SHALL remain in the shelf

### Requirement: Shelf view modes

A shelf SHALL support multiple display modes stored in `Shelf.extra.viewMode`. Supported modes: `grid`, `list`, `review`.

#### Scenario: Shelf with review view mode

- **WHEN** a user views a shelf with `extra.viewMode = "review"`
- **THEN** the shelf items SHALL be rendered with the unit as primary display
- **AND** attached reviews (from ShelfItemReview) SHALL be rendered as tabs beneath each unit

#### Scenario: Shelf with grid view mode

- **WHEN** a user views a shelf with `extra.viewMode = "grid"` (or no viewMode set)
- **THEN** the shelf items SHALL be rendered as a cover image grid

#### Scenario: Change shelf view mode

- **WHEN** a user changes a shelf's view mode from "grid" to "review"
- **THEN** the `Shelf.extra` JSON SHALL be updated with `{ "viewMode": "review" }`
- **AND** no ShelfItem data SHALL change (view mode is presentation only)

### Requirement: Created vs. collected filter

Shelf item listings SHALL support filtering by whether the item was created (authored) by the shelf owner or collected from another user.

#### Scenario: Filter for created items

- **WHEN** a user views their shelf with `filter=created`
- **THEN** only items whose underlying unit was authored by the user SHALL be returned
- **AND** authorship SHALL be determined at query time from Post.authorUserId or the Attribution system

#### Scenario: Filter for collected items

- **WHEN** a user views their shelf with `filter=collected`
- **THEN** only items whose underlying unit was NOT authored by the user SHALL be returned

### Requirement: Reaction-shelf decoupling

The Shelf system SHALL be fully independent of the Reaction system. No reaction creation, deletion, or modification SHALL trigger any shelf-related side effect.

#### Scenario: Creating a bookmark reaction does not affect shelves

- **WHEN** a "bookmark" reaction type exists and a user creates such a reaction
- **THEN** no ShelfItem SHALL be created or modified
- **AND** no Bookmark row SHALL be created (Bookmark model is removed)

#### Scenario: Deleting a reaction does not affect shelf items

- **WHEN** a user deletes any reaction on a unit that is in their shelf
- **THEN** the ShelfItem SHALL remain unchanged
