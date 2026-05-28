## MODIFIED Requirements

### Requirement: Homepage sections use i18n for all UI strings

All homepage section components SHALL resolve UI strings via
`useTranslation('<ns>')` and `t('<ns>:<key>')` from `react-i18next`.
No section component SHALL contain hardcoded Chinese or English
display text. Section titles, action labels ("More"), loading states,
empty states, and tab labels SHALL be resolved from the appropriate
namespace JSON files served at `/locales/{lng}/{ns}.json`.

#### Scenario: NewBookSection renders in user's UI language

- **WHEN** the homepage loads with UI language set to "en"
- **THEN** NewBookSection SHALL display "Latest Works" (not
  "最新作品"), tab labels "Latest Serial" / "New on Shelf" /
  "Recently Completed", and "More" (not "更多 →")
- **AND** the section SHALL resolve those strings through
  `t('book:...')` or `t('common:...')` against the loaded `book` and
  `common` namespaces

#### Scenario: TrendingBookSection renders in user's UI language

- **WHEN** the homepage loads with UI language set to "en"
- **THEN** TrendingBookSection SHALL display "Trending Books" (not
  "趋势好书") and "More" (not "更多 →")
- **AND** the strings SHALL come from `t('book:...')` /
  `t('common:...')`

#### Scenario: ActiveRealmsSection renders in user's UI language

- **WHEN** the homepage loads with UI language set to "zh-hant"
- **THEN** ActiveRealmsSection SHALL display the Traditional Chinese
  translations for "Active Realms" and "More"
- **AND** the strings SHALL come from `t('entity:...')` /
  `t('common:...')`

#### Scenario: LibraryCardsSection renders in user's UI language

- **WHEN** the homepage loads with UI language set to "ja"
- **THEN** LibraryCardsSection SHALL display Japanese translations
  for "Book Library", "Game Library", "Media Library", and
  "Coming Soon"
- **AND** the strings SHALL come from `t('shell:...')` /
  `t('common:...')`

### Requirement: Search components use i18n for all UI strings

SearchFilter and SearchInput components SHALL resolve all sort
labels, filter labels, placeholder text, and preset tag labels via
`useTranslation('search')` (and `'common'` where applicable) and
`t('<ns>:<key>')`. No search component SHALL contain hardcoded
Chinese or English display text.

#### Scenario: SearchFilter renders sort options in user's UI language

- **WHEN** the search page loads with UI language set to "en"
- **THEN** sort options SHALL display "Relevance", "Latest", "Total
  Favorites", "Word Count", "Monthly Votes" (not Chinese
  equivalents)
- **AND** order buttons SHALL display "Descending" / "Ascending"
  (not "降序" / "升序")
- **AND** every label SHALL resolve through `t('search:...')`

#### Scenario: SearchInput renders placeholder in user's UI language

- **WHEN** the search page loads with UI language set to "zh-hant"
- **THEN** the search placeholder SHALL display the Traditional
  Chinese translation for "Title, ISBN, Author, Publisher,
  Producer"
- **AND** filter labels ("Tags", "Word Count") SHALL display in
  Traditional Chinese resolved through `t('common:tags')` and
  `t('search:...')`

### Requirement: All six locale folders contain complete namespace files

Every supported locale SHALL have a folder under `public/locales/`
containing a JSON file for every namespace in the canonical
namespace map. Within each namespace, every locale's JSON file SHALL
contain the exact same key set as the `en` base file. Missing
translations SHALL be represented by explicit catalog entries in the
target locale's JSON, not by runtime fallback strings at the
rendering callsite.

#### Scenario: en locale has complete homepage namespace keys

- **WHEN** `public/locales/en/book.json`,
  `public/locales/en/common.json`, and
  `public/locales/en/shell.json` are loaded
- **THEN** they SHALL contain keys for all homepage section titles,
  action labels, tab labels, loading states, and empty states

#### Scenario: zh-hant locale has complete homepage namespace keys

- **WHEN** the `zh-hant` JSON files for the same namespaces are
  loaded
- **THEN** they SHALL contain Traditional Chinese values for every
  key present in the `en` files

#### Scenario: ko locale has complete homepage namespace keys

- **WHEN** the `ko` JSON files for the same namespaces are loaded
- **THEN** they SHALL contain Korean values for every key present
  in the `en` files

### Requirement: i18n resource keys use canonical language codes

The i18next runtime SHALL use canonical language codes (`zh-hant`,
`zh-hans`, `en`, `ja`, `de`, `ko`) as locale identifiers. Locale
source folders under `public/locales/` SHALL be named using these
codes.

#### Scenario: i18next is initialized with canonical codes

- **WHEN** the i18next runtime initializes
- **THEN** `supportedLngs` SHALL be `['en', 'zh-hant', 'zh-hans',
  'ja', 'de', 'ko']`
- **AND** no locale identifier SHALL use legacy or regional codes
  (`zh-SC`, `zh-TC`, `en-US`, `ja-JP`, `de-DE`, `ko-KR`, or `kr`)

#### Scenario: Default language is zh-hant

- **WHEN** the i18next runtime initializes without a persisted
  language preference
- **THEN** `i18next.language` SHALL be `'zh-hant'`

### Requirement: Language toggle uses canonical codes

The LangToggle component SHALL pass canonical language codes when
requesting a language change via `i18next.changeLanguage(locale)`.
Display labels SHALL use native language names from
`LANGUAGE_META`.

#### Scenario: User switches to Traditional Chinese

- **WHEN** the user selects Traditional Chinese from the language
  toggle
- **THEN** `i18next.changeLanguage('zh-hant')` SHALL be called
- **AND** the menu item SHALL display "繁體中文"

#### Scenario: User switches to English

- **WHEN** the user selects English from the language toggle
- **THEN** `i18next.changeLanguage('en')` SHALL be called

#### Scenario: User switches to Korean

- **WHEN** the user selects Korean from the language toggle
- **THEN** `i18next.changeLanguage('ko')` SHALL be called
- **AND** the menu item SHALL display "한국어"

### Requirement: App and admin UI surfaces use catalog-backed copy

All production app and admin UI surfaces SHALL render static
user-visible UI copy through `t('<ns>:<key>')` against the namespace
JSON catalogs. Hard-coded static display text SHALL NOT remain in
production app/admin UI source after the migration.

#### Scenario: App production UI copy is catalog-backed

- **WHEN** production source under `package/app/src/` renders
  static UI copy in JSX text nodes, labels, placeholders, tooltips,
  dialog copy, empty states, loading states, error states, toast
  text, route/page titles, or accessibility attributes
- **THEN** the copy SHALL come from `t('<ns>:<key>')` for the
  appropriate namespace
- **AND** eligible hard-coded Chinese, English, Japanese, German,
  or Korean UI copy SHALL NOT remain

#### Scenario: Admin production UI copy is catalog-backed

- **WHEN** production source under `package/admin/src/` renders
  static UI copy in JSX text nodes, labels, placeholders, tooltips,
  dialog copy, empty states, loading states, error states, toast
  text, route/page titles, table headers, or accessibility
  attributes
- **THEN** the copy SHALL come from `t('<ns>:<key>')` for the
  appropriate namespace (typically `'admin:'` or `'common:'`)
- **AND** eligible hard-coded Chinese, English, Japanese, German,
  or Korean UI copy SHALL NOT remain

#### Scenario: Intentional literals are allowed

- **WHEN** app/admin source renders a brand name, protocol literal,
  URL example, enum key, field key, debug-only identifier,
  user-provided value, catalog data, or intentionally technical API
  value
- **THEN** the value MAY remain a literal
- **AND** convention checks MAY require an inline allowlist or
  nearby justification if the literal resembles user-visible UI
  copy
