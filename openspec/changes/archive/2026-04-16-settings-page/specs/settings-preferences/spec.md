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
