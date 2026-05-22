## MODIFIED Requirements

### Requirement: Homepage sections use i18n for all UI strings

All homepage section components SHALL use generated Paraglide product/domain message functions for UI strings. No section component SHALL contain hardcoded Chinese or English display text. Section titles, action labels ("More"), loading states, empty states, and tab labels SHALL be resolved from locale message functions.

#### Scenario: NewBookSection renders in user's UI language

- **WHEN** the homepage loads with UI language set to "en"
- **THEN** NewBookSection SHALL display "Latest Works" (not "最新作品"), tab labels "Latest Serial" / "New on Shelf" / "Recently Completed", and "More" (not "更多 →")

#### Scenario: TrendingBookSection renders in user's UI language

- **WHEN** the homepage loads with UI language set to "en"
- **THEN** TrendingBookSection SHALL display "Trending Books" (not "趋势好书") and "More" (not "更多 →")

#### Scenario: ActiveRealmsSection renders in user's UI language

- **WHEN** the homepage loads with UI language set to "zh-hant"
- **THEN** ActiveRealmsSection SHALL display the Chinese translation for "Active Realms" and "More"

#### Scenario: LibraryCardsSection renders in user's UI language

- **WHEN** the homepage loads with UI language set to "ja"
- **THEN** LibraryCardsSection SHALL display Japanese translations for "Book Library", "Game Library", "Media Library", and "Coming Soon"

### Requirement: Search components use i18n for all UI strings

SearchFilter and SearchInput components SHALL use generated Paraglide product/domain message functions for all sort labels, filter labels, placeholder text, and preset tag labels. No search component SHALL contain hardcoded Chinese or English display text.

#### Scenario: SearchFilter renders sort options in user's UI language

- **WHEN** the search page loads with UI language set to "en"
- **THEN** sort options SHALL display "Relevance", "Latest", "Total Favorites", "Word Count", "Monthly Votes" (not Chinese equivalents)
- **AND** order buttons SHALL display "Descending" / "Ascending" (not "降序" / "升序")

#### Scenario: SearchInput renders placeholder in user's UI language

- **WHEN** the search page loads with UI language set to "zh-hant"
- **THEN** the search placeholder SHALL display the Chinese translation for "Title, ISBN, Author, Publisher, Producer"
- **AND** filter labels ("Tags", "Word Count") SHALL display in Chinese

### Requirement: All five locale files contain keys for homepage and search strings

Translation keys for homepage sections and search components SHALL exist in all five JSON locale message files for `en`, `zh-hant`, `zh-hans`, `de`, and `ja`. Missing native translations SHALL use English as a placeholder.

#### Scenario: en locale has complete homepage section keys

- **WHEN** the `en` locale message file is loaded
- **THEN** it SHALL contain keys for all homepage section titles, action labels, tab labels, loading states, and empty states

#### Scenario: zh-hant locale has complete homepage section keys

- **WHEN** the `zh-hant` locale message file is loaded
- **THEN** it SHALL contain keys matching the same key structure as `en` with Traditional Chinese translations

### Requirement: Homepage book content renders in user's preferred content language

Book titles and descriptions displayed in homepage sections (NewBookSection, TrendingBookSection) SHALL be resolved using the `getBookTitle()` and `getBookDescription()` translation helpers, which apply the user's preferred language fallback chain. Content SHALL NOT display as empty strings.

#### Scenario: Book title renders from search result translations

- **WHEN** a homepage book card receives a DTO with `translations: [{ language: "zh-hant", title: "書名" }, { language: "en", title: "Title" }]`
- **AND** the user's fallback chain resolves to "en"
- **THEN** the book card SHALL display "Title"

#### Scenario: Book title falls back when preferred language unavailable

- **WHEN** a homepage book card receives a DTO with `translations: [{ language: "zh-hant", title: "書名" }]`
- **AND** the user's preferred language is "de"
- **THEN** the book card SHALL fall back to `en` (not found), then to first available, and display "書名" rather than an empty string

### Requirement: i18n resource keys use canonical language codes

The Paraglide project configuration SHALL use canonical language codes (`zh-hant`, `zh-hans`, `en`, `ja`, `de`) as locale identifiers. Locale source files SHALL be named using canonical codes where file names include locale codes.

#### Scenario: i18n resources registered with canonical keys

- **WHEN** the Paraglide i18n runtime initializes
- **THEN** locale identifiers SHALL be `'zh-hant'`, `'zh-hans'`, `'en'`, `'ja'`, `'de'`
- **AND** no locale identifier SHALL use legacy codes (`zh-SC`, `zh-TC`, `en-US`, `ja-JP`, `de-DE`)

#### Scenario: Default language is zh-hant

- **WHEN** the i18n runtime initializes without a persisted language preference
- **THEN** the active language SHALL be `'zh-hant'`

#### Scenario: Fallback language is en

- **WHEN** a translation key is missing in the active locale
- **THEN** the system SHALL fall back to the `'en'` locale

### Requirement: Language toggle uses canonical codes

The LangToggle component SHALL use canonical language codes when requesting a language change. Display labels SHALL use native language names from `LANGUAGE_META`.

#### Scenario: User switches to Traditional Chinese

- **WHEN** the user selects Traditional Chinese from the language toggle
- **THEN** the app/admin locale synchronization helper SHALL be called with `'zh-hant'`
- **AND** the menu item SHALL display "繁體中文"

#### Scenario: User switches to English

- **WHEN** the user selects English from the language toggle
- **THEN** the app/admin locale synchronization helper SHALL be called with `'en'`
