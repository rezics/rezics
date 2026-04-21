## ADDED Requirements

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
