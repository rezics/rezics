## ADDED Requirements

### Requirement: Language preferences
The Preferences section SHALL display the user's preferred languages (from `userSettings.preferredLanguages`) and allow adding/removing languages from the supported set (zh-hant, zh-hans, en, ja, de). Changes SHALL be saved via `userApi.updateSettings()`.

#### Scenario: Set preferred languages
- **WHEN** the user adds "ja" to their preferred languages and saves
- **THEN** the settings are updated and content will prioritize Japanese translations

### Requirement: Realm tag preferences
The Preferences section SHALL display realm tag preference settings (from `userSettings.realmTagPreferences`) allowing the user to configure tag display per realm. Changes SHALL be saved via `userApi.updateSettings()`.

#### Scenario: Update realm tag preferences
- **WHEN** the user modifies realm tag preferences and saves
- **THEN** the settings are updated via the API

### Requirement: Keyword vocabulary management
The Preferences section SHALL display the user's keyword vocabulary with a counter showing current count out of 500 maximum. The user SHALL be able to add new keywords (via text input) and remove existing keywords. Changes SHALL be saved via `PATCH /users/me/keywords`.

#### Scenario: Add keyword
- **WHEN** the user types a new keyword and clicks Add
- **THEN** the keyword is added to the vocabulary and the counter increments

#### Scenario: Remove keyword
- **WHEN** the user clicks the remove button on an existing keyword
- **THEN** the keyword is removed and the counter decrements

#### Scenario: Keyword limit reached
- **WHEN** the user has 500 keywords
- **THEN** the add input is disabled and a message "Maximum 500 keywords reached" is shown

### Requirement: Empty keyword state
When the user has no keywords, a helpful message SHALL be displayed explaining what keywords are for.

#### Scenario: No keywords
- **WHEN** the user has zero keywords
- **THEN** a message explaining the keyword vocabulary feature is displayed with the add input available

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
