## ADDED Requirements

### Requirement: App and admin UI surfaces use catalog-backed copy

All production app and admin UI surfaces SHALL render static user-visible UI copy
through generated Paraglide product/domain message functions or approved shared
label helpers. Hard-coded static display text SHALL NOT remain in production
app/admin UI source after the migration.

#### Scenario: App production UI copy is catalog-backed

- **WHEN** production source under `package/app/src/` renders static UI copy in
  JSX text nodes, labels, placeholders, tooltips, dialog copy, empty states,
  loading states, error states, toast text, route/page titles, or accessibility
  attributes
- **THEN** the copy SHALL come from generated `@rezics/i18n/messages` functions
  or approved label helpers
- **AND** eligible hard-coded Chinese, English, Japanese, German, or Korean UI
  copy SHALL NOT remain

#### Scenario: Admin production UI copy is catalog-backed

- **WHEN** production source under `package/admin/src/` renders static UI copy in
  JSX text nodes, labels, placeholders, tooltips, dialog copy, empty states,
  loading states, error states, toast text, route/page titles, table headers, or
  accessibility attributes
- **THEN** the copy SHALL come from generated `@rezics/i18n/messages` functions
  or approved label helpers
- **AND** eligible hard-coded Chinese, English, Japanese, German, or Korean UI
  copy SHALL NOT remain

#### Scenario: Intentional literals are allowed

- **WHEN** app/admin source renders a brand name, protocol literal, URL example,
  enum key, field key, debug-only identifier, user-provided value, catalog data,
  or intentionally technical API value
- **THEN** the value MAY remain a literal
- **AND** convention checks MAY require an inline allowlist or nearby
  justification if the literal resembles user-visible UI copy

## MODIFIED Requirements

### Requirement: All six locale files contain keys for homepage and search strings

Translation keys for homepage sections and search components SHALL exist in all
six JSON locale message files for `en`, `zh-hant`, `zh-hans`, `de`, `ja`, and
`ko`. Missing native-quality translations SHALL be represented by explicit
catalog entries in the target locale file, not by runtime fallback strings at
the rendering callsite.

#### Scenario: en locale has complete homepage section keys

- **WHEN** the `en` locale message file is loaded
- **THEN** it SHALL contain keys for all homepage section titles, action labels,
  tab labels, loading states, and empty states

#### Scenario: zh-hant locale has complete homepage section keys

- **WHEN** the `zh-hant` locale message file is loaded
- **THEN** it SHALL contain keys matching the same key structure as `en` with
  Traditional Chinese translations

#### Scenario: ko locale has complete homepage section keys

- **WHEN** the `ko` locale message file is loaded
- **THEN** it SHALL contain keys matching the same key structure as `en` with
  Korean translations

### Requirement: i18n resource keys use canonical language codes

The Paraglide project configuration SHALL use canonical language codes
(`zh-hant`, `zh-hans`, `en`, `ja`, `de`, `ko`) as locale identifiers. Locale
source files SHALL be named using canonical codes where file names include
locale codes.

#### Scenario: i18n resources registered with canonical keys

- **WHEN** the Paraglide i18n runtime initializes
- **THEN** locale identifiers SHALL be `'zh-hant'`, `'zh-hans'`, `'en'`, `'ja'`,
  `'de'`, and `'ko'`
- **AND** no locale identifier SHALL use legacy or regional codes (`zh-SC`,
  `zh-TC`, `en-US`, `ja-JP`, `de-DE`, `ko-KR`, or `kr`)

#### Scenario: Default language is zh-hant

- **WHEN** the i18n runtime initializes without a persisted language preference
- **THEN** the active language SHALL be `'zh-hant'`

### Requirement: Language toggle uses canonical codes

The LangToggle component SHALL use canonical language codes when requesting a
language change. Display labels SHALL use native language names from
`LANGUAGE_META`.

#### Scenario: User switches to Traditional Chinese

- **WHEN** the user selects Traditional Chinese from the language toggle
- **THEN** the app/admin locale synchronization helper SHALL be called with
  `'zh-hant'`
- **AND** the menu item SHALL display "繁體中文"

#### Scenario: User switches to English

- **WHEN** the user selects English from the language toggle
- **THEN** the app/admin locale synchronization helper SHALL be called with
  `'en'`

#### Scenario: User switches to Korean

- **WHEN** the user selects Korean from the language toggle
- **THEN** the app/admin locale synchronization helper SHALL be called with
  `'ko'`
- **AND** the menu item SHALL display "한국어"

## REMOVED Requirements

### Requirement: Fallback language is en

**Reason**: Missing UI message keys must be caught by catalog completeness checks
and generated message usage. Runtime fallback from an incomplete UI locale to
English hides translation drift and conflicts with the compiled UI i18n model.

**Migration**: Add missing keys to every supported UI locale JSON file and
replace fallback-backed callsites with generated message functions. Content data
fallback chains remain governed by content/unit translation specs and are not
removed by this UI-copy migration.
