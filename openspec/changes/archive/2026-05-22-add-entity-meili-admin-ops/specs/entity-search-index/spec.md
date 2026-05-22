## MODIFIED Requirements

### Requirement: Entity index sync is bounded

Entity create/update/delete operations SHALL sync the Entity's own search document. CreditAttribution mutations SHALL patch only the affected Entity's credit facets and the target content document's credit fields. SubjectAttribution mutations SHALL patch only the affected Entity's subject facets and the target content document's subject fields. Root-only Meili admin operations SHALL expose explicit full-sync and delete-all maintenance actions for the `entities` index so operators can repair projection drift without touching unrelated indexes.

#### Scenario: Credit link patches entity facets

- **WHEN** a CreditAttribution row is created for entity E and unit U
- **THEN** the system SHALL patch E's `creditRoles`, `creditUnitTypes`, and `creditCount`
- **AND** it SHALL patch U's content credit fields
- **AND** it SHALL NOT rebuild unrelated Entity documents

#### Scenario: Entity identity change updates entity document

- **WHEN** an Entity avatar changes
- **THEN** the system SHALL update that Entity's `entities` index document
- **AND** it SHALL NOT synchronously fan out to every content document linked to the Entity

#### Scenario: Root repairs entity search drift

- **WHEN** a root user triggers the Meili entities full-sync operation
- **THEN** the system SHALL rebuild the `entities` index projection from current database state
- **AND** it SHALL NOT rebuild content, feedbacks, users, posts, or realms as part of that operation

#### Scenario: Root clears entity search documents

- **WHEN** a root user triggers the Meili entities delete-all operation
- **THEN** the system SHALL delete documents from the `entities` index while preserving index settings
- **AND** it SHALL allow a later full-sync to repopulate entity search documents
