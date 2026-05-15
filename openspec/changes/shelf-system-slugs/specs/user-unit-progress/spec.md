## MODIFIED Requirements

### Requirement: User-level system shelf pointers

The system SHALL bootstrap all four system shelves identified by `SYSTEM_SHELF_KIND_KEYS` (`favorites`, `backlog`, `active`, `completed`) at user registration, inside the same transaction as the `User` row. Each system shelf SHALL be created as a `Unit { type = SHELF, slug = kindKey, slugScope = ownerUserUnitId }` row paired with a `Shelf { unitId, kindKey }` row. The canonical lookup index for system shelves SHALL be the composite `(slugScope, slug)` unique on `Unit`, not any JSON pointer map.

The system SHALL retain `getOrCreateSystemShelf(userId, kindKey)` as an idempotent safety net for users provisioned outside the standard registration path (e.g., fixtures bypassing `userService.create`, partial seed runs). When its creation branch fires, the helper SHALL set both `slug` and `slugScope` on the inserted `Unit` row. The four system `kindKey`s SHALL remain reserved — user-created shelves SHALL NOT be permitted to use them.

The previous `User.extra.shelves` JSON map SHALL be removed from the `User` model surface. Existing dev / staging databases SHALL be reseeded; no per-row data backfill is shipped (the project is in active development per `CLAUDE.md`).

#### Scenario: Registration populates all four system shelves with slugs

- **WHEN** a new user completes registration
- **THEN** the system SHALL create four `Unit { type = SHELF, slug = kindKey, slugScope = user.unitId }` rows (one per system `kindKey`) in the same transaction as the `User` row
- **AND** the corresponding four `Shelf { unitId, kindKey }` rows SHALL be linked

#### Scenario: Safety net heals a missing system shelf

- **WHEN** a request needs a system shelf for a user whose corresponding `(slugScope = user.unitId, slug = kindKey)` Unit row is missing
- **THEN** the system SHALL create the shelf with `slug` and `slugScope` set, and proceed with the original request using the new `Unit.id`
- **AND** subsequent invocations SHALL resolve via the slug index without creating a second row

#### Scenario: System kindKeys are reserved for system shelves

- **WHEN** a user attempts to create a shelf with `kindKey` equal to `favorites`, `backlog`, `active`, or `completed`
- **THEN** the system SHALL reject the request with a validation error
- **AND** no shelf SHALL be created
