## Requirements

### Requirement: roleKey is a flexible string with no enum constraint

The `role` field on Attribution SHALL be stored as a string in the database, NOT as a database enum. Public API writes SHALL accept only role keys defined by the contract credit attribution role registry. This allows role vocabulary expansion through code and i18n updates without a database migration, while preventing ordinary app users from creating arbitrary role slugs.

The field is named `role` for clarity.

#### Scenario: Use a registered role

- **WHEN** creating a CreditAttribution with `role = "translator"` and `translator` is registered
- **THEN** the record SHALL be persisted with `role = "translator"`

#### Scenario: Reject an unregistered role

- **WHEN** a public caller attempts to create a CreditAttribution with `role = "color_assistant"` and that key is not registered
- **THEN** Elysia schema validation SHALL reject the request
- **AND** no attribution row SHALL be created

#### Scenario: Role storage is not a database enum

- **GIVEN** the Prisma schema for CreditAttribution
- **WHEN** inspecting the `role` field
- **THEN** it SHALL be of type `String`
- **AND** it SHALL NOT reference a Prisma enum

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

The existing Attribution capability SHALL represent creator, contributor, production, publisher, studio, cast, and similar credit relationships. It SHALL NOT be used for character appearance, faction membership, setting references, canonical wiki pages, or other subject indexing relationships. Valid public credit roles SHALL come from the contract credit attribution role registry.

#### Scenario: Author remains a credit attribution

- **WHEN** a book is linked to an Entity with `role = "author"`
- **THEN** the relationship SHALL be represented by the credit attribution capability
- **AND** the linked Entity name SHALL contribute to credit-oriented display and search

#### Scenario: Character appearance is not a credit attribution

- **WHEN** a fan fiction is linked to a character Entity with `role = "primary_character"`
- **THEN** the relationship SHALL be represented by SubjectAttribution
- **AND** the character name SHALL NOT be added to credit-only fields

### Requirement: Credit attribution naming is explicit

The implementation SHALL expose current Attribution semantics with credit-specific naming, such as `CreditAttribution`, `CreditAttributionDTO`, and credit attribution service/API names. Credit role keys SHALL be registry-defined product keys whose labels render through i18n.

#### Scenario: Existing attribution data migrates as credits

- **GIVEN** development data contains Attribution rows linking books to authors, translators, illustrators, publishers, or studios
- **WHEN** the credit attribution naming and registry cutover is applied
- **THEN** those rows SHALL be migrated or reset to registered credit role keys
- **AND** their `(unitId, entityId, role)` uniqueness behavior SHALL be preserved

### Requirement: Credit role registry

The contract package SHALL export a credit attribution role registry. Each entry SHALL include a stable key, an i18n label key, applicable Unit types, Entity kind hints for EntityPicker, and prominence metadata indicating whether the role belongs in Metadata or a general Credits section.

#### Scenario: Author role is metadata-prominent for books

- **WHEN** the frontend loads the credit role registry
- **THEN** the `author` entry SHALL exist
- **AND** it SHALL apply to BOOK Units
- **AND** it SHALL indicate Metadata prominence
- **AND** its label SHALL be rendered through its i18n key

### Requirement: Credit role selector uses registry keys

Credit attribution editing UI SHALL present role choices from the credit role registry. The UI SHALL NOT expose an arbitrary text field for ordinary users to create new role keys.

#### Scenario: User selects a registered role

- **WHEN** a user edits book credits
- **THEN** the role selector SHALL show registered roles applicable to BOOK Units
- **AND** selecting `author` SHALL cause the saved CreditAttribution to use `role = "author"`

### Requirement: Book authorship remains CreditAttribution

Book authors SHALL be represented as `CreditAttribution(role = "author")`. The UI MAY display the author role inside a Metadata region because it is commonly used, but the data model SHALL NOT introduce `Book.author`.

#### Scenario: Book metadata author editor writes CreditAttribution

- **WHEN** a user adds an author from the book Metadata editor
- **THEN** the system SHALL create or update a CreditAttribution row with `role = "author"`
- **AND** it SHALL NOT write a `Book.author` field
