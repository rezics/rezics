## MODIFIED Requirements

### Requirement: SubjectAttribution service and API expose link, unlink, and list operations

The server SHALL expose service and HTTP operations to link a subject to a Unit, unlink by composite key, list subjects for a Unit, and list Units for a subject. Public link/unlink inputs SHALL validate role keys against the contract subject attribution role registry. Link writes SHALL also validate that the target Entity's `eligibleSubjectRoles` contains the requested subject role. DTOs SHALL include the linked Entity's translations and avatar so clients can resolve subject display through the existing multilingual fallback rules.

#### Scenario: List subjects for a Unit

- **GIVEN** Unit "fanfic-1" has SubjectAttribution rows to character and faction Entities
- **WHEN** a client requests the subject list for "fanfic-1"
- **THEN** the response SHALL include each role, sort order, and Entity DTO with translations
- **AND** the response SHALL include the Entity avatar when present

#### Scenario: List Units for a subject

- **GIVEN** Entity "character-1" is linked to multiple published Units through SubjectAttribution
- **WHEN** a client requests Units for subject "character-1" filtered by `role = "primary_character"`
- **THEN** the response SHALL include matching target Units only

#### Scenario: Eligible Entity can be linked as primary character

- **GIVEN** Entity "character-1" has `eligibleSubjectRoles = ["primary_character"]`
- **WHEN** a caller creates `SubjectAttribution(unitId = "fanfic-1", entityId = "character-1", role = "primary_character")`
- **THEN** the link SHALL be persisted

#### Scenario: Ineligible Entity cannot be linked as primary character

- **GIVEN** Entity "person-1" has `eligibleSubjectRoles = ["about"]`
- **WHEN** a caller creates `SubjectAttribution(unitId = "fanfic-1", entityId = "person-1", role = "primary_character")`
- **THEN** the service SHALL reject the write with a typed eligibility error
- **AND** no SubjectAttribution row SHALL be created
