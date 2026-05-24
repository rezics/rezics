## ADDED Requirements

### Requirement: Entity search index includes Unit aliases
The entity search index SHALL include alias-derived searchable text for Entity Units. Alias text SHALL be indexed separately from translated entity names and SHALL follow the same `score > visibilityThreshold OR pinned = true` inclusion rule.

#### Scenario: Entity search matches alias
- **GIVEN** an Entity Unit has display title `"Liu Cixin"`
- **AND** it has alias value `"Cixin Liu"`
- **WHEN** a user searches entities for `"Cixin Liu"`
- **THEN** the Entity Unit SHALL be eligible to appear in results
- **AND** the displayed name SHALL still resolve from UnitTranslation
