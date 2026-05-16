## ADDED Requirements

### Requirement: ENTITY units in v1 are creator-owned

All ENTITY units created in v1, regardless of creation surface (EntityPicker inline create, `/me/entities/new` self-claim, `/admin/entities/:unitId` admin creation), SHALL have `Unit.userId` set to the caller's unitId. There SHALL be no "wiki-mode" custodian semantics in v1: the system custodian user does not exist yet, and no ENTITY row is owned by a synthetic user.

The wiki-vs-personal mode discipline and the custodian substrate are deferred until the `content-creation-mode` change ships paired with `content-history-and-lock`. When that ships, the convention SHALL be forward-only — no backfill of v1 ENTITY rows.

#### Scenario: Inline create stores caller as owner

- **WHEN** a user creates an entity through EntityPicker during book creation
- **THEN** the resulting Unit row SHALL have `userId = caller.unitId`

#### Scenario: Self-claim stores caller as owner

- **WHEN** a user creates an entity through `/me/entities/new`
- **THEN** the resulting Unit row SHALL have `userId = caller.unitId`

#### Scenario: Admin creation stores admin as owner

- **WHEN** an admin creates an entity through the admin surface
- **THEN** the resulting Unit row SHALL have `userId = admin.unitId`

### Requirement: Slug and verified mutations are reserved for the admin surface

Only the admin edit surface (`/admin/entities/:unitId`) SHALL expose controls for the `Entity.verified` flag and the `Unit.slug` field on an ENTITY unit. The end-user surfaces (EntityPicker inline create, `/me/entities/new`) SHALL NOT expose these fields, and any payload submitted from those surfaces that includes them SHALL be ignored or rejected at the service layer.

#### Scenario: EntityPicker payload omits slug and verified

- **WHEN** EntityPicker submits an inline-create payload
- **THEN** the payload SHALL omit `slug` and `verified` keys

#### Scenario: /me/entities/new payload omits slug and verified

- **WHEN** `/me/entities/new` submits a creation payload
- **THEN** the payload SHALL omit `slug` and `verified` keys

#### Scenario: Service layer rejects slug from non-admin caller

- **WHEN** a non-admin caller submits an update payload including `slug`
- **THEN** `EntityService.update` SHALL reject the request with a typed error indicating ENTITY slug writes are admin-only
