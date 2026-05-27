## ADDED Requirements

### Requirement: System requirement text is not UnitTranslation extra

`UnitTranslation.extra` SHALL remain scoped to translation-correlated
presentation metadata such as cover URLs. Game system requirement raw text SHALL
NOT be stored in `UnitTranslation.extra`, because requirements are
platform/tier/source-specific facts and do not follow the UnitTranslation
display fallback chain.

#### Scenario: Requirement text stored outside UnitTranslation

- **WHEN** a GAME release records recommended system requirements as raw text
- **THEN** the raw text SHALL be stored in the game system requirements backend
- **AND** `UnitTranslation.extra` SHALL NOT receive a requirements field

#### Scenario: Cover remains translation extra

- **WHEN** a GAME or MEDIA release has localized cover art
- **THEN** the cover URL MAY remain in `UnitTranslation.extra.coverUrl`
- **AND** this SHALL NOT imply that source-specific requirement text belongs in the same JSON object
