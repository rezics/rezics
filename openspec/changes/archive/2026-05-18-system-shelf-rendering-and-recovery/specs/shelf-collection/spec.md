## ADDED Requirements

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

## MODIFIED Requirements

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
