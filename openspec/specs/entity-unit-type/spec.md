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

The `Entity` model SHALL be a 1:1 extension on Unit with `unitId` as its primary key (FK to `Unit.id`). It SHALL have an optional `kind` field (`String?, max 32 chars`), an optional `avatar` field (`String?`), and a `verified` field (`Boolean, default false`). Deleting the parent Unit SHALL cascade-delete the Entity row.

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

#### Scenario: Entity avatar is language neutral

- **WHEN** an Entity is created or updated with `avatar = "https://cdn.example/entity.png"`
- **THEN** the avatar SHALL be stored on the Entity extension row
- **AND** it SHALL NOT be stored in `Unit.extra`
- **AND** it SHALL NOT be stored in `UnitTranslation.extra`

#### Scenario: Cascade delete from Unit

- **WHEN** a Unit with `type = ENTITY` is deleted
- **THEN** the corresponding Entity row SHALL also be deleted

### Requirement: Entity kind is a free string defined at the contract level

The `kind` field on Entity SHALL be stored as a string in the database and SHALL accept only keys defined by the contract entity kind registry through public API write schemas. The database SHALL NOT use a Prisma enum for Entity kind. The contract registry SHALL define valid keys and their i18n label keys.

#### Scenario: Use a registered kind value

- **WHEN** an Entity is created through a public API with `kind = "organization"` and `organization` is registered
- **THEN** the record SHALL be persisted with `kind = "organization"`

#### Scenario: Reject an unregistered kind value

- **WHEN** a public API caller attempts to create or update an Entity with `kind = "untracked_custom_kind"`
- **THEN** Elysia schema validation SHALL reject the request
- **AND** no Entity row SHALL be created or updated with that kind

#### Scenario: Kind labels render from i18n

- **WHEN** the frontend displays an Entity kind key
- **THEN** it SHALL resolve the label through the contract registry i18n key
- **AND** it SHALL NOT display the raw key as the normal label

### Requirement: Entity avatar is exposed through public contracts

Entity DTOs and attribution brief entity DTOs SHALL expose the Entity avatar as an optional nullable string.

#### Scenario: EntityDTO includes avatar

- **WHEN** a client fetches an Entity with an avatar
- **THEN** the response SHALL include `avatar`

#### Scenario: Attribution entity includes avatar

- **WHEN** a client lists credit or subject attributions with Entity details
- **THEN** each included Entity DTO SHALL include `avatar` when present

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

### Requirement: Entity represents abstract referents and wiki subjects

Entity units SHALL represent durable abstract referents, including credited parties and wiki subjects. Valid Entity subjects include people, organizations, circles, studios, labels, characters, factions, families, locations, artifacts, events, and concepts. Entity identity SHALL continue to be backed by `Unit(type = ENTITY)` and the Entity extension row; subject categories SHALL NOT become separate UnitType values.

#### Scenario: Create a character Entity

- **WHEN** an Entity is created with `kind = "character"` and translated titles
- **THEN** the system SHALL persist it as `Unit(type = ENTITY)` with an Entity extension row
- **AND** its display name SHALL resolve from UnitTranslation

#### Scenario: Faction does not create a new Unit type

- **WHEN** a faction subject is created
- **THEN** the Unit type SHALL be `ENTITY`
- **AND** the Entity `kind` SHALL be `"faction"`

### Requirement: Entity kind constants include subject kinds

The contract-level Entity kind constants SHALL include subject-oriented values in addition to credited-party values. The database SHALL continue to store Entity kind as a nullable string, and unsupported custom kind strings SHALL remain possible at the database level.

#### Scenario: Contract exposes character and faction kinds

- **WHEN** a client imports Entity kind constants from `@rezics/contract`
- **THEN** the list SHALL include `"character"`, `"faction"`, `"family"`, `"location"`, `"artifact"`, `"event"`, and `"concept"`

### Requirement: Entity multilingual behavior remains unchanged for subjects

Subject Entities SHALL use the same UnitTranslation fields and fallback behavior as all other Entity units. The system SHALL NOT add `displayName`, `name`, `bio`, or subject-specific language columns to the Entity table.

#### Scenario: Character name resolves by UnitTranslation

- **GIVEN** Entity "character-1" has UnitTranslation rows in `"zh-hant"` and `"en"`
- **WHEN** the client renders the character in English
- **THEN** the displayed name SHALL resolve from the English UnitTranslation when available
- **AND** it SHALL use the standard UnitTranslation fallback chain when unavailable
