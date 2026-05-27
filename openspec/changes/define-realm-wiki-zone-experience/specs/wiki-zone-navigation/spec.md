## ADDED Requirements

### Requirement: Wiki Zone navigation is configured from typed sections
Wiki Zone navigation SHALL be configured as typed sections rather than arbitrary markup. Supported navigation item sources SHALL include Entity collections, Tag collections, TranslationGroup links, LABEL Unit labels, Unit links, external links, and manually translated link groups.

#### Scenario: Navigation has character section
- **WHEN** a wiki Zone config includes an entity navigation section for `entityKinds = ["character"]`
- **THEN** the Zone navigation SHALL render a Characters section using matching Entity data

### Requirement: Navigation stores ids for i18n-capable objects
Navigation configuration SHALL store ids for Entity, Tag, TranslationGroup, Unit, and LABEL references whenever those objects provide the display label. The renderer SHALL resolve display text through the referenced object's existing i18n behavior.

#### Scenario: Tag navigation resolves translated labels
- **GIVEN** a navigation group references Tag Units `tag-timeline` and `tag-magic`
- **WHEN** a Traditional Chinese viewer opens the wiki Zone
- **THEN** the tag labels SHALL render through those Tag Units' translations

#### Scenario: Label Unit resolves group heading
- **GIVEN** a navigation section uses `labelUnitId = label-major-characters`
- **WHEN** the section renders
- **THEN** the heading SHALL be resolved from the LABEL Unit's UnitTranslation fallback

### Requirement: Manual labels are explicitly translated
Manual navigation labels that do not reference an i18n-capable object SHALL provide an explicit translation map. Raw single-language labels SHALL be rejected by public management APIs.

#### Scenario: Raw manual label rejected
- **WHEN** a manager saves a navigation item with `label = "Characters"` and no translation map or label Unit id
- **THEN** the server SHALL reject the configuration

#### Scenario: Manual translated label accepted
- **WHEN** a manager saves a manual link with translations for at least the realm default language
- **THEN** the server SHALL accept the configuration

### Requirement: Navigation can link to TranslationGroup pages
Navigation SHALL support links that reference wiki `translationGroupId` values. Rendering SHALL resolve the best WIKI Post Unit for the viewer's language and fall back deterministically when no exact language variant exists.

#### Scenario: Translation group link selects viewer language
- **GIVEN** translation group `tg-artoria` contains English and Japanese WIKI Post Units
- **WHEN** a Japanese viewer opens a navigation link to `tg-artoria`
- **THEN** the link SHALL resolve to the Japanese WIKI Post Unit

### Requirement: Navigation validation enforces realm scope
Wiki Zone navigation sections that query realm wiki content SHALL be scoped to the Zone's configured realm. Navigation MUST NOT expose private or hidden Units that the viewer cannot access.

#### Scenario: Private wiki hidden from navigation
- **GIVEN** a navigation section would otherwise include private wiki Unit `wiki-private`
- **WHEN** a viewer without access opens the wiki Zone
- **THEN** `wiki-private` SHALL NOT appear in navigation results
