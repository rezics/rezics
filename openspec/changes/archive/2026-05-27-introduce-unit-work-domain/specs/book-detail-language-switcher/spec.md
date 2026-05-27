## ADDED Requirements

### Requirement: Book Language Switching Is Release-Local

For release-aware books, the detail-page language switcher SHALL switch only
between `UnitTranslation` records that belong to the current visible release.
It SHALL NOT navigate to a different same-work release, and it SHALL NOT
automatically resolve another release for the requested language.

#### Scenario: Switch current release translation

- **GIVEN** current release `release-a` has `UnitTranslation(release-a, en)`
- **AND** it has `UnitTranslation(release-a, zh-hant)`
- **WHEN** the user switches the book detail language to `zh-hant`
- **THEN** the page SHALL render `release-a` using its `zh-hant` translation
- **AND** the active release SHALL remain `release-a`

#### Scenario: Missing translation does not substitute another release

- **GIVEN** current release `release-a` has no `UnitTranslation(release-a, de)`
- **AND** same-work release `release-de` exists
- **WHEN** the user requests German from the detail language switcher
- **THEN** the page SHALL NOT silently navigate to `release-de`
- **AND** it SHALL show the missing-language affordance described by this
  capability

### Requirement: Missing Language Affordance Opens Releases Tab

The language switcher SHALL include an affordance for the case where the current
release does not provide the user's desired language. Activating that affordance
SHALL navigate to the Releases tab for the current work, where the user can
filter and choose another same-work release explicitly.

#### Scenario: Preferred language missing

- **GIVEN** the viewer prefers `zh-hant`
- **AND** current release `release-a` lacks a `zh-hant` translation
- **WHEN** the language switcher renders
- **THEN** it SHALL include an option indicating the desired language was not
  found for the current release
- **AND** activating that option SHALL open the Releases tab with the viewer's
  preferred languages selected by default

#### Scenario: Releases tab handles same-work discovery

- **GIVEN** current release `release-a` belongs to `work-x`
- **WHEN** the missing-language option opens the Releases tab
- **THEN** same-work release discovery SHALL be handled by
  `UnitWork(work-x, role = RELEASE)` membership
- **AND** selecting another release SHALL be an explicit user navigation action
