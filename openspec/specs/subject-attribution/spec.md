## Requirements

### Requirement: SubjectAttribution links Units to Entity subjects

The system SHALL provide a `SubjectAttribution` model that links a target Unit (`unitId`) to an Entity Unit (`entityId`) with a free-form `role` string. The relation SHALL represent subject indexing such as characters, factions, families, locations, artifacts, events, concepts, canonical wiki pages, and related setting objects. Both `unitId` and `entityId` SHALL reference `Unit.id`, and `entityId` SHALL refer to a Unit with `type = ENTITY`.

#### Scenario: Link a fan fiction to a primary character

- **WHEN** a SubjectAttribution is created with `unitId = "fanfic-1"`, `entityId = "character-1"`, and `role = "primary_character"`
- **THEN** the record SHALL be persisted as a subject relation
- **AND** the system SHALL be able to query all Units where `"character-1"` is a primary character

#### Scenario: Reject a non-Entity subject

- **WHEN** a caller attempts to create a SubjectAttribution with `entityId` referencing a Unit whose type is not `ENTITY`
- **THEN** the system SHALL reject the request with a validation error
- **AND** no SubjectAttribution row SHALL be created

### Requirement: SubjectAttribution role is a flexible string

The `role` field on SubjectAttribution SHALL be a free-form string with a maximum length of 64 characters and SHALL NOT be constrained by a database enum. Contract constants MAY provide recommended role values, but storage SHALL accept non-standard role strings.

#### Scenario: Use a standard subject role

- **WHEN** creating a SubjectAttribution with `role = "featured_character"`
- **THEN** the record SHALL be persisted with that role

#### Scenario: Use a custom subject role

- **WHEN** creating a SubjectAttribution with `role = "sect_founder"`
- **THEN** the record SHALL be persisted without requiring a schema migration

### Requirement: SubjectAttribution uniqueness is per role

The system SHALL prevent duplicate SubjectAttribution rows for the same `(unitId, entityId, role)` while allowing the same Entity subject to hold multiple roles on the same Unit.

#### Scenario: Same subject has multiple roles on one Unit

- **WHEN** SubjectAttribution rows are created for `(unit-1, entity-1, "primary_character")` and `(unit-1, entity-1, "narrator")`
- **THEN** both rows SHALL coexist

#### Scenario: Duplicate subject role is rejected

- **GIVEN** SubjectAttribution `(unit-1, entity-1, "primary_character")` already exists
- **WHEN** a caller attempts to create another row with the same `(unitId, entityId, role)`
- **THEN** the system SHALL reject the request with a uniqueness error

### Requirement: SubjectAttribution supports ordered display and weighted indexing

SubjectAttribution SHALL include `sortOrder` for display ordering within a role and MAY include `weight` for search or ranking hints. Lower `sortOrder` values SHALL appear first when listing subjects for a Unit.

#### Scenario: Order featured characters

- **GIVEN** Unit "fanfic-1" has featured character subject rows with sort orders 2, 0, and 1
- **WHEN** the system lists featured characters for "fanfic-1"
- **THEN** the rows SHALL be returned in sort order 0, 1, and 2

### Requirement: SubjectAttribution service and API expose link, unlink, and list operations

The server SHALL expose service and HTTP operations to link a subject to a Unit, unlink by composite key, list subjects for a Unit, and list Units for a subject. DTOs SHALL include the linked Entity's translations so clients can resolve subject names through the existing multilingual fallback rules.

#### Scenario: List subjects for a Unit

- **GIVEN** Unit "fanfic-1" has SubjectAttribution rows to character and faction Entities
- **WHEN** a client requests the subject list for "fanfic-1"
- **THEN** the response SHALL include each role, sort order, and Entity DTO with translations

#### Scenario: List Units for a subject

- **GIVEN** Entity "character-1" is linked to multiple published Units through SubjectAttribution
- **WHEN** a client requests Units for subject "character-1" filtered by `role = "primary_character"`
- **THEN** the response SHALL include matching target Units only

### Requirement: Wiki pages use SubjectAttribution for subject linkage

Wiki POST Units SHALL link to the Entity subject they describe through SubjectAttribution roles such as `canonical_wiki_page` or `about`. Parallel translations of those wiki POST Units SHALL continue to use `TranslationGroup`.

#### Scenario: Link a translated wiki page to its character

- **GIVEN** a Japanese wiki POST and an English wiki POST share a TranslationGroup
- **WHEN** both Units are linked to Entity "character-1" with `role = "canonical_wiki_page"`
- **THEN** the system SHALL treat the Units as wiki pages for the same Entity subject
- **AND** translation grouping SHALL remain governed by TranslationGroup rather than SubjectAttribution
