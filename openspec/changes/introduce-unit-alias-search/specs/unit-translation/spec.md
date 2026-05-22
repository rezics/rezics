## ADDED Requirements

### Requirement: UnitTranslation remains primary display text when aliases exist
UnitTranslation SHALL remain the authoritative language-specific display text for a Unit. UnitAlias rows SHALL be supplemental search metadata and SHALL NOT replace translation resolution, translation fallback, or display title selection.

#### Scenario: Alias match displays translation title
- **GIVEN** Unit `unit-1` has `UnitTranslation(en).title = "The Three-Body Problem"`
- **AND** UnitAlias value `"3 Body Problem"` exists for `unit-1`
- **WHEN** a search query matches `unit-1` through the alias
- **THEN** the search result display title SHALL still be resolved from UnitTranslation
- **AND** the alias SHALL NOT replace the title unless a UI explicitly renders matched alias context
