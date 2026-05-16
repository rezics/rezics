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

### Requirement: SHELF Units may carry slugs under an owner scope

The substrate SHALL permit `SHELF`-typed Units to carry a slug whose `slugScope` references an owner Unit's id (a USER Unit in v1; a REALM Unit in a future change). Uniqueness SHALL follow the global `(slugScope, slug)` composite — multiple users may each have a `favorites` shelf, but a single user SHALL NOT have two shelves with the same slug.

In v1, only contract-defined system shelf `kindKey`s (`favorites`, `backlog`, `active`, `completed`) are eligible for slug minting; user-created shelves SHALL remain slug-less and addressable only by `unitId`. The actual minting of system shelf slugs is owned by the follow-on `shelf-system-slugs` change. This change provides only the substrate.

#### Scenario: SHELF Unit with owner-scoped slug is admissible by the substrate

- **WHEN** a SHELF Unit is created with `slug = "favorites"` and `slugScope = <ownerUserUnitId>`
- **THEN** the database SHALL accept the row
- **AND** the composite `(slugScope, slug)` unique SHALL prevent a second `favorites` shelf with the same owner

#### Scenario: Two users each have a `favorites` shelf

- **GIVEN** users `alice` and `bob` each have a SHELF Unit with `slug = "favorites"`
- **WHEN** the rows are inserted
- **THEN** both SHALL coexist because their `slugScope` values differ (alice's user unit id vs bob's user unit id)

### Requirement: User-created shelves remain slug-less in v1

`shelfService.create` and `shelfService.update` SHALL reject any non-null `slug` value submitted for user-created (non-system) shelves with a typed error. `NewShelfPage` and `ShelfEditPage` SHALL NOT expose a slug input. The constraint mirrors the user-slug immutability stance (`account-identity-boundary`): the slug write surface stays heavily constrained in v1, with substrate ready for expansion when product signal demands it.

#### Scenario: User attempts to create a custom-slugged shelf

- **WHEN** a user submits a shelf create request with `slug = "my-list"`
- **THEN** the request SHALL be rejected with a typed error indicating custom shelf slugs are not enabled in v1
- **AND** no shelf SHALL be created

#### Scenario: User attempts to update an existing shelf with a slug

- **WHEN** a user submits a shelf update payload containing a `slug` field
- **THEN** the request SHALL be rejected with the same typed error
- **AND** the existing shelf SHALL remain unchanged

### Requirement: System shelves are slug-minted at user creation

For every user, the four contract-defined system shelves identified by `SYSTEM_SHELF_KIND_KEYS` (`favorites`, `backlog`, `active`, `completed`) SHALL be created in the same transaction as the `User` row with their corresponding `Unit.slug = kindKey` and `Unit.slugScope = ownerUserUnitId`. The slug write SHALL happen inline with the existing system-shelf bootstrap (no separate phase, no deferred mint). The `(slugScope, slug)` uniqueness defined by `unit-slug` SHALL guarantee that a single user cannot end up with two shelves bearing the same system `kindKey`.

The same minting path SHALL apply when the idempotent safety helper (`getOrCreateSystemShelf`) fires its creation branch — any shelf it creates SHALL carry `slug = kindKey` and `slugScope = ownerUserUnitId`. The helper's lookup branch SHALL resolve existing shelves by `(slugScope, slug)` on the `Unit` table, not by consulting any external pointer map.

#### Scenario: New user registration mints four slugged system shelves

- **WHEN** a new user is provisioned via `userService.create` (or the equivalent profile-setup / internal-materialization path)
- **THEN** in the same transaction, four `Unit { type = SHELF, slug = kindKey, slugScope = user.unitId }` rows SHALL be inserted, one per `SYSTEM_SHELF_KIND_KEYS` entry
- **AND** four `Shelf { unitId, kindKey }` rows SHALL be linked to those Units

#### Scenario: Safety net mints slug when creating a missing system shelf

- **WHEN** `getOrCreateSystemShelf(userId, kindKey)` is invoked and no `Unit { type = SHELF, slug = kindKey, slugScope = userId }` exists for that user
- **THEN** the helper SHALL create one with the matching `slug` and `slugScope` fields set
- **AND** subsequent invocations SHALL return the same `Unit.id` without creating a second row

#### Scenario: Safety net resolves existing system shelf via slug index

- **WHEN** `getOrCreateSystemShelf(userId, kindKey)` is invoked and a slug-bearing system shelf already exists for that user
- **THEN** the helper SHALL return its `Unit.id` from a `(slugScope = userId, slug = kindKey)` lookup
- **AND** no `User.extra.shelves` (or other JSON pointer cache) SHALL be consulted

### Requirement: Owner-scoped shelf slug resolver restricts to system kindKeys in v1

The `GET /shelf/by-slug/:userSlug/:slug` endpoint, whose route shell is provided by `typed-slug-lookup`, SHALL resolve the user identified by `:userSlug`, then resolve a SHELF Unit where `slugScope = user.unitId` AND `slug = :slug`. In v1, the resolver SHALL further restrict the accepted `:slug` value to entries in `SYSTEM_SHELF_KIND_KEYS`. Any other slug SHALL produce a 404, even if a row were to exist with that pairing, providing defense-in-depth alongside the L3 service-layer rejection for user-created shelf custom slugs.

#### Scenario: System shelf is reachable via owner-scoped slug URL

- **WHEN** a client requests `GET /shelf/by-slug/alice/favorites` and user `alice` exists with a system `favorites` shelf
- **THEN** the response SHALL include the shelf payload (same shape returned by `GET /shelf/:unitId`)

#### Scenario: Non-system slug under a real user returns 404

- **WHEN** a client requests `GET /shelf/by-slug/alice/my-custom-list` and user `alice` exists
- **THEN** the response SHALL be a 404, regardless of whether any `Unit { type = SHELF, slug = "my-custom-list", slugScope = alice.unitId }` row exists

#### Scenario: System slug under a non-existent user returns 404

- **WHEN** a client requests `GET /shelf/by-slug/no-such-user/favorites`
- **THEN** the response SHALL be a 404 (user not found)

### Requirement: User-level system shelf pointer map is removed from the user surface

The `User.extra.shelves` JSON property SHALL NOT be a documented surface of the `User` model. The `/user/me` response and every other user-shaped DTO (`User`, `UserBrief`, `UserSummary`, profile responses) SHALL NOT include a `systemShelves` field. Clients SHALL resolve system shelf unit ids through the slug system instead, using `useSlugRef({ scope: viewer.unitId, slug: kindKey })` or an equivalent typed endpoint.

The `User.extra` JSON column itself MAY remain on the schema if other product features use it; only the `shelves` sub-property and its surface exposure are removed.

#### Scenario: `/user/me` response has no systemShelves field

- **WHEN** an authenticated client requests `GET /user/me`
- **THEN** the response body SHALL NOT include a `systemShelves` property
- **AND** the response body SHALL NOT include an `extra.shelves` property

#### Scenario: Frontend resolves favorites shelf via SlugRef

- **WHEN** a logged-in client needs the unit id of the viewer's `favorites` shelf
- **THEN** the client SHALL call `useSlugRef({ scope: viewer.unitId, slug: 'favorites' })` (or the equivalent typed `GET /shelf/by-slug/:userSlug/favorites` endpoint)
- **AND** the resolved id SHALL be cached in the standard SlugRef query cache, not in any system-shelf-specific store
