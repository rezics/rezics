## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Entity avatar is exposed through public contracts
Entity DTOs and attribution brief entity DTOs SHALL expose the Entity avatar as an optional nullable string.

#### Scenario: EntityDTO includes avatar
- **WHEN** a client fetches an Entity with an avatar
- **THEN** the response SHALL include `avatar`

#### Scenario: Attribution entity includes avatar
- **WHEN** a client lists credit or subject attributions with Entity details
- **THEN** each included Entity DTO SHALL include `avatar` when present
