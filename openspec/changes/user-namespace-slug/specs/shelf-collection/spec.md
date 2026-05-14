## ADDED Requirements

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
