## ADDED Requirements

### Requirement: Entity represents abstract referents and wiki subjects

Entity units SHALL represent durable abstract referents, including credited parties and wiki subjects. Valid Entity subjects include people, organizations, circles, studios, labels, characters, factions, families, locations, artifacts, events, and concepts. Entity identity SHALL continue to be backed by `Unit(type = ENTITY)` and the Entity extension row; subject categories SHALL NOT become separate UnitType values.

#### Scenario: Create a character Entity

- **WHEN** an Entity is created with `kind = "character"` and translated titles
- **THEN** the system SHALL persist it as `Unit(type = ENTITY)` with an Entity extension row
- **AND** its display name SHALL resolve from UnitTranslation

#### Scenario: Faction does not create a new Unit type

- **WHEN** a faction subject is created
- **THEN** the Unit type SHALL be `ENTITY`
- **AND** the Entity `kind` SHALL be `"faction"`

### Requirement: Entity kind constants include subject kinds

The contract-level Entity kind constants SHALL include subject-oriented values in addition to credited-party values. The database SHALL continue to store Entity kind as a nullable string, and unsupported custom kind strings SHALL remain possible at the database level.

#### Scenario: Contract exposes character and faction kinds

- **WHEN** a client imports Entity kind constants from `@rezics/contract`
- **THEN** the list SHALL include `"character"`, `"faction"`, `"family"`, `"location"`, `"artifact"`, `"event"`, and `"concept"`

### Requirement: Entity multilingual behavior remains unchanged for subjects

Subject Entities SHALL use the same UnitTranslation fields and fallback behavior as all other Entity units. The system SHALL NOT add `displayName`, `name`, `bio`, or subject-specific language columns to the Entity table.

#### Scenario: Character name resolves by UnitTranslation

- **GIVEN** Entity "character-1" has UnitTranslation rows in `"zh-hant"` and `"en"`
- **WHEN** the client renders the character in English
- **THEN** the displayed name SHALL resolve from the English UnitTranslation when available
- **AND** it SHALL use the standard UnitTranslation fallback chain when unavailable
