## MODIFIED Requirements

### Requirement: User-level system shelf pointers

The system SHALL bootstrap all four system shelves identified by `SYSTEM_SHELF_KIND_KEYS` (`favorites`, `backlog`, `active`, `completed`) at user registration, inside the same transaction as the `User` row. Each system shelf SHALL be created as a `Unit { type = SHELF, slug = kindKey, slugScope = ownerUserUnitId, translations: { en: { title: formatSystemShelfTitle(ownerSlug, kindKey) } } }` row paired with a `Shelf { unitId, kindKey }` row. The canonical lookup index for system shelves SHALL be the composite `(slugScope, slug)` unique on `Unit`, not any JSON pointer map. The canonical English labels and the `formatSystemShelfTitle` helper SHALL be sourced from `@rezics/contract`; no server-local or factory-local duplicates SHALL exist.

The system SHALL retain an idempotent safety helper named `ensureSystemShelf(userId, userSlug, kindKey)` for users provisioned outside the standard registration path (e.g., fixtures bypassing `userService.create`, partial seed runs, fixture-user paths in `package/utils/src/seed/users.ts`). The helper SHALL be invoked exclusively from `POST /shelf/system/ensure` and from the eager bootstrap path (`bootstrapSystemShelves`); it SHALL NOT be called from any mutation hot-path. When its creation branch fires, the helper SHALL set both `slug` and `slugScope` on the inserted `Unit` row and SHALL set the title via `formatSystemShelfTitle(userSlug, kindKey)`. The four system `kindKey`s SHALL remain reserved — user-created shelves SHALL NOT be permitted to use them.

The previous `User.extra.shelves` JSON map SHALL be removed from the `User` model surface. Existing dev / staging databases SHALL be reseeded; no per-row data backfill is shipped (the project is in active development per `CLAUDE.md`).

#### Scenario: Registration populates all four system shelves with slugs

- **WHEN** a new user with slug `alice` completes registration
- **THEN** the system SHALL create four `Unit { type = SHELF, slug = kindKey, slugScope = user.unitId }` rows (one per system `kindKey`) in the same transaction as the `User` row
- **AND** each Unit SHALL have a single `en` translation with title `formatSystemShelfTitle("alice", kindKey)` (`alice's Favorites`, `alice's Backlog`, `alice's Active`, `alice's Completed`)
- **AND** the corresponding four `Shelf { unitId, kindKey }` rows SHALL be linked

#### Scenario: Safety net heals a missing system shelf via the ensure route

- **WHEN** `POST /shelf/system/ensure { kindKey: "favorites" }` is invoked authenticated as user `alice` whose corresponding `(slugScope = alice.unitId, slug = "favorites")` Unit row is missing
- **THEN** the route SHALL invoke `ensureSystemShelf(alice.unitId, "alice", "favorites")` which creates the shelf with `slug`, `slugScope`, and title set
- **AND** the route SHALL return `{ unitId, created: true }`
- **AND** subsequent invocations SHALL resolve via the slug index without creating a second row and SHALL return `created: false`

#### Scenario: Safety net is not called from collection mutations

- **WHEN** `collection.service.ts` mutation paths (`toggleFavorite`, `getCollectionStatus`, `getCollectionStatusBatch`) need the favorites shelf id
- **THEN** they SHALL use a read-only lookup
- **AND** if the row is missing, the service SHALL throw `AppError(404, "system_shelf_missing", { kindKey })`
- **AND** the service SHALL NOT invoke `ensureSystemShelf` as a silent recovery

#### Scenario: System kindKeys are reserved for system shelves

- **WHEN** a user attempts to create a shelf with `kindKey` equal to `favorites`, `backlog`, `active`, or `completed`
- **THEN** the system SHALL reject the request with a validation error
- **AND** no shelf SHALL be created
