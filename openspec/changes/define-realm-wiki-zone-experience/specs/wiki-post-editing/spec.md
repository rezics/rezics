## ADDED Requirements

### Requirement: Wiki translations use TranslationGroup
Parallel language variants of the same wiki page SHALL be represented as separate WIKI Post Units grouped by TranslationGroup. Wiki page body translations SHALL NOT be modeled as UnitTranslation rows on a single wiki Unit.

#### Scenario: Wiki page has parallel translations
- **GIVEN** English and Japanese wiki pages describe the same Entity
- **WHEN** the pages are linked as translations
- **THEN** each language variant SHALL remain a separate WIKI Post Unit
- **AND** the variants SHALL share a TranslationGroup

### Requirement: Featured wiki references use TranslationGroup by default
Wiki navigation and homepage configuration SHALL reference TranslationGroup ids when the intended link is a multilingual wiki page. A specific wiki Unit id SHALL be used only when the configuration intentionally targets one language-specific Unit.

#### Scenario: Homepage stores translation group
- **WHEN** a manager features the Artoria wiki page on a wiki Zone homepage
- **THEN** the configuration SHOULD store the Artoria wiki TranslationGroup id
- **AND** rendering SHALL select the viewer's best language wiki Unit
