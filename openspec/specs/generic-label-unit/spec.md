# generic-label-unit Specification

## Purpose
TBD - created by archiving change define-realm-wiki-zone-experience. Update Purpose after archive.
## Requirements
### Requirement: LABEL is a Unit-only type
The contract SHALL define `UnitType.LABEL` for reusable multilingual labels, navigation group headings, homepage section headings, and other configuration-facing display nodes. A LABEL Unit SHALL use the base `Unit` and `UnitTranslation` models and SHALL NOT require a type-specific extension table.

#### Scenario: Create label Unit
- **WHEN** an authorized actor creates a Unit with `type = LABEL`
- **THEN** the system SHALL persist the base Unit row
- **AND** it SHALL allow UnitTranslation rows for the label title and description
- **AND** it SHALL NOT require an extension row such as `Label`

#### Scenario: Delete label Unit
- **WHEN** a LABEL Unit is deleted
- **THEN** its UnitTranslation rows SHALL be deleted through the same cascade behavior as other Units

### Requirement: LABEL Units are not catalog content
LABEL Units SHALL NOT be treated as ordinary library content, work/release content, wiki pages, tags, entities, or realms. Public catalog lists, reading flows, and ordinary content search SHALL exclude LABEL Units unless a label picker or configuration surface explicitly requests them.

#### Scenario: Label excluded from catalog search
- **WHEN** a public content search requests ordinary library content
- **THEN** LABEL Units SHALL NOT appear in the result set

#### Scenario: Label picker can search labels
- **WHEN** a Zone management surface opens a picker for navigation labels
- **THEN** the picker MAY search LABEL Units by translated title

### Requirement: LABEL display resolves through UnitTranslation
Clients SHALL render LABEL display text through UnitTranslation fallback rules. Configuration JSON SHOULD reference a LABEL Unit id when a reusable multilingual label is needed.

#### Scenario: Navigation group uses label Unit
- **GIVEN** a LABEL Unit has English and Traditional Chinese UnitTranslation rows
- **WHEN** a viewer opens a wiki Zone navigation group that references the LABEL Unit
- **THEN** the group label SHALL render in the viewer's best available language

### Requirement: LABEL does not replace semantic types
The system SHALL reject or prevent LABEL Units from being used where an Entity, Tag, Realm, Work, Release, or WIKI Post is required by schema. LABEL Units MAY label a navigation section, but they SHALL NOT act as the section's semantic subject.

#### Scenario: Label cannot be subject attribution entity
- **WHEN** a caller attempts to create SubjectAttribution with `entityId` pointing at a LABEL Unit
- **THEN** the system SHALL reject the write because subject entities must be ENTITY Units

#### Scenario: Label cannot be realm context
- **WHEN** a caller attempts to create a work realm context with `realmUnitId` pointing at a LABEL Unit
- **THEN** the system SHALL reject the write because the context target must be a REALM Unit

