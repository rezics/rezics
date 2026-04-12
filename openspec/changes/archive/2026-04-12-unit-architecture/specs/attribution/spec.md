## ADDED Requirements

### Requirement: Person creation is independent of User accounts

Person SHALL be a standalone entity with fields `id`, `name`, and `extra` (Json). Person records are NOT linked to platform User accounts. A Person represents any real-world individual who contributed to a creative work, regardless of whether they have a REZICS account.

#### Scenario: Create a person

- WHEN an authorized user creates a Person with `name = "Hayao Miyazaki"` and `extra = { "birthYear": 1941 }`
- THEN a Person record SHALL be persisted with an auto-generated `id`, `name = "Hayao Miyazaki"`, and the provided `extra` JSON

#### Scenario: Person exists without a platform account

- GIVEN a Person record with `name = "Osamu Tezuka"`
- WHEN querying the Person table
- THEN the record SHALL exist independently with no foreign key to the User table

### Requirement: Organization creation is independent of User accounts

Organization SHALL be a standalone entity with fields `id`, `name`, and `extra` (Json). Organization records are NOT linked to platform User accounts. An Organization represents any entity (publisher, studio, developer) that contributed to a creative work.

#### Scenario: Create an organization

- WHEN an authorized user creates an Organization with `name = "Studio Ghibli"` and `extra = { "founded": 1985 }`
- THEN an Organization record SHALL be persisted with an auto-generated `id`, `name = "Studio Ghibli"`, and the provided `extra` JSON

#### Scenario: Organization exists without a platform account

- GIVEN an Organization record with `name = "Kodansha"`
- WHEN querying the Organization table
- THEN the record SHALL exist independently with no foreign key to the User table

### Requirement: PersonCredit links a person to a unit with a role

PersonCredit SHALL be a junction table with a composite primary key of `(unitId, personId, roleKey)`. It SHALL contain a `sortOrder` field for display ordering. This table associates a Person with a Unit in a specific credited role.

#### Scenario: Credit a person as author

- GIVEN Person "person-1" (name "Author Name") and Unit "unit-1"
- WHEN a PersonCredit record is created with `(unitId = "unit-1", personId = "person-1", roleKey = "author", sortOrder = 1)`
- THEN the record SHALL be persisted with the composite primary key `(unit-1, person-1, author)`
- AND the credit SHALL appear when retrieving credits for "unit-1"

#### Scenario: Credit a person as illustrator

- GIVEN Person "person-2" and Unit "unit-1"
- WHEN a PersonCredit record is created with `(unitId = "unit-1", personId = "person-2", roleKey = "illustrator", sortOrder = 2)`
- THEN the record SHALL be persisted with the composite primary key `(unit-1, person-2, illustrator)`

### Requirement: OrgCredit links an organization to a unit with a role

OrgCredit SHALL be a junction table with a composite primary key of `(unitId, organizationId, roleKey)`. It SHALL contain a `sortOrder` field for display ordering. This table associates an Organization with a Unit in a specific credited role.

#### Scenario: Credit an organization as publisher

- GIVEN Organization "org-1" (name "Publisher Co.") and Unit "unit-1"
- WHEN an OrgCredit record is created with `(unitId = "unit-1", organizationId = "org-1", roleKey = "publisher", sortOrder = 1)`
- THEN the record SHALL be persisted with the composite primary key `(unit-1, org-1, publisher)`

#### Scenario: Credit an organization as developer

- GIVEN Organization "org-2" and Unit "unit-game-1"
- WHEN an OrgCredit record is created with `(unitId = "unit-game-1", organizationId = "org-2", roleKey = "developer", sortOrder = 1)`
- THEN the record SHALL be persisted with the composite primary key `(unit-game-1, org-2, developer)`

### Requirement: roleKey is a flexible string with no enum constraint

The `roleKey` field on PersonCredit and OrgCredit SHALL be a free-form string, NOT an enum. Any string value is valid as a role key. This allows the system to accommodate any credit role across all unit types without schema migrations. Common values include but are not limited to: author, translator, illustrator, editor, director, designer, writer, cast, voice_actor, composer, publisher, developer, distributor.

#### Scenario: Use a standard role key

- WHEN creating a PersonCredit with `roleKey = "translator"`
- THEN the record SHALL be persisted with `roleKey = "translator"`

#### Scenario: Use a non-standard role key

- WHEN creating a PersonCredit with `roleKey = "color_assistant"`
- THEN the record SHALL be persisted with `roleKey = "color_assistant"`
- AND no validation error SHALL occur due to the role key value

#### Scenario: Role key is not validated against an enum

- GIVEN the Prisma schema for PersonCredit and OrgCredit
- WHEN inspecting the `roleKey` field
- THEN it SHALL be of type `String`, NOT referencing any enum type

### Requirement: sortOrder controls display ordering of credits

The `sortOrder` field on PersonCredit and OrgCredit SHALL determine the display position of credits within the same role for a given unit. Lower sortOrder values appear first. Multiple credits with the same roleKey on a unit SHALL be ordered by sortOrder ascending.

#### Scenario: Order multiple authors by sortOrder

- GIVEN Unit "unit-1" with PersonCredit records: (person-A, "author", sortOrder 2), (person-B, "author", sortOrder 1), (person-C, "author", sortOrder 3)
- WHEN retrieving author credits for "unit-1"
- THEN the credits SHALL be returned in order: person-B, person-A, person-C

#### Scenario: Order credits across different roles

- GIVEN Unit "unit-1" with PersonCredit records: (person-A, "author", sortOrder 1), (person-B, "illustrator", sortOrder 1), (person-C, "author", sortOrder 2)
- WHEN retrieving all PersonCredit records for "unit-1" grouped by role
- THEN authors SHALL appear as person-A then person-C (by sortOrder)
- AND illustrators SHALL list person-B

### Requirement: Same person can hold multiple roles on the same unit

A Person SHALL be able to have multiple PersonCredit records for the same Unit with different roleKey values. The composite primary key `(unitId, personId, roleKey)` ensures uniqueness per role while permitting multiple roles.

#### Scenario: Person credited as both author and illustrator

- GIVEN Person "person-1" and Unit "unit-1"
- WHEN PersonCredit records are created for `(unit-1, person-1, "author")` and `(unit-1, person-1, "illustrator")`
- THEN both records SHALL coexist in the database
- AND querying credits for "unit-1" SHALL return "person-1" under both "author" and "illustrator" roles

#### Scenario: Duplicate role for same person on same unit is rejected

- GIVEN PersonCredit `(unit-1, person-1, "author")` already exists
- WHEN a caller attempts to create another PersonCredit with `(unit-1, person-1, "author")`
- THEN the system SHALL reject the operation with a uniqueness constraint violation
- AND no duplicate record SHALL be created

### Requirement: Migration from legacy Book author/press/producer fields

The legacy `Book.author` (User[]), `Book.press` (User[]), and `Book.producer` (User[]) relations SHALL be migrated to the new attribution system. `Book.author` entries become PersonCredit records with `roleKey = "author"`. `Book.press` entries become OrgCredit records with `roleKey = "publisher"`. `Book.producer` entries become OrgCredit records with `roleKey = "producer"`. The UserType enum values `AUTHOR`, `PRESS`, and `PRODUCER` SHALL be removed after migration.

#### Scenario: Migrate Book.author to PersonCredit

- GIVEN a legacy Book record with authors [user-A, user-B]
- WHEN the migration runs
- THEN Person records SHALL be created (or matched) for user-A and user-B
- AND PersonCredit records SHALL be created with `roleKey = "author"` and sequential `sortOrder` values preserving the original order

#### Scenario: Migrate Book.press to OrgCredit

- GIVEN a legacy Book record with press [user-press-1]
- WHEN the migration runs
- THEN an Organization record SHALL be created (or matched) for user-press-1
- AND an OrgCredit record SHALL be created with `roleKey = "publisher"` and `sortOrder = 1`

#### Scenario: Migrate Book.producer to OrgCredit

- GIVEN a legacy Book record with producers [user-prod-1, user-prod-2]
- WHEN the migration runs
- THEN Organization records SHALL be created (or matched) for each producer
- AND OrgCredit records SHALL be created with `roleKey = "producer"` and sequential `sortOrder` values

#### Scenario: Legacy UserType enum values are removed

- WHEN the migration is complete
- THEN the `UserType` enum SHALL no longer contain `AUTHOR`, `PRESS`, or `PRODUCER` values
- AND no remaining code or schema SHALL reference these removed enum values
