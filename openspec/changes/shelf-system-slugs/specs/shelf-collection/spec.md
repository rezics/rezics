## ADDED Requirements

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
