## MODIFIED Requirements

### Requirement: Language preferences

The Preferences section SHALL display the user's preferred languages (from `userSettings.preferredLanguages`) as an **ordered priority list** with drag-to-reorder support. The list order SHALL represent the user's language preference priority — the first language is the most preferred. Users SHALL be able to add languages from the supported set (zh-hant, zh-hans, en, ja, de), remove languages, and reorder them by dragging. Changes SHALL be saved via `userApi.updateSettings()` with the array preserving the user-defined order.

#### Scenario: Set preferred languages with priority order

- **WHEN** the user adds "ja" and "en" to their preferred languages and drags "ja" above "en"
- **THEN** the settings SHALL be saved as `preferredLanguages: ["ja", "en"]`
- **AND** content resolution SHALL prioritize Japanese over English

#### Scenario: Reorder language priority

- **GIVEN** the user's preferred languages are `["en", "ja"]`
- **WHEN** the user drags "ja" above "en"
- **THEN** the settings SHALL be saved as `["ja", "en"]`

#### Scenario: Remove a language from the list

- **GIVEN** the user's preferred languages are `["zh-hant", "ja", "en"]`
- **WHEN** the user removes "ja"
- **THEN** the settings SHALL be saved as `["zh-hant", "en"]` preserving order of remaining items
