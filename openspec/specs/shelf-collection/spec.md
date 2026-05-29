# shelf-collection Specification

## Purpose

Defines the Shelf system as the single collection surface that
replaces the legacy Bookmark model. Owns the default per-user
Favorites shelf, the favorite-toggle endpoint (with review →
auto-collect-work semantics), multi-shelf collection in one
operation, attachment relations (`role='tag'` / `role='review'`),
order via fractional `position`, and the API contracts that the
collection modal and heart button consume.

## Requirements

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

### Requirement: System shelf labels live in @rezics/contract

The canonical English labels for the four system shelves SHALL be exported from `@rezics/contract` as `SYSTEM_SHELF_LABELS: Record<SystemShelfKindKey, string>`. The contract SHALL also export a `formatSystemShelfTitle(slug, kindKey, label?)` helper that returns the canonical bootstrap title in the form `${slug}'s ${label ?? SYSTEM_SHELF_LABELS[kindKey]}`. The server bootstrap path and the factory seed copy SHALL both import from the contract; the previously duplicated `SYSTEM_SHELF_TITLES` literals in `package/server/src/shelf/system-shelves.ts` and `package/server/prisma/factory/system-shelves.ts` SHALL be removed.

#### Scenario: Server bootstrap imports labels from contract

- **WHEN** `bootstrapSystemShelves` runs for a new user with slug `alice`
- **THEN** the four created shelves SHALL have `Unit.translations[en].title` equal to `formatSystemShelfTitle("alice", kindKey)` for each kindKey
- **AND** the helper output SHALL be `alice's Favorites`, `alice's Backlog`, `alice's Active`, `alice's Completed`

#### Scenario: Factory seed shares the same title format

- **WHEN** the factory creates a synthetic user with slug `synth_42`
- **THEN** the four system shelves SHALL receive titles produced by the contract `formatSystemShelfTitle` helper
- **AND** no local `SYSTEM_SHELF_TITLES` literal SHALL exist in `package/server/prisma/factory/system-shelves.ts`

### Requirement: System shelves are slug-minted at user creation

For every user, the four contract-defined system shelves identified by `SYSTEM_SHELF_KIND_KEYS` (`favorites`, `backlog`, `active`, `completed`) SHALL be created in the same transaction as the `User` row with their corresponding `Unit.slug = kindKey`, `Unit.slugScope = ownerUserUnitId`, and `Unit.translations[en].title = formatSystemShelfTitle(ownerUserSlug, kindKey)`. The bootstrap helper `bootstrapSystemShelves(userId, userSlug, tx)` SHALL accept the owner's slug as a required parameter; callers (`userService.create`, `completeProfileSetup`, internal `/users/provision`, factory seed, and the seed fixture path `seedServerUser`) SHALL pass the slug they already hold in scope. The slug write SHALL happen inline with the bootstrap (no separate phase, no deferred mint). The `(slugScope, slug)` uniqueness defined by `unit-slug` SHALL guarantee that a single user cannot end up with two shelves bearing the same system `kindKey`.

The same minting path SHALL apply when the idempotent safety helper `ensureSystemShelf` fires its creation branch (invoked exclusively from `POST /shelf/system/ensure`) — any shelf it creates SHALL carry `slug = kindKey`, `slugScope = ownerUserUnitId`, and `Unit.translations[en].title = formatSystemShelfTitle(ownerUserSlug, kindKey)`. The helper's lookup branch SHALL resolve existing shelves by `(slugScope, slug)` on the `Unit` table, not by consulting any external pointer map.

The bootstrap path SHALL NOT rewrite shelf titles when a user's slug changes later. The stored title format is fixed at creation time; subsequent updates flow through the standard `PUT /shelf/:unitId` endpoint with no system-shelf-specific behavior on the server.

#### Scenario: New user registration mints four slugged system shelves

- **WHEN** a new user with slug `alice` is provisioned via `userService.create` (or the equivalent profile-setup / internal-materialization path)
- **THEN** in the same transaction, four `Unit { type = SHELF, slug = kindKey, slugScope = user.unitId, translations: { en: { title: "alice's <Label>" } } }` rows SHALL be inserted, one per `SYSTEM_SHELF_KIND_KEYS` entry
- **AND** four `Shelf { unitId, kindKey }` rows SHALL be linked to those Units
- **AND** the title strings SHALL be `alice's Favorites`, `alice's Backlog`, `alice's Active`, `alice's Completed`

#### Scenario: Safety net mints slug when creating a missing system shelf

- **WHEN** `ensureSystemShelf(userId, userSlug, kindKey)` is invoked (via `POST /shelf/system/ensure`) and no `Unit { type = SHELF, slug = kindKey, slugScope = userId }` exists for that user
- **THEN** the helper SHALL create one with the matching `slug` and `slugScope` fields set and the title computed by `formatSystemShelfTitle(userSlug, kindKey)`
- **AND** subsequent invocations SHALL return the same `Unit.id` without creating a second row

#### Scenario: Safety net resolves existing system shelf via slug index

- **WHEN** `ensureSystemShelf(userId, userSlug, kindKey)` is invoked and a slug-bearing system shelf already exists for that user
- **THEN** the helper SHALL return its `Unit.id` from a `(slugScope = userId, slug = kindKey)` lookup
- **AND** no `User.extra.shelves` (or other JSON pointer cache) SHALL be consulted
- **AND** the existing shelf's title SHALL NOT be overwritten

#### Scenario: User rename does not rewrite shelf titles

- **GIVEN** alice (slug `alice`) has a favorites shelf with DB title `alice's Favorites`
- **WHEN** alice renames her slug to `alicia` through the standard profile update path
- **THEN** the shelf DB title SHALL remain `alice's Favorites` until alice manually edits it
- **AND** the server SHALL NOT issue any title-rewrite query in response to the slug change

### Requirement: Idempotent ensure route for missing system shelves

The server SHALL expose `POST /shelf/system/ensure` as an authenticated route that idempotently creates a missing system shelf for the calling user. The request body SHALL be `{ kindKey: SystemShelfKindKey }`. The response SHALL be `{ unitId: string, created: boolean }`. The route SHALL:

- Resolve the caller's slug from the User row associated with `identity.userId`.
- Call the internal `ensureSystemShelf(userId, userSlug, kindKey)` helper.
- Return `created: false` when the shelf already existed; `created: true` when the helper's create branch fired.
- Create the shelf with `visibility = PRIVATE` and `Unit.translations[en].title = formatSystemShelfTitle(slug, kindKey)`. The route SHALL NOT accept `visibility`, `title`, or any other body parameter; auxiliary fields SHALL produce a validation error.
- NOT perform any automatic retry, polling, or backoff. A failed ensure call surfaces the error to the client; the user retriggers the route via their own action.

The route exists as the recovery path for users in an inconsistent post-registration state (e.g., a partial seed run); it SHALL NOT be called in normal application flow.

#### Scenario: Ensure route creates a missing favorites shelf

- **GIVEN** user `alice` exists with no `Unit { type: SHELF, slug: "favorites", slugScope: alice.unitId }`
- **WHEN** the client sends `POST /shelf/system/ensure { "kindKey": "favorites" }` authenticated as alice
- **THEN** the response SHALL be `{ unitId, created: true }` where `unitId` references a newly-inserted shelf
- **AND** the shelf SHALL have `visibility = PRIVATE` and title `alice's Favorites`

#### Scenario: Ensure route is a no-op when shelf exists

- **GIVEN** user `alice` already has a `favorites` system shelf with `Unit.id = U`
- **WHEN** the client sends `POST /shelf/system/ensure { "kindKey": "favorites" }`
- **THEN** the response SHALL be `{ unitId: U, created: false }`
- **AND** no new Unit or Shelf row SHALL be inserted
- **AND** the existing shelf's title and visibility SHALL be unchanged

#### Scenario: Ensure route rejects unauthenticated requests

- **WHEN** an unauthenticated client sends `POST /shelf/system/ensure`
- **THEN** the response SHALL be a 401 authentication error
- **AND** no shelf SHALL be created

#### Scenario: Ensure route rejects unknown kindKey

- **WHEN** the client sends `POST /shelf/system/ensure { "kindKey": "custom_list" }`
- **THEN** the response SHALL be a 400 validation error
- **AND** no shelf SHALL be created

#### Scenario: Ensure route rejects auxiliary body parameters

- **WHEN** the client sends `POST /shelf/system/ensure { "kindKey": "favorites", "visibility": "PUBLIC" }`
- **THEN** the response SHALL be a 400 validation error
- **AND** no shelf SHALL be created

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

### Requirement: Collection service surfaces missing system shelves as 404

The `collection.service.ts` mutation paths (`toggleFavorite`, `getCollectionStatus`, `getCollectionStatusBatch`, and any other operation that depends on the favorites system shelf) SHALL resolve the favorites shelf via a read-only lookup (`findSystemShelf(userId, "favorites")`). If the row is absent, the operation SHALL throw `AppError(404, "system_shelf_missing", { kindKey })` with the kindKey reflected in the structured error payload. The service SHALL NOT silently create a missing system shelf; recovery is the client's responsibility via the ensure route.

#### Scenario: Toggle favorite on missing shelf returns 404 with kindKey

- **GIVEN** user `alice` has no `favorites` system shelf
- **WHEN** alice triggers `POST /shelf/collection/favorite/:targetId`
- **THEN** the response SHALL be a 404 error
- **AND** the response body SHALL include `error.code = "system_shelf_missing"` and `error.kindKey = "favorites"`
- **AND** no shelf or shelf-unit row SHALL be created

#### Scenario: Collection status on missing favorites shelf returns 404

- **GIVEN** user `alice` has no `favorites` system shelf
- **WHEN** alice requests `GET /shelf/collection/status/:targetId`
- **THEN** the response SHALL be a 404 error with `error.code = "system_shelf_missing"`

### Requirement: CollectionModal renders favorites as the only system shelf

The `CollectionModal` frontend component SHALL filter its rendered shelf list using the contract `SYSTEM_SHELF_KIND_KEYS` constant. Shelves whose `kindKey` is `backlog`, `active`, or `completed` SHALL be excluded entirely from the modal. The `favorites` shelf SHALL be included and SHALL be rendered with its label resolved via the application's i18n table (`t('shelf.system.favorites')`), not the DB-stored title. User-created (non-system) shelves SHALL be unaffected by this filter and SHALL continue to render with their DB titles.

#### Scenario: Backlog is hidden from the collect picker

- **GIVEN** user `alice` has all four system shelves plus two user-created shelves
- **WHEN** alice opens the `CollectionModal` for any unit
- **THEN** the modal SHALL render the `favorites` shelf and the two user-created shelves
- **AND** the `backlog`, `active`, and `completed` shelves SHALL NOT appear in the modal
- **AND** alice SHALL NOT be able to collect a unit to those three shelves through the modal

#### Scenario: Favorites label is rendered via i18n

- **GIVEN** alice's `favorites` shelf has DB title `alice's Favorites`
- **AND** alice's app locale is `zh`
- **WHEN** alice opens the `CollectionModal`
- **THEN** the favorites row label SHALL render the i18n result for `shelf.system.favorites` in zh (e.g., `收藏`)
- **AND** the modal SHALL NOT show the literal string `alice's Favorites`

#### Scenario: User-created shelves render unchanged

- **GIVEN** alice has a user-created shelf with title `Vintage Sci-Fi`
- **WHEN** alice opens the `CollectionModal`
- **THEN** the shelf SHALL render with the literal title `Vintage Sci-Fi`
- **AND** no i18n lookup SHALL apply to that title

### Requirement: System shelf detail page renders title by viewer role

The shelf detail page resolved at `/u/:userSlug/shelf/:slug` (and equivalent owner-self routes) SHALL render the shelf's display label according to viewer role:

- **Owner-self view** (the authenticated viewer is the shelf's owner): the page header and any chrome label SHALL render via the application's i18n table keyed on `kindKey` (e.g., `t('shelf.system.favorites')`).
- **Non-owner view** (the viewer is anyone else, including unauthenticated): the page header SHALL render the DB-stored `Unit.translations[viewerLang].title` if present, falling back to the `en` translation (e.g., `alice's Favorites`).

User-created (non-system) shelves SHALL always render the DB-stored title regardless of viewer role.

#### Scenario: Owner viewing own favorites shelf sees i18n label

- **GIVEN** alice has a favorites shelf with DB title `alice's Favorites`
- **AND** alice's app locale is `zh`
- **WHEN** alice navigates to her favorites shelf detail page
- **THEN** the page header SHALL display the zh i18n result for `shelf.system.favorites`
- **AND** the page SHALL NOT display the literal string `alice's Favorites`

#### Scenario: Non-owner viewing alice's favorites shelf sees DB title

- **GIVEN** alice has a favorites shelf with DB title `alice's Favorites` and `visibility = PUBLIC`
- **WHEN** bob (or an unauthenticated visitor) navigates to alice's favorites shelf detail page
- **THEN** the page header SHALL display `alice's Favorites` (or the localized DB translation if alice has added one)
- **AND** the i18n key `shelf.system.favorites` SHALL NOT be applied

### Requirement: Favorites shelf is private collection state
The Favorites system shelf SHALL be treated as private collection state, not public shelf discovery content.

#### Scenario: Book review page loads shelf preview
- **WHEN** a book review page requests shelf previews for the book
- **THEN** another user's Favorites shelf SHALL NOT appear in the preview

#### Scenario: Owner collection status checks favorites
- **WHEN** an authenticated owner checks whether a Unit is in Favorites
- **THEN** the collection status API MAY use the owner's private Favorites shelf

### Requirement: Book shelf preview uses containsUnitId
Book shelf preview clients SHALL query shelf lists with the `containsUnitId` filter.

#### Scenario: Shelf preview requests shelves for a book
- **WHEN** the app requests shelves for a book detail or review surface
- **THEN** the request SHALL send `containsUnitId` equal to the book Unit ID
- **AND** it SHALL NOT use an unsupported `containsItemRef` filter

### Requirement: Shelf Stores Visible Release Units By Default

For release-aware domains, shelf membership SHALL store the visible release Unit
that the user collected. The shelf system SHALL NOT require adding the hidden
work Unit as a separate invisible shelf item for normal collection behavior.

#### Scenario: User collects release

- **WHEN** a user collects book release `release-a`
- **THEN** `ShelfUnit.unitId` SHALL reference `release-a`
- **AND** the hidden work Unit SHALL NOT be inserted as an additional
  user-visible shelf item

#### Scenario: Concrete release remains visible

- **GIVEN** `ShelfUnit(unitId = release-a)` exists
- **AND** `UnitWork(release-a, work-x, role = RELEASE)` exists
- **WHEN** the shelf item is rendered in a release-aware context
- **THEN** the UI SHALL still expose that the collected concrete Unit is
  `release-a`

### Requirement: Shelves Register Work-Domain Membership

The system SHALL register shelf Units in work domains when they contain releases
that belong to those work domains. The shelf Unit SHALL be registered with
`UnitWork(role = SHELF)`. This is the generic Unit-based work-domain membership
path, not a shelf-specific work projection field.

#### Scenario: Shelf containing release enters work domain

- **GIVEN** `UnitWork(release-a, work-x, role = RELEASE)` exists
- **WHEN** shelf `shelf-s` contains `release-a`
- **THEN** `UnitWork(shelf-s, work-x, role = SHELF)` SHALL exist
- **AND** work-domain surfaces for `work-x` MAY list `shelf-s` as related
  content

#### Scenario: Shelf can belong to multiple work domains

- **GIVEN** shelf `shelf-s` contains `release-a` from `work-a`
- **AND** it contains `release-b` from `work-b`
- **WHEN** work-domain membership is reconciled
- **THEN** `UnitWork(shelf-s, work-a, role = SHELF)` SHALL exist
- **AND** `UnitWork(shelf-s, work-b, role = SHELF)` SHALL exist

### Requirement: Shelf Work Membership Is Reconciled From Contained Releases

Shelf work-domain membership SHALL be maintained from the shelf's contained
release Units. Add/remove operations and release move/merge repair SHALL
recalculate affected shelf memberships rather than blindly deleting a work
membership that may still be justified by another contained release.

#### Scenario: Removing one same-work release keeps membership

- **GIVEN** shelf `shelf-s` contains `release-a` and `release-b`
- **AND** both releases belong to `work-x`
- **WHEN** `release-a` is removed from `shelf-s`
- **THEN** `UnitWork(shelf-s, work-x, role = SHELF)` SHALL remain because
  `release-b` still justifies it

#### Scenario: Removing final same-work release removes membership

- **GIVEN** shelf `shelf-s` contains only one release from `work-x`
- **WHEN** that release is removed from `shelf-s`
- **THEN** reconciliation SHALL remove `UnitWork(shelf-s, work-x, role = SHELF)`
  unless another explicit work-domain rule justifies the membership

### Requirement: Work-Domain Shelf Cards Show Precise Release Context

When a shelf appears inside a release page's work-domain surface, the card SHALL
show which contained releases caused the shelf to belong to the current work
when that context is relevant. If those releases differ from the current
release, the card SHALL render their release-identifying metadata.

#### Scenario: Shelf card shows sibling release context

- **GIVEN** current page release is `release-b`
- **AND** shelf `shelf-s` belongs to the current work because it contains
  `release-a`
- **WHEN** `shelf-s` renders in the work-domain shelf section
- **THEN** the card SHALL show identifying metadata for `release-a`
- **AND** it SHALL NOT imply that `shelf-s` contains `release-b`

### Requirement: Shelf Grouping Follows Canonical Work After Merge

Shelf storage SHALL remain release-first during work merge. Work merge SHALL NOT
rewrite raw shelf membership rows unless a separate explicit shelf operation
requires it. Shelf work-domain membership SHALL resolve merged source works to
the target canonical work after merge repair.

#### Scenario: Shelf belongs to target work after merge

- **GIVEN** a shelf contains release `release-a`
- **AND** `release-a` belonged to source work `work-old`
- **AND** `work-old` has been merged into `work-new`
- **WHEN** shelf work-domain repair completes
- **THEN** `UnitWork(shelf, work-new, role = SHELF)` SHALL exist
- **AND** stale membership justified only by `work-old` SHALL be removed
- **AND** the raw shelf row SHALL continue to reference `release-a`

### Requirement: Shelf List Distinguishes Exact Unit And Work-Domain Containment

The shelf list API SHALL treat `containsUnitId` as an exact `ShelfUnit.unitId`
containment filter. The shelf list API SHALL provide `containsWorkUnitId` for
work-domain shelf lookup through `UnitWork(role = SHELF)`.

`containsUnitId` and `containsWorkUnitId` SHALL NOT be accepted together in the
same request in v1. A request that provides both filters SHALL fail with a
validation error rather than applying ambiguous AND or OR semantics.

#### Scenario: Exact release containment

- **WHEN** a client lists shelves with `containsUnitId = release-a`
- **THEN** the response SHALL include shelves that contain `ShelfUnit.unitId = release-a`
- **AND** it SHALL NOT include a shelf only because it contains sibling release `release-b`

#### Scenario: Work-domain shelf containment

- **GIVEN** release Units `release-a` and `release-b` belong to work `work-x`
- **AND** shelf `shelf-s` contains `release-b`
- **AND** `UnitWork(shelf-s, work-x, role = SHELF)` exists
- **WHEN** a client lists shelves with `containsWorkUnitId = work-x`
- **THEN** `shelf-s` SHALL be included
- **AND** the response MAY identify `release-b` as the matched contained release

#### Scenario: Ambiguous shelf filters rejected

- **WHEN** a client lists shelves with both `containsUnitId` and `containsWorkUnitId`
- **THEN** the API SHALL reject the request with a validation error
- **AND** it SHALL NOT silently choose one filter

### Requirement: Release-Aware Shelf Surfaces Default To Work-Domain Results

Book shelf previews, shelf counts, and shelf-by-book pages SHALL use
`containsWorkUnitId` when the current visible release has a canonical
`UnitWork(role = RELEASE)` work domain. These surfaces SHALL fall back to
`containsUnitId` when the current Unit has no work domain.

Where the UI offers a scope toggle, the exact-release option SHALL query
`containsUnitId` and the all-releases option SHALL query `containsWorkUnitId`.

#### Scenario: Book shelf preview for release with work

- **GIVEN** the current book release belongs to work `work-x`
- **WHEN** the app loads a shelf preview for that book page
- **THEN** the request SHALL use `containsWorkUnitId = work-x`
- **AND** it SHALL NOT rely on `containsUnitId` to expand sibling releases

#### Scenario: Book shelf preview for standalone unit

- **GIVEN** the current book Unit has no work-domain release membership
- **WHEN** the app loads a shelf preview for that book page
- **THEN** the request SHALL use `containsUnitId` with the current Unit id

### Requirement: Shelf collection supports complete library workflows

Shelf collection behavior SHALL support add, remove, reorder, status/progress context, work/release-aware display, and dashboard/profile integration. For book items, the per-card progress hint SHALL surface the user's `UserUnitProgress.status`, the `chaptersCompleted/chaptersTotal` count derived from `UserContentNodeProgress`, and the `lastReadNodeId`-resolved chapter title when present. These values SHALL come from server-aggregated DTOs (e.g. `DashboardSummary`, shelf list responses) so cards do not need to fetch per-book TOC and node-completion rows separately.

#### Scenario: User reorders shelf item

- **WHEN** a user reorders items on their shelf
- **THEN** the order SHALL persist and remain stable after reload

#### Scenario: Bookshelf hover preview shows reading progress

- **GIVEN** a book card in `bookshelf` view on a pointer device
- **WHEN** the viewer hovers the card
- **THEN** the side preview panel SHALL display the `chaptersCompleted/chaptersTotal` count and the last-read chapter title for the viewer when progress data exists
- **AND** when the viewer has no progress for that book the panel SHALL omit the progress line rather than render a zero/empty placeholder

### Requirement: Shelf supports a bookshelf view for library content

Shelf rendering SHALL support a `bookshelf` view mode that renders only library-content kinds (`book`, `game`, `media`) as fixed aspect-ratio covers in a responsive grid, and SHALL silently skip other kinds. Aspect ratios SHALL be fixed per kind via constants exported from `@rezics/contract`; the values are independent so each kind can change without affecting the others.

The bookshelf view SHALL be selectable on any shelf surface that already exposes view modes (user shelf pages, realm shelf pages, dashboard library sections). Bookshelf view is a presentation layer over the existing shelf model; it SHALL NOT introduce a parallel "dashboard widget" abstraction or duplicate shelf item DTOs.

#### Scenario: Bookshelf view filters non-library items

- **GIVEN** a shelf containing books, reviews, posts, and tags
- **WHEN** the viewer switches the shelf to bookshelf view
- **THEN** only `book`, `game`, and `media` items SHALL render in the grid
- **AND** the other kinds SHALL be omitted without an error

### Requirement: Bookshelf view uses a per-viewer responsive layout config

Bookshelf layout SHALL be controlled by a `BookshelfViewConfig` exported from `@rezics/contract`, consisting of `breakpoints: Array<{ minWidthPx: number; columns: number }>` and `showTitle: boolean`. The contract SHALL export `DEFAULT_BOOKSHELF_CONFIG` used when no viewer preference exists.

The active config SHALL be resolved in this order: URL query override → the viewing user's `userSettings.library.bookshelf` → contract default. Resolution is per-viewer, not per-shelf-owner: whoever is looking at the shelf decides how it renders. The view SHALL expose a "use my settings" affordance that clears URL overrides so the viewer's stored preference (or default) takes effect.

#### Scenario: URL override beats viewer preference

- **GIVEN** a viewer whose stored preference is 4 columns at the largest breakpoint
- **WHEN** they open a shelf link with a bookshelf URL override of 8 columns
- **THEN** the shelf SHALL render at 8 columns at that breakpoint
- **AND** activating "use my settings" SHALL re-render at 4 columns

#### Scenario: No preference falls back to contract default

- **WHEN** a viewer with no stored bookshelf preference opens a bookshelf view without URL override
- **THEN** the layout SHALL use `DEFAULT_BOOKSHELF_CONFIG`

### Requirement: Bookshelf card hover preview is desktop-only

Bookshelf card hover previews SHALL open a side info panel only on devices that support hover. On devices without hover (touch), tapping a bookshelf card SHALL navigate directly to the item's detail page without opening a preview.

#### Scenario: Pointer device hover opens preview

- **WHEN** a pointer device hovers a bookshelf card
- **THEN** a side preview panel SHALL open
- **AND** the page SHALL NOT navigate

#### Scenario: Touch device tap navigates

- **WHEN** a touch device taps a bookshelf card
- **THEN** the app SHALL navigate to the item detail page
- **AND** no hover preview SHALL appear
