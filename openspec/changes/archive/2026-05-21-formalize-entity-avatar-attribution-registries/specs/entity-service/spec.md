## MODIFIED Requirements

### Requirement: EntityService implements the CRUD surface specified in entity-unit-type
The server SHALL provide an `EntityService` module with `create`, `get`, `update`, `delete`, and `list` operations. The `create` operation SHALL execute a single Prisma transaction that inserts a `Unit` row (`type = ENTITY`, `slugScope = <entity-scope-unit-id>`) and an `Entity` extension row sharing the same `unitId`, together with any provided `UnitTranslation` rows. The update operation SHALL atomically mutate Entity fields (`kind`, `avatar`, `verified`), Unit fields (slug, status, visibility), and translations.

#### Scenario: Create an entity with translations
- **WHEN** `EntityService.create({ kind: "person", translations: [{ language: "zh", title: "刘慈欣" }, { language: "en", title: "Liu Cixin" }] })` is called by a non-admin user
- **THEN** a Unit row SHALL be inserted with `type = ENTITY`, `slug = null`, `slugScope = <entity-scope-unit-id>`, and the owner determined by creation mode
- **AND** an Entity row SHALL be inserted with `unitId` matching the new Unit, `kind = "person"`, and `verified = false`
- **AND** two UnitTranslation rows SHALL be inserted with the provided translations
- **AND** all writes SHALL succeed or fail as a single transaction

#### Scenario: Update an entity's avatar without touching translations
- **WHEN** `EntityService.update(unitId, { avatar: "https://cdn.example/a.png" })` is called by an authorized actor
- **THEN** the Entity row SHALL be updated with that avatar
- **AND** the parent Unit and translations SHALL remain unchanged

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

### Requirement: EntityService search index sync
The `EntityService.create`, `update`, and `delete` operations SHALL synchronize a Meili `entities` index document after the database transaction commits. The document SHALL include `unitId`, `slug`, `kind`, `verified`, `avatar`, `ownerUnitId`, translated identity text, and reverse attribution facets.

#### Scenario: Create syncs a new index document
- **WHEN** EntityService.create succeeds with translations
- **THEN** a Meili document SHALL be upserted into the `entities` index containing the new unitId, current slug, kind, verified flag, avatar, ownerUnitId, and translation titles

#### Scenario: Update avatar patches the index document
- **WHEN** EntityService.update changes `avatar`
- **THEN** the corresponding `entities` index document SHALL expose the new avatar

#### Scenario: Delete removes the index document
- **WHEN** EntityService.delete succeeds
- **THEN** the corresponding Meili document SHALL be removed from the `entities` index

## ADDED Requirements

### Requirement: Public entity schemas validate registry keys
The create and update schemas for public Entity APIs SHALL validate `kind` against the contract entity kind registry. The schema SHALL allow null/omitted kind where the operation supports no kind.

#### Scenario: Elysia rejects unknown entity kind
- **WHEN** a public caller submits `kind = "made_up_kind"`
- **THEN** Elysia validation SHALL reject the request
- **AND** the handler SHALL NOT persist the value
