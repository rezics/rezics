# entity-service Specification

## Purpose

Defines `EntityService`, the server-side CRUD surface and Elysia routes for ENTITY units. The service atomically writes the parent `Unit`, the `Entity` extension row, and any `UnitTranslation` rows in a single Prisma transaction; enforces creator-ownership in v1 (no custodian); gates `slug` and `verified` writes to admins with `verified = true` as a precondition for slug writes; and synchronizes a Meili `entities` index document after each commit. HTTP routes mount under `/entity`, with explicit schemas validated against `@rezics/contract`.

## Requirements

### Requirement: EntityService implements the CRUD surface specified in entity-unit-type

The server SHALL provide an `EntityService` module with `create`, `get`, `update`, `delete`, and `list` operations. The `create` operation SHALL execute a single Prisma transaction that inserts a `Unit` row (`type = ENTITY`, `slugScope = <entity-scope-unit-id>`) and an `Entity` extension row sharing the same `unitId`, together with any provided `UnitTranslation` rows. The update operation SHALL atomically mutate Entity fields (`kind`, `avatar`, `verified`, `eligibleCreditRoles`, `eligibleSubjectRoles`), Unit fields (slug, status, visibility), and translations.

#### Scenario: Create an entity with translations and eligibility

- **WHEN** `EntityService.create({ kind: "person", eligibleCreditRoles: ["author"], eligibleSubjectRoles: ["about"], translations: [{ language: "zh", title: "刘慈欣" }, { language: "en", title: "Liu Cixin" }] })` is called by a non-admin user
- **THEN** a Unit row SHALL be inserted with `type = ENTITY`, `slug = null`, `slugScope = <entity-scope-unit-id>`, and the owner determined by creation mode
- **AND** an Entity row SHALL be inserted with `unitId` matching the new Unit, `kind = "person"`, `verified = false`, `eligibleCreditRoles = ["author"]`, and `eligibleSubjectRoles = ["about"]`
- **AND** two UnitTranslation rows SHALL be inserted with the provided translations
- **AND** all writes SHALL succeed or fail as a single transaction

#### Scenario: Update an entity's avatar without touching translations or eligibility

- **WHEN** `EntityService.update(unitId, { avatar: "https://cdn.example/a.png" })` is called by an authorized actor
- **THEN** the Entity row SHALL be updated with that avatar
- **AND** the parent Unit, translations, `eligibleCreditRoles`, and `eligibleSubjectRoles` SHALL remain unchanged

#### Scenario: Update entity eligibility

- **WHEN** `EntityService.update(unitId, { eligibleCreditRoles: ["translator"], eligibleSubjectRoles: ["about", "appears"] })` is called by an authorized actor
- **THEN** the Entity row SHALL replace its persisted eligibility arrays with the submitted arrays
- **AND** the service SHALL reject role keys that are not present in the corresponding contract role registry

#### Scenario: Update rejects unregistered kind

- **WHEN** `EntityService.update(unitId, { kind: "custom_raw_kind" })` is called through a public API
- **THEN** the request SHALL be rejected by the request schema before the service writes data

#### Scenario: Delete an entity cascades to extension, translations, and attribution

- **WHEN** `EntityService.delete(unitId)` is called
- **THEN** the parent Unit SHALL be deleted
- **AND** the Entity extension row SHALL be cascade-deleted
- **AND** all UnitTranslation rows referencing that unitId SHALL be cascade-deleted
- **AND** all Attribution rows referencing that entityId SHALL be cascade-deleted

#### Scenario: List entities with kind filter and text query

- **WHEN** `EntityService.list({ kind: "person", q: "liu" })` is called
- **THEN** only Entity units with `kind = "person"` whose translations contain "liu" SHALL be returned
- **AND** results SHALL be paginated using the standard pagination contract

### Requirement: EntityService creator-ownership in v1

All v1 EntityService.create operations SHALL set `Unit.userId = caller.unitId`, regardless of the spawn path (EntityPicker inline create or `/me/entities/new` self-claim). The wiki-vs-personal mode discipline and the system custodian user are deferred until `content-creation-mode` ships paired with `content-history-and-lock`; until then, ENTITY ownership semantics match BOOK / GAME / MEDIA: whoever creates the row owns it.

#### Scenario: EntityPicker inline create stores caller as owner

- **WHEN** an end user creates an entity inline through EntityPicker during book creation
- **THEN** the resulting Unit row SHALL have `userId = caller.unitId`
- **AND** no lookup of a system or custodian user SHALL occur

#### Scenario: /me/entities/new stores caller as owner

- **WHEN** an end user creates a personal-mode entity through `/me/entities/new`
- **THEN** the resulting Unit row SHALL have `userId = caller.unitId`

### Requirement: EntityService slug write gated to admin and verified

The `EntityService.create` and `EntityService.update` operations SHALL reject any non-null `slug` field unless the caller has the global admin role AND the target Entity has `verified = true` at the time of the write. The rejection SHALL produce a typed error distinguishing the admin-role failure from the verified-precondition failure.

#### Scenario: Non-admin attempts to set slug at creation

- **WHEN** a non-admin user calls `EntityService.create({ slug: "liu-cixin", translations: [...], kind: "person" })`
- **THEN** the request SHALL be rejected with a typed error indicating ENTITY slug writes are admin-only
- **AND** no Unit or Entity row SHALL be created

#### Scenario: Admin attempts to set slug on an unverified entity

- **WHEN** an admin calls `EntityService.update(unitId, { slug: "liu-cixin" })` against an Entity with `verified = false`
- **THEN** the request SHALL be rejected with a typed error indicating the entity must be verified before a slug can be set
- **AND** the slug field SHALL remain unchanged

#### Scenario: Admin sets slug on a verified entity

- **WHEN** an admin calls `EntityService.update(unitId, { slug: "liu-cixin" })` against an Entity with `verified = true`
- **AND** the slug passes `validateSlug` and is unique within the entity scope
- **THEN** the parent Unit row SHALL be updated with `slug = "liu-cixin"`
- **AND** the slug SHALL be resolvable via `GET /entity/by-slug/liu-cixin`

### Requirement: EntityService verified toggle is admin-only

The `verified` field on an Entity SHALL be mutable only by callers with the global admin role. Non-admin update calls that include a `verified` field SHALL be rejected with a typed forbidden error; calls omitting the field SHALL succeed (subject to other validation).

#### Scenario: Non-admin attempts to set verified

- **WHEN** a non-admin user calls `EntityService.update(unitId, { verified: true })`
- **THEN** the request SHALL be rejected with a typed error indicating verified is admin-only

#### Scenario: Admin revokes verified without clearing slug

- **WHEN** an admin calls `EntityService.update(unitId, { verified: false })` against an Entity that has a slug set
- **THEN** the `verified` field SHALL be updated to `false`
- **AND** the existing slug SHALL persist unchanged
- **AND** further admin slug edits SHALL be rejected until `verified` is restored

### Requirement: EntityService search index sync

The `EntityService.create`, `update`, and `delete` operations SHALL synchronize a Meili `entities` index document after the database transaction commits. The document SHALL include `unitId`, `slug`, `kind`, `verified`, `avatar`, `ownerUnitId`, translated identity text, and role eligibility arrays.

#### Scenario: Create syncs a new index document

- **WHEN** EntityService.create succeeds with translations and eligibility
- **THEN** a Meili document SHALL be upserted into the `entities` index containing the new unitId, current slug, kind, verified flag, avatar, ownerUnitId, translation titles, `eligibleCreditRoles`, and `eligibleSubjectRoles`

#### Scenario: Update avatar patches the index document

- **WHEN** EntityService.update changes `avatar`
- **THEN** the corresponding `entities` index document SHALL expose the new avatar

#### Scenario: Update eligibility patches the index document

- **WHEN** EntityService.update changes `eligibleCreditRoles` or `eligibleSubjectRoles`
- **THEN** the corresponding `entities` index document SHALL expose the new eligibility arrays

#### Scenario: Delete removes the index document

- **WHEN** EntityService.delete succeeds
- **THEN** the corresponding Meili document SHALL be removed from the `entities` index

### Requirement: Public entity schemas validate registry keys

The create and update schemas for public Entity APIs SHALL validate `kind` against the contract entity kind registry. The schema SHALL allow null/omitted kind where the operation supports no kind.

#### Scenario: Elysia rejects unknown entity kind

- **WHEN** a public caller submits `kind = "made_up_kind"`
- **THEN** Elysia validation SHALL reject the request
- **AND** the handler SHALL NOT persist the value

### Requirement: EntityService HTTP route surface

The server SHALL expose the following Elysia routes mounted at `/entity`:

- `POST /entity` — create
- `GET /entity/:unitId` — get by id
- `GET /entity/by-slug/:slug` — get by slug (entity scope implicit)
- `PATCH /entity/:unitId` — update
- `DELETE /entity/:unitId` — delete
- `GET /entity` — list with `kind?`, `q?`, `page?`, `limit?` query parameters

Each route SHALL validate request bodies and parameters against the typebox schemas exported from `@rezics/contract`.

#### Scenario: GET /entity/by-slug/:slug resolves an existing slug

- **WHEN** a client requests `GET /entity/by-slug/liu-cixin`
- **AND** an Entity with that slug exists
- **THEN** the response SHALL include the EntityDTO with translations, kind, verified, and slug

#### Scenario: GET /entity/by-slug/:slug returns 404 for missing slug

- **WHEN** a client requests `GET /entity/by-slug/does-not-exist`
- **THEN** the response SHALL be a 404 not found error
