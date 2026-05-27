## ADDED Requirements

### Requirement: Language switcher is a dropdown fixed at the right end of the tab bar

The book detail page SHALL display a language dropdown at the right end of the tab bar row. The dropdown SHALL show the currently selected language label and, when opened, list all languages available in the book's `translations[]` array. The dropdown SHALL remain fixed (not scroll) when the tab bar scrolls horizontally on small screens.

#### Scenario: Dropdown displays available languages

- **WHEN** a book has translations for `["ja", "en", "zh-hant"]`
- **THEN** the language dropdown SHALL list Japanese, English, and Traditional Chinese as options
- **AND** the currently selected language SHALL be visually indicated

#### Scenario: Dropdown is fixed while tabs scroll

- **WHEN** the viewport is narrow and tabs overflow horizontally
- **THEN** the language dropdown SHALL remain visible and fixed at the right end
- **AND** scrolling the tab bar SHALL NOT affect the dropdown position

### Requirement: Initial language is resolved from user preference priority list

When the book detail page loads, the system SHALL resolve the initial language by iterating the user's `preferredLanguages` array (from `UserSettings`) in order and selecting the first language that exists in the book's `translations[]`. If no user preference matches, the system SHALL fall back to the existing translation resolution chain: unit `defaultLanguage` → platform fallback `"en"` → first available translation.

#### Scenario: Preference list matches an available language

- **GIVEN** user preferences are `["zh-hant", "ja", "en"]`
- **AND** the book has translations for `["ja", "en"]`
- **WHEN** the book detail page loads
- **THEN** the initial language SHALL be `"ja"` (first match from preference list)

#### Scenario: No preference matches — fallback to unit default

- **GIVEN** user preferences are `["de", "fr"]`
- **AND** the book has translations for `["ja", "en"]` with `defaultLanguage = "ja"`
- **WHEN** the book detail page loads
- **THEN** the initial language SHALL be `"ja"` (unit default fallback)

#### Scenario: Unauthenticated user — no preference list

- **GIVEN** the user is not authenticated (no `preferredLanguages`)
- **AND** the book has translations for `["ja", "en"]` with `defaultLanguage = "en"`
- **WHEN** the book detail page loads
- **THEN** the initial language SHALL be `"en"` (unit default)

### Requirement: Language selection is per-book and ephemeral

Language selection on the book detail page SHALL be scoped to the current book and SHALL NOT be persisted. Navigating away from the book and returning SHALL reset the language to the preference-resolved default. Changing the language on one book SHALL NOT affect the language shown on other books.

#### Scenario: Language resets on re-navigation

- **GIVEN** the user manually selected `"en"` on book A (preference default was `"ja"`)
- **WHEN** the user navigates away from book A and returns
- **THEN** the language SHALL be reset to `"ja"` (preference-resolved default)

#### Scenario: Per-book isolation

- **GIVEN** the user selected `"en"` on book A
- **WHEN** the user navigates to book B
- **THEN** book B's language SHALL be independently resolved from the preference list

### Requirement: Language selection propagates page-wide

Changing the selected language SHALL affect all translation-dependent content on the book detail page: (1) hero section title, subtitle, and description, (2) author/entity name and bio (resolved via entity translations), (3) book description in the Overview tab, (4) the default release selection in the Content tab (auto-selects the translation-designated release for the new language).

#### Scenario: Switching language updates hero and content

- **GIVEN** the user is viewing book detail with language `"ja"` selected
- **WHEN** the user switches to `"en"` via the language dropdown
- **THEN** the hero title SHALL update to the English translation
- **AND** the author name SHALL update to the English entity translation
- **AND** the Overview tab description SHALL update to English
- **AND** the Content tab's release selector SHALL auto-select the English translation's designated release

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
