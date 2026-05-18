## ADDED Requirements

### Requirement: Content index includes subject fields

The content search document SHALL include subject-specific fields derived from SubjectAttribution rows: `subjectEntityIds`, `subjectNames`, `subjectKinds`, and `subjectRoles`. These fields SHALL be independent from credit fields.

#### Scenario: Indexed fan fiction includes character subject fields

- **GIVEN** published Unit "fanfic-1" has SubjectAttribution to Entity "character-1" with `role = "primary_character"`
- **WHEN** the Unit is synced to the content index
- **THEN** the document SHALL include `"character-1"` in `subjectEntityIds`
- **AND** it SHALL include the character's translated titles in `subjectNames`
- **AND** it SHALL include `"character"` in `subjectKinds`
- **AND** it SHALL include `"primary_character"` in `subjectRoles`

### Requirement: Credit names and subject names remain separate

The content index SHALL NOT add SubjectAttribution Entity names to `creditNames`. CreditAttribution mutations SHALL update credit fields, and SubjectAttribution mutations SHALL update subject fields.

#### Scenario: Character subject does not pollute credit search

- **GIVEN** Unit "fanfic-1" has no author credit but has a primary character SubjectAttribution
- **WHEN** the Unit is synced to the content index
- **THEN** the character name SHALL appear in `subjectNames`
- **AND** the character name SHALL NOT appear in `creditNames`

### Requirement: SubjectAttribution mutations trigger content partial sync

Creating, updating, or deleting a SubjectAttribution row SHALL trigger a Meilisearch partial update for the affected target Unit's subject fields.

#### Scenario: Link subject patches content document

- **WHEN** a SubjectAttribution row is created for target Unit "fanfic-1"
- **THEN** the system SHALL patch the "fanfic-1" content document's subject fields
- **AND** it SHALL NOT rebuild unrelated credit fields as part of the subject-only patch
