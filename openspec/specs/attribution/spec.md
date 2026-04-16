## Requirements

### Requirement: roleKey is a flexible string with no enum constraint

The `role` field on Attribution SHALL be a free-form string (max 64 characters), NOT an enum. Any string value is valid as a role. This allows the system to accommodate any credit role across all unit types without schema migrations. Common values include but are not limited to: author, translator, illustrator, editor, director, designer, writer, cast, voice_actor, composer, publisher, developer, distributor.

The field is renamed from `roleKey` to `role` for clarity.

#### Scenario: Use a standard role

- **WHEN** creating an Attribution with `role = "translator"`
- **THEN** the record SHALL be persisted with `role = "translator"`

#### Scenario: Use a non-standard role

- **WHEN** creating an Attribution with `role = "color_assistant"`
- **THEN** the record SHALL be persisted with `role = "color_assistant"`
- **AND** no validation error SHALL occur due to the role value

#### Scenario: Role is not validated against an enum

- **GIVEN** the Prisma schema for Attribution
- **WHEN** inspecting the `role` field
- **THEN** it SHALL be of type `String`, NOT referencing any enum type

### Requirement: sortOrder controls display ordering of credits

The `sortOrder` field on Attribution SHALL determine the display position of credits within the same role for a given unit. Lower sortOrder values appear first. Multiple credits with the same role on a unit SHALL be ordered by sortOrder ascending.

#### Scenario: Order multiple authors by sortOrder

- **GIVEN** Unit "unit-1" with Attribution records: (entity-A, "author", sortOrder 2), (entity-B, "author", sortOrder 1), (entity-C, "author", sortOrder 3)
- **WHEN** retrieving author credits for "unit-1"
- **THEN** the credits SHALL be returned in order: entity-B, entity-A, entity-C

#### Scenario: Order credits across different roles

- **GIVEN** Unit "unit-1" with Attribution records: (entity-A, "author", sortOrder 1), (entity-B, "illustrator", sortOrder 1), (entity-C, "author", sortOrder 2)
- **WHEN** retrieving all Attribution records for "unit-1" grouped by role
- **THEN** authors SHALL appear as entity-A then entity-C (by sortOrder)
- **AND** illustrators SHALL list entity-B

### Requirement: Same person can hold multiple roles on the same unit

An Entity SHALL be able to have multiple Attribution records for the same Unit with different role values. The composite primary key `(unitId, entityId, role)` ensures uniqueness per role while permitting multiple roles.

#### Scenario: Entity credited as both author and illustrator

- **GIVEN** Entity "entity-1" and Unit "unit-1"
- **WHEN** Attribution records are created for `(unit-1, entity-1, "author")` and `(unit-1, entity-1, "illustrator")`
- **THEN** both records SHALL coexist in the database
- **AND** querying credits for "unit-1" SHALL return "entity-1" under both "author" and "illustrator" roles

#### Scenario: Duplicate role for same entity on same unit is rejected

- **GIVEN** Attribution `(unit-1, entity-1, "author")` already exists
- **WHEN** a caller attempts to create another Attribution with `(unit-1, entity-1, "author")`
- **THEN** the system SHALL reject the operation with a uniqueness constraint violation
- **AND** no duplicate record SHALL be created
