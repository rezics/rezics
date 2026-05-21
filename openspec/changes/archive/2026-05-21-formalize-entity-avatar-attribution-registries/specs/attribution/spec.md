## MODIFIED Requirements

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

## ADDED Requirements

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
