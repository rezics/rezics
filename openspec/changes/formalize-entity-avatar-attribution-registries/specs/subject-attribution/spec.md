## MODIFIED Requirements

### Requirement: SubjectAttribution role is a flexible string
The `role` field on SubjectAttribution SHALL be stored as a string with a maximum length of 64 characters and SHALL NOT be constrained by a database enum. Public API writes SHALL accept only role keys defined by the contract subject attribution role registry. Contract constants and registry entries define the product vocabulary, i18n keys, and Entity kind hints.

#### Scenario: Use a registered subject role
- **WHEN** creating a SubjectAttribution with `role = "featured_character"` and that role is registered
- **THEN** the record SHALL be persisted with that role

#### Scenario: Reject a custom subject role
- **WHEN** a public caller attempts to create a SubjectAttribution with `role = "sect_founder"` and that key is not registered
- **THEN** Elysia schema validation SHALL reject the request
- **AND** no SubjectAttribution row SHALL be created

### Requirement: SubjectAttribution service and API expose link, unlink, and list operations
The server SHALL expose service and HTTP operations to link a subject to a Unit, unlink by composite key, list subjects for a Unit, and list Units for a subject. Public link/unlink inputs SHALL validate role keys against the contract subject attribution role registry. DTOs SHALL include the linked Entity's translations and avatar so clients can resolve subject display through the existing multilingual fallback rules.

#### Scenario: List subjects for a Unit
- **GIVEN** Unit "fanfic-1" has SubjectAttribution rows to character and faction Entities
- **WHEN** a client requests the subject list for "fanfic-1"
- **THEN** the response SHALL include each role, sort order, and Entity DTO with translations
- **AND** the response SHALL include the Entity avatar when present

#### Scenario: List Units for a subject
- **GIVEN** Entity "character-1" is linked to multiple published Units through SubjectAttribution
- **WHEN** a client requests Units for subject "character-1" filtered by `role = "primary_character"`
- **THEN** the response SHALL include matching target Units only

## ADDED Requirements

### Requirement: Subject role registry
The contract package SHALL export a subject attribution role registry. Each entry SHALL include a stable key, an i18n label key, Entity kind hints, and display grouping metadata.

#### Scenario: Character role provides kind hint
- **WHEN** the frontend prepares a subject attribution picker for `primary_character`
- **THEN** the registry SHALL provide a character-oriented kind hint
- **AND** the role label SHALL be rendered from its i18n key

### Requirement: Subject role selector uses registry keys
Subject attribution editing UI SHALL present role choices from the subject role registry. The UI SHALL NOT expose an arbitrary text field for ordinary users to create new subject role keys.

#### Scenario: User selects a registered subject role
- **WHEN** a user edits subject attributions
- **THEN** the role selector SHALL show registered subject roles
- **AND** saving shall persist the selected registry key in `SubjectAttribution.role`
