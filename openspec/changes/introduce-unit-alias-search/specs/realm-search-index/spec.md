## ADDED Requirements

### Requirement: Realm search index includes Unit aliases
The realm search index SHALL include alias-derived searchable text for Realm Units. Alias text SHALL be indexed separately from translated realm titles and SHALL follow the same `score > visibilityThreshold OR pinned = true` inclusion rule.

#### Scenario: Realm search matches alias
- **GIVEN** a Realm Unit has translated title `"rezics"`
- **AND** it has alias value `"Library.Book"`
- **WHEN** a user searches realms for `"Library.Book"`
- **THEN** the Realm Unit SHALL be eligible to appear in results
- **AND** the displayed realm name SHALL still resolve from UnitTranslation
