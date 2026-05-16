### Requirement: Unit slug field

The `Unit` model SHALL have an optional `slug` field of type `String?` and a required `slugScope` field of type `String @db.Uuid` (NOT NULL). Uniqueness SHALL be enforced by a composite index `@@unique([slugScope, slug])`. The slug serves as a human-readable identifier alongside the UUIDv7 primary key, and `slugScope` SHALL identify the namespace under which the slug is unique. A slug is unique within its scope, not globally.

`slugScope` SHALL always point to a valid `Unit.id`, either:

- a `SlugScope`-table-backed placeholder `Unit { type: SCOPE }` for top-level scopes (`user`, `realm`, `tag`, `zone`, `entity`), or
- an owner `Unit.id` for owner-scoped sub-resources (e.g., a shelf under a user).

No FK constraint SHALL be declared on `slugScope`, consistent with existing precedent for polymorphic-shaped reference columns (`ShelfUnit.unitId`, `ShelfItem.itemRef`).

#### Scenario: Unit with slug is addressable by slug within its scope

- **WHEN** a unit has slug `"science-fiction"` and `slugScope = <tag-scope-unit-id>`
- **THEN** querying by `(slugScope = <tag-scope-unit-id>, slug = "science-fiction")` SHALL return that unit
- **AND** no other unit with the same `(slugScope, slug)` pair SHALL exist

#### Scenario: Same slug may exist in different scopes

- **WHEN** `Unit A` has `(slugScope = <user-scope-unit-id>, slug = "alice")` and `Unit B` has `(slugScope = <realm-scope-unit-id>, slug = "alice")`
- **THEN** both rows SHALL coexist without violating the composite unique index
- **AND** each SHALL be independently resolvable by its `(slugScope, slug)` pair

#### Scenario: Unit without slug remains addressable by ID

- **WHEN** a unit has no slug set (slug is null) but `slugScope` is populated
- **THEN** the unit SHALL still be addressable by its UUIDv7 `id`
- **AND** the null slug SHALL NOT conflict with other null slugs sharing the same `slugScope`

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

### Requirement: Slug is write-once for non-admin users

Once a slug has been set on a unit, non-admin users SHALL NOT be able to modify or remove it. Only users with the global administrator role SHALL be permitted to update or clear a unit's slug, except for USER-typed Units, where slugs are immutable in v1 and SHALL NOT be modifiable through any surface (including admin tools). The USER slug immutability constraint is documented in `account-identity-boundary` and is a v1 product decision, not a substrate limit.

#### Scenario: Owner sets slug for the first time

- **WHEN** the owner of a TAG unit with `slug = null` submits slug `"fantasy"`
- **THEN** the slug SHALL be set to `"fantasy"`

#### Scenario: Owner attempts to change existing slug

- **WHEN** the owner of a TAG unit with `slug = "fantasy"` submits slug `"fantasy-genre"`
- **THEN** the request SHALL be rejected with a forbidden error indicating the slug cannot be changed
- **AND** the slug SHALL remain `"fantasy"`

#### Scenario: Global admin modifies an existing TAG slug

- **WHEN** a global administrator updates a TAG unit's slug from `"fantasy"` to `"fantasy-genre"`
- **THEN** the slug SHALL be updated to `"fantasy-genre"`
- **AND** all validation rules (format, uniqueness within the tag scope, reserved words) SHALL still apply

#### Scenario: Admin attempts to change a USER unit slug in v1

- **WHEN** a global administrator attempts to update the slug on a USER-typed Unit
- **THEN** the request SHALL be rejected with a typed error indicating user slugs are immutable in v1

### Requirement: Slug can be set at creation or later

The slug MAY be provided when creating a slug-eligible Unit (TAG, REALM, ZONE, USER, or system SHELF under owner scope), or it MAY be set in a subsequent update for non-USER types. Both paths SHALL apply the same validation rules (format, scope-aware uniqueness lookup, and the single unified reserved-word list per `slug-validation`).

#### Scenario: Slug provided at creation

- **WHEN** a user creates a new TAG unit with slug `"mystery"`
- **THEN** the unit SHALL be created with slug `"mystery"` and `slugScope = <tag-scope-unit-id>`

#### Scenario: Slug added after creation

- **WHEN** a user updates a TAG unit that has `slug = null` to set slug `"mystery"`
- **THEN** the slug SHALL be set to `"mystery"` with the existing `slugScope` preserved

#### Scenario: USER slug set at profile-setup time is immutable

- **WHEN** a user completes profile setup and a USER slug is persisted
- **THEN** no subsequent update path SHALL accept a slug change on that USER unit

### Requirement: Lookup unit by slug API

The server SHALL expose typed by-slug API endpoints per scope, and a generic resolver. Each typed endpoint resolves a slug within an implied scope. The generic resolver accepts an explicit scope argument. See `typed-slug-lookup` for endpoint shapes.

#### Scenario: Lookup existing typed slug

- **WHEN** a client requests `GET /tag/by-slug/science-fiction`
- **AND** a TAG unit with that slug exists under the tag scope
- **THEN** the response SHALL include the unit data with its translations

#### Scenario: Lookup non-existent slug

- **WHEN** a client requests `GET /tag/by-slug/does-not-exist`
- **THEN** the response SHALL be a 404 not found error
