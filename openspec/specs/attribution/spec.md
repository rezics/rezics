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

### Requirement: Attribution references resolve correctly under unified User identity

Attribution-bearing references (e.g., owner fields on Unit, claimer fields on WorkLinkClaim, follower / following ids, ApiToken owner ids) SHALL continue to refer to a user via the user's identifier — now `User.unitId` (renamed from `userId` by the `user-namespace-slug` change). FK columns on related tables MAY retain their existing names (often `userId`); their FK target SHALL be `User.unitId`, and resolution SHALL succeed because `User.unitId ≡ Unit.id where type = USER`.

This requirement is a verification clause: it does not alter the Attribution schema (`unitId`, `entityId`, `role`, `sortOrder`) or its uniqueness rules. It confirms that the User PK rename does not break any attribution-adjacent resolution path.

#### Scenario: Unit owner reference resolves to the user

- **GIVEN** a `Unit` row with `userId = <uuid>` (creator/owner reference)
- **WHEN** the system fetches the owning user
- **THEN** it SHALL find a `User` row where `unitId = <uuid>`
- **AND** the resolution SHALL succeed without any code change beyond the FK target rename

#### Scenario: Claimer reference resolves under renamed PK

- **GIVEN** a `WorkLinkClaim` row with `claimerUserId = <uuid>`
- **WHEN** the system resolves the claimer
- **THEN** it SHALL find a `User` row where `unitId = <uuid>`

#### Scenario: Attribution-entity references remain unaffected

- **WHEN** an `Attribution` row links a Unit to an Entity (`(unitId, entityId, role)`)
- **THEN** the entity reference SHALL continue to target the `Entity` (or its successor `ENTITY`-typed Unit), independently of the User PK rename
- **AND** no existing Attribution row SHALL require data migration as a result of this change

### Requirement: Attribution is reserved for creator and production credits

The existing Attribution capability SHALL represent creator, contributor, production, publisher, studio, cast, and similar credit relationships. It SHALL NOT be used for character appearance, faction membership, setting references, canonical wiki pages, or other subject indexing relationships.

#### Scenario: Author remains a credit attribution

- **WHEN** a book is linked to an Entity with `role = "author"`
- **THEN** the relationship SHALL be represented by the credit attribution capability
- **AND** the linked Entity name SHALL contribute to credit-oriented display and search

#### Scenario: Character appearance is not a credit attribution

- **WHEN** a fan fiction is linked to a character Entity with `role = "primary_character"`
- **THEN** the relationship SHALL be represented by SubjectAttribution
- **AND** the character name SHALL NOT be added to credit-only fields

### Requirement: Credit attribution naming is explicit

The implementation SHALL expose current Attribution semantics with credit-specific naming, such as `CreditAttribution`, `CreditAttributionDTO`, and credit attribution service/API names. Existing Attribution rows SHALL be preserved as credit attribution data during the cutover.

#### Scenario: Existing attribution data migrates as credits

- **GIVEN** existing Attribution rows link books to authors, translators, illustrators, publishers, or studios
- **WHEN** the credit attribution naming cutover is applied
- **THEN** those rows SHALL remain available as credit attribution rows
- **AND** their `(unitId, entityId, role)` uniqueness behavior SHALL be preserved
