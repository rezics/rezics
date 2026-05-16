## MODIFIED Requirements

### Requirement: Slug is type-gated to TAG, REALM, ZONE, USER, ENTITY, and owner-scoped SHELF

The following slug placements SHALL be permitted:

- `TAG`, `REALM`, `ZONE`, `USER`, `ENTITY` Units MAY carry a top-level slug whose `slugScope` references the matching scope placeholder Unit.
- `SHELF` Units MAY carry a slug whose `slugScope` references an owner Unit's id (a USER unit in v1; a REALM unit in a future change). User-created shelves SHALL NOT carry a slug in v1; only contract-defined system shelves (`favorites`, `backlog`, `active`, `completed`) are eligible, and minting is owned by the follow-on `shelf-system-slugs` change.
- `ENTITY` slug writes SHALL be accepted only when the caller has the global admin role AND the target Entity has `verified = true` at the time of the write. The substrate accepts ENTITY slugs unconditionally; the gate is enforced at the service layer (see `entity-service`).

Attempts to set a slug on any other unit type (BOOK, GAME, MEDIA, POST, CHAPTER, IMAGE, VIDEO, QUOTE, LINK) SHALL be rejected with a validation error.

#### Scenario: Setting slug on a TAG unit

- **WHEN** a user sets slug `"sci-fi"` on a unit with type `TAG`, scoped to the tag scope
- **THEN** the slug SHALL be saved successfully

#### Scenario: Setting slug on a REALM unit

- **WHEN** a user sets slug `"book-club"` on a unit with type `REALM`, scoped to the realm scope
- **THEN** the slug SHALL be saved successfully

#### Scenario: Setting slug on a ZONE unit

- **WHEN** a user sets slug `"featured-this-week"` on a unit with type `ZONE`, scoped to the zone scope
- **THEN** the slug SHALL be saved successfully

#### Scenario: Setting slug on a USER unit

- **WHEN** the system sets slug `"alice"` on a USER unit, scoped to the user scope
- **THEN** the slug SHALL be saved successfully
- **AND** the USER unit SHALL be resolvable via `GET /user/by-slug/alice`

#### Scenario: Setting slug on a verified ENTITY by an admin

- **WHEN** an admin sets slug `"liu-cixin"` on an ENTITY unit with `verified = true`, scoped to the entity scope
- **THEN** the slug SHALL be saved successfully
- **AND** the ENTITY unit SHALL be resolvable via `GET /entity/by-slug/liu-cixin`

#### Scenario: Non-admin attempts to set an ENTITY slug

- **WHEN** a non-admin user attempts to set a slug on an ENTITY unit
- **THEN** the request SHALL be rejected with a typed error indicating ENTITY slug writes are admin-only

#### Scenario: Admin attempts to set slug on an unverified ENTITY

- **WHEN** an admin attempts to set a slug on an ENTITY unit with `verified = false`
- **THEN** the request SHALL be rejected with a typed error indicating the entity must be verified before a slug can be set

#### Scenario: Setting a system shelf slug under a user owner-scope

- **WHEN** the user-bootstrap process sets slug `"favorites"` on a SHELF unit with `slugScope = <ownerUserUnitId>`
- **THEN** the slug SHALL be saved successfully
- **AND** the shelf SHALL be resolvable via `GET /shelf/by-slug/:userSlug/favorites`

#### Scenario: Setting a custom slug on a user-created shelf is rejected in v1

- **WHEN** `shelfService.create` or `.update` receives a non-null `slug` value for a user-created (non-system) shelf
- **THEN** the request SHALL be rejected with a typed error indicating custom shelf slugs are not enabled in v1

#### Scenario: Setting slug on a BOOK unit is rejected

- **WHEN** a user attempts to set a slug on a unit with type `BOOK`
- **THEN** the request SHALL be rejected with a validation error indicating slugs are not supported for this unit type
