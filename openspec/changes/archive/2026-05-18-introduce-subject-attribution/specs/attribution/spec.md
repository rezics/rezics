## ADDED Requirements

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
