## ADDED Requirements

### Requirement: Homepage sections use i18n for all UI strings

All homepage section components SHALL use `react-i18next` `useTranslation()` for UI strings. No section component SHALL contain hardcoded Chinese or English display text. Section titles, action labels ("More"), loading states, empty states, and tab labels SHALL be resolved from locale translation keys.

#### Scenario: NewBookSection renders in user's UI language

- **WHEN** the homepage loads with UI language set to "en-US"
- **THEN** NewBookSection SHALL display "Latest Works" (not "最新作品"), tab labels "Latest Serial" / "New on Shelf" / "Recently Completed", and "More" (not "更多 →")

#### Scenario: TrendingBookSection renders in user's UI language

- **WHEN** the homepage loads with UI language set to "en-US"
- **THEN** TrendingBookSection SHALL display "Trending Books" (not "趋势好书") and "More" (not "更多 →")

#### Scenario: ActiveRealmsSection renders in user's UI language

- **WHEN** the homepage loads with UI language set to "zh-SC"
- **THEN** ActiveRealmsSection SHALL display the Chinese translation for "Active Realms" and "More"

#### Scenario: LibraryCardsSection renders in user's UI language

- **WHEN** the homepage loads with UI language set to "ja-JP"
- **THEN** LibraryCardsSection SHALL display Japanese translations for "Book Library", "Game Library", "Media Library", and "Coming Soon"

### Requirement: Search components use i18n for all UI strings

SearchFilter and SearchInput components SHALL use `react-i18next` for all sort labels, filter labels, placeholder text, and preset tag labels. No search component SHALL contain hardcoded Chinese or English display text.

#### Scenario: SearchFilter renders sort options in user's UI language

- **WHEN** the search page loads with UI language set to "en-US"
- **THEN** sort options SHALL display "Relevance", "Latest", "Total Favorites", "Word Count", "Monthly Votes" (not Chinese equivalents)
- **AND** order buttons SHALL display "Descending" / "Ascending" (not "降序" / "升序")

#### Scenario: SearchInput renders placeholder in user's UI language

- **WHEN** the search page loads with UI language set to "zh-SC"
- **THEN** the search placeholder SHALL display the Chinese translation for "Title, ISBN, Author, Publisher, Producer"
- **AND** filter labels ("Tags", "Word Count") SHALL display in Chinese

### Requirement: All five locale files contain keys for homepage and search strings

Translation keys for homepage sections and search components SHALL exist in all five locale files: en-US, zh-SC, zh-TC, de-DE, and ja-JP. Missing native translations SHALL use English as a placeholder.

#### Scenario: en-US locale has complete homepage section keys

- **WHEN** the en-US locale file is loaded
- **THEN** it SHALL contain keys under `page.home.section` for all section titles, action labels, tab labels, loading states, and empty states

#### Scenario: zh-SC locale has complete homepage section keys

- **WHEN** the zh-SC locale file is loaded
- **THEN** it SHALL contain keys under `page.home.section` matching the same key structure as en-US with Chinese translations

### Requirement: Homepage book content renders in user's preferred content language

Book titles and descriptions displayed in homepage sections (NewBookSection, TrendingBookSection) SHALL be resolved using the `getBookTitle()` and `getBookDescription()` translation helpers, which apply the user's preferred language fallback chain. Content SHALL NOT display as empty strings.

#### Scenario: Book title renders from search result translations

- **WHEN** a homepage book card receives a DTO with `translations: [{ language: "zh-CN", title: "书名" }, { language: "en", title: "Title" }]`
- **AND** the user's fallback chain resolves to "en"
- **THEN** the book card SHALL display "Title"

#### Scenario: Book title falls back when preferred language unavailable

- **WHEN** a homepage book card receives a DTO with `translations: [{ language: "zh-CN", title: "书名" }]`
- **AND** the user's preferred language is "de"
- **THEN** the book card SHALL fall back through the chain and display "书名" rather than an empty string
