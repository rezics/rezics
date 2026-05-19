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

### Requirement: Age-rating opt-ins section

The Preferences section SHALL display a "Content rating" group with a row per `ContentRating` tier. `GENERAL` and `R_15` SHALL be rendered as permanently enabled and non-interactive (always allowed). `R_18` and `R_18G` SHALL each be rendered as a checkbox reflecting the corresponding entry in `User.settings.content.optedInRatings`.

Enabling `R_18` or `R_18G` (toggling its checkbox from unchecked to checked) SHALL open a confirmation modal explaining the nature of the content tier and requiring the user to acknowledge it explicitly. The PATCH to `User.settings.content.optedInRatings` SHALL only fire on explicit confirmation. Dismissing or cancelling the modal SHALL leave the checkbox unchecked and SHALL NOT send a request.

Disabling `R_18` or `R_18G` (toggling its checkbox from checked to unchecked) SHALL NOT open a confirmation modal and SHALL fire the PATCH directly.

Persisting the change SHALL use `userApi.updateSettings()` with the updated `settings.content.optedInRatings` array.

#### Scenario: Baseline tiers are locked on

- **GIVEN** any user on the Preferences page
- **WHEN** the Content rating group renders
- **THEN** the `GENERAL` and `R_15` rows SHALL be shown as enabled and non-interactive
- **AND** no click or keyboard action SHALL disable them

#### Scenario: Enable R_18 requires confirmation

- **GIVEN** a user whose `optedInRatings` is `[]`
- **WHEN** the user ticks the `R_18` checkbox
- **THEN** a confirmation modal SHALL open
- **AND** no request SHALL be sent until the user confirms
- **AND** if the user confirms, the client SHALL call `userApi.updateSettings()` with `content.optedInRatings: ["R_18"]`
- **AND** if the user cancels, the checkbox SHALL return to unchecked and no request SHALL be sent

#### Scenario: Enable R_18G requires separate confirmation

- **GIVEN** a user whose `optedInRatings` is `["R_18"]`
- **WHEN** the user ticks the `R_18G` checkbox
- **THEN** a confirmation modal SHALL open (even though `R_18` is already enabled)
- **AND** on confirmation the client SHALL call `userApi.updateSettings()` with `content.optedInRatings: ["R_18", "R_18G"]`

#### Scenario: Disable does not require confirmation

- **GIVEN** a user whose `optedInRatings` is `["R_18", "R_18G"]`
- **WHEN** the user unticks `R_18G`
- **THEN** the client SHALL immediately call `userApi.updateSettings()` with `content.optedInRatings: ["R_18"]`
- **AND** no modal SHALL open

#### Scenario: Preference persists across sessions

- **GIVEN** a user who enabled `R_18` on device A
- **WHEN** the user signs in on device B
- **THEN** the Content rating group on device B SHALL show `R_18` as checked
- **AND** discovery filters on device B SHALL include `R_18` in the allowed set

### Requirement: Opt-in UI does not bypass server validation

The client SHALL NOT include `GENERAL` or `R_15` in the `content.optedInRatings` array sent to `userApi.updateSettings()`. If a client does send them, the server SHALL reject the request with a validation error. The UI SHALL serialize only opt-in tiers (`R_18` and/or `R_18G`).

#### Scenario: Server rejects baseline tiers in opt-ins

- **GIVEN** a client that erroneously sends `content.optedInRatings: ["GENERAL", "R_18"]`
- **WHEN** the server validates the request
- **THEN** it SHALL reject with a validation error
- **AND** no setting SHALL be persisted

### Requirement: User settings may store publishing license default
User settings SHALL allow an authenticated user to store a default Unit publication license slug.

#### Scenario: User saves default license
- **WHEN** a user updates settings with a valid default license slug
- **THEN** the settings API SHALL persist the value

#### Scenario: User saves invalid default license
- **WHEN** a user updates settings with an unknown default license slug
- **THEN** the settings API SHALL reject the update with a client error

### Requirement: Composer reads user publishing default
Composer flows SHALL use the user's publishing license default as a prefill when no stronger context default applies.

#### Scenario: User opens composer outside a realm
- **WHEN** a user with a default license opens a composer outside a realm-specific context
- **THEN** the composer SHALL prefill the user's default license
