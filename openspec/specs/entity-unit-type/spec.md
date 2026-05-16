## ADDED Requirements

### Requirement: ENTITY is a valid UnitType

The `UnitType` enum SHALL include an `ENTITY` value. Units with `type = ENTITY` represent catalog identifiers for persons, organizations, circles, studios, or other credited parties. Entity units are content nodes — they have no control authority and do not represent platform accounts.

#### Scenario: Create a unit with type ENTITY

- **WHEN** a Unit is created with `type = ENTITY`
- **THEN** the Unit record SHALL be persisted with `type = "ENTITY"`
- **AND** it SHALL support slug, translations, status, and visibility like any other Unit type

#### Scenario: ENTITY units appear in type-filtered queries

- **WHEN** querying Units filtered by `type = ENTITY`
- **THEN** only Entity units SHALL be returned
- **AND** Book, Game, and other unit types SHALL be excluded

### Requirement: Entity extension table stores kind and verification status

The `Entity` model SHALL be a 1:1 extension on Unit with `unitId` as its primary key (FK to `Unit.id`). It SHALL have an optional `kind` field (`String?, max 32 chars`) and a `verified` field (`Boolean, default false`). Deleting the parent Unit SHALL cascade-delete the Entity row.

#### Scenario: Create an Entity with kind

- **WHEN** an Entity is created with `kind = "person"`
- **THEN** the Entity record SHALL be persisted with `unitId` matching its parent Unit and `kind = "person"`

#### Scenario: Create an Entity without kind

- **WHEN** an Entity is created with `kind` omitted
- **THEN** the Entity record SHALL be persisted with `kind = null`
- **AND** no validation error SHALL occur

#### Scenario: Entity verified defaults to false

- **WHEN** an Entity is created without specifying `verified`
- **THEN** `verified` SHALL default to `false`

#### Scenario: Cascade delete from Unit

- **WHEN** a Unit with `type = ENTITY` is deleted
- **THEN** the corresponding Entity row SHALL also be deleted

### Requirement: Entity kind is a free string defined at the contract level

The `kind` field on Entity SHALL accept any string value up to 32 characters. Valid kind values SHALL be defined in `@rezics/contract`, not constrained by a database enum. Common values include `"person"`, `"organization"`, `"circle"`, `"studio"`, `"label"`.

#### Scenario: Use a standard kind value

- **WHEN** an Entity is created with `kind = "organization"`
- **THEN** the record SHALL be persisted with `kind = "organization"`

#### Scenario: Use a non-standard kind value

- **WHEN** an Entity is created with `kind = "circle"`
- **THEN** the record SHALL be persisted with `kind = "circle"`
- **AND** no validation error SHALL occur at the database level

### Requirement: Entity name and bio come from UnitTranslation

An Entity's display name SHALL be stored in `UnitTranslation.title` and its biography/description in `UnitTranslation.summary` and `UnitTranslation.description`. There SHALL be no `name` or `bio` field on the Entity model itself.

#### Scenario: Entity with translated name

- **WHEN** an Entity unit has translations `[{ language: "zh", title: "刘慈欣" }, { language: "en", title: "Liu Cixin" }, { language: "ja", title: "劉慈欣" }]`
- **THEN** resolving the Entity name in Chinese SHALL return "刘慈欣"
- **AND** resolving in English SHALL return "Liu Cixin"

#### Scenario: Entity with translated biography

- **WHEN** an Entity unit has a translation with `language: "en"`, `summary: "Chinese science fiction author"`, `description: "Liu Cixin is a Chinese science fiction author best known for..."`
- **THEN** the summary and description SHALL be available via the standard UnitTranslation resolution mechanism

### Requirement: Entity CRUD service

The server SHALL provide an Entity service with CRUD operations. Creating an Entity SHALL create a Unit (type=ENTITY) and Entity extension row in a single transaction. The service SHALL accept translations and an optional slug on creation.

#### Scenario: Create an Entity with translations

- **WHEN** `createEntity({ kind: "person", slug: "liu-cixin", translations: [{ language: "zh", title: "刘慈欣", summary: "中国科幻作家" }, { language: "en", title: "Liu Cixin", summary: "Chinese SF author" }] })` is called
- **THEN** a Unit SHALL be created with `type = ENTITY`, `slug = "liu-cixin"`
- **AND** an Entity row SHALL be created with `kind = "person"`, `verified = false`
- **AND** two UnitTranslation rows SHALL be created with the provided translations

#### Scenario: Update an Entity's kind

- **WHEN** `updateEntity(id, { kind: "circle" })` is called on an existing Entity
- **THEN** the Entity row SHALL be updated with `kind = "circle"`
- **AND** the parent Unit and translations SHALL remain unchanged

#### Scenario: Delete an Entity

- **WHEN** `deleteEntity(id)` is called
- **THEN** the parent Unit SHALL be deleted
- **AND** the Entity row, all UnitTranslation rows, and all Attribution rows referencing this entity SHALL be cascade-deleted

#### Scenario: List Entities with filtering

- **WHEN** `listEntities({ kind: "person", q: "liu" })` is called
- **THEN** only Entity units with `kind = "person"` whose translations contain "liu" SHALL be returned

### Requirement: Entity contract DTOs

The `@rezics/contract` package SHALL export Entity-related TypeBox schemas: `EntityDTO` (including unitId, kind, verified, slug, translations), `CreateEntityInput` (kind?, slug?, translations), `UpdateEntityInput` (kind?, slug?, translations?), and `EntityListQuery` (kind?, q?, page?, limit?).

#### Scenario: EntityDTO includes translations

- **WHEN** an EntityDTO is serialized
- **THEN** it SHALL include `unitId`, `kind`, `verified`, `slug`, and a `translations` array with `{ language, title, subtitle, summary, description }` entries

#### Scenario: CreateEntityInput accepts optional kind

- **WHEN** a CreateEntityInput is validated with `{ translations: [{ language: "en", title: "Test" }] }` and no `kind`
- **THEN** validation SHALL pass

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
