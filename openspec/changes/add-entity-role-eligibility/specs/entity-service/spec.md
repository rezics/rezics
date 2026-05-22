## MODIFIED Requirements

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
