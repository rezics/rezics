## MODIFIED Requirements

### Requirement: Entity extension table stores kind and verification status

The `Entity` model SHALL be a 1:1 extension on Unit with `unitId` as its primary key (FK to `Unit.id`). It SHALL have an optional `kind` field (`String?, max 32 chars`), an optional `avatar` field (`String?`), a `verified` field (`Boolean, default false`), `eligibleCreditRoles` as a persisted array of registered credit attribution role keys, and `eligibleSubjectRoles` as a persisted array of registered subject attribution role keys. Deleting the parent Unit SHALL cascade-delete the Entity row.

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

#### Scenario: Entity stores explicit credit eligibility

- **WHEN** an Entity is created or updated with `eligibleCreditRoles = ["author", "translator"]`
- **THEN** the Entity record SHALL persist those role keys as its allowed credit roles
- **AND** the system SHALL NOT infer additional credit roles from `kind` when reading the Entity

#### Scenario: Entity stores explicit subject eligibility

- **WHEN** an Entity is created or updated with `eligibleSubjectRoles = ["primary_character", "appears"]`
- **THEN** the Entity record SHALL persist those role keys as its allowed subject roles
- **AND** the system SHALL NOT infer additional subject roles from `kind` when reading the Entity

#### Scenario: Cascade delete from Unit

- **WHEN** a Unit with `type = ENTITY` is deleted
- **THEN** the corresponding Entity row SHALL also be deleted

## ADDED Requirements

### Requirement: Entity kind only suggests creation-time eligibility

Entity kind SHALL be usable by frontend creation surfaces to prefill `eligibleCreditRoles` and `eligibleSubjectRoles`, but kind SHALL NOT be treated as an implicit backend default for eligibility after the Entity is persisted. Users or authorized editors SHALL be able to manage persisted eligibility arrays independently from kind.

#### Scenario: Kind suggestion is persisted explicitly

- **WHEN** a frontend creates an Entity with `kind = "character"` and prefilled `eligibleSubjectRoles = ["primary_character", "featured_character", "appears"]`
- **THEN** the server SHALL persist the submitted eligibility arrays
- **AND** future reads SHALL return the persisted arrays rather than recomputing them from `kind`

#### Scenario: Kind edit does not rewrite eligibility

- **WHEN** an existing Entity's `kind` is changed from `"person"` to `"organization"`
- **THEN** the system SHALL NOT automatically add or remove values in `eligibleCreditRoles` or `eligibleSubjectRoles`
