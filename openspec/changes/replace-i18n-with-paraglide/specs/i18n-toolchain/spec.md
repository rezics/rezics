## ADDED Requirements

### Requirement: Paraglide message generation

Frontend i18n packages SHALL compile JSON message source files with Paraglide JS and SHALL expose generated message functions and runtime helpers through package exports.

#### Scenario: Product i18n package exposes generated messages

- **WHEN** a frontend consumer imports product/domain translations
- **THEN** the consumer SHALL import generated Paraglide message functions from the shared product/domain i18n package
- **AND** the consumer SHALL NOT call `react-i18next` `useTranslation()` for product/domain UI copy

#### Scenario: UI package exposes generated messages

- **WHEN** a reusable `@rezics/ui` component needs component-internal text
- **THEN** it SHALL read that text from generated Paraglide message functions owned by `@rezics/ui`

### Requirement: Translation source files use JSON

Frontend translation source files SHALL use Paraglide/Inlang-compatible JSON files. JSON5, JSONC, YAML, and custom translation file format plugins SHALL NOT be introduced by this change.

#### Scenario: Translation source file extension

- **WHEN** translation source files are added for product/domain or UI component messages
- **THEN** the files SHALL use the `.json` extension
- **AND** they SHALL be readable by the configured official Paraglide/Inlang JSON message plugin path

### Requirement: App and admin share product/domain messages

The app and admin frontends SHALL consume one shared product/domain i18n package for feature copy, product labels, and domain labels that are common across Rezics frontends.

#### Scenario: Shared product label appears in app and admin

- **WHEN** app and admin both render the same product/domain label
- **THEN** both frontends SHALL resolve the label from the shared product/domain i18n package
- **AND** neither frontend SHALL keep a duplicate local translation key for that shared label

### Requirement: Active locale is shell-owned

The app/admin shell SHALL be the single owner of the active locale state. Package-local i18n runtimes SHALL receive the active locale from the shell and SHALL NOT independently infer locale from URL, cookies, localStorage, or browser language.

#### Scenario: User changes language

- **WHEN** the user selects a supported language in an app/admin language control
- **THEN** the shell SHALL update the active locale
- **AND** the shell SHALL synchronize that locale into both the product/domain i18n runtime and the UI i18n runtime

#### Scenario: UI component renders after language change

- **WHEN** the shell active locale changes from `zh-hant` to `en`
- **THEN** a translated `@rezics/ui` component SHALL render its UI-owned text in English
- **AND** app/admin product text SHALL render from the same active locale

### Requirement: Canonical locale behavior is preserved

The Paraglide migration SHALL preserve the existing canonical locale set and language defaults: supported locales are `zh-hant`, `zh-hans`, `en`, `ja`, and `de`; the default locale is `zh-hant`; the fallback locale is `en`.

#### Scenario: Default locale

- **WHEN** a frontend shell initializes without a persisted language preference
- **THEN** the active locale SHALL be `zh-hant`

#### Scenario: Fallback locale

- **WHEN** a message is missing in the active locale
- **THEN** the system SHALL resolve the message from `en` where Paraglide fallback behavior applies

### Requirement: React-i18next is removed from frontend runtime usage

Frontend packages SHALL NOT use `react-i18next` or `i18next` as the runtime API after the Paraglide migration completes.

#### Scenario: Runtime translation callsites

- **WHEN** frontend source under `package/{app,admin,ui,editor,folio}/src/` is inspected
- **THEN** there SHALL be no imports from `react-i18next`
- **AND** there SHALL be no new `i18next` runtime initialization for frontend UI copy

### Requirement: Generated files are not edited manually

Paraglide generated output SHALL be treated as generated code. Developers SHALL edit JSON source messages and Paraglide configuration, not generated message or runtime files.

#### Scenario: Translation update

- **WHEN** a developer changes a user-visible translation
- **THEN** the change SHALL be made in the relevant JSON source message file
- **AND** generated Paraglide output SHALL be refreshed through the configured compile command or bundler plugin
*** Add File: /home/edge/projects/rezics/rezics/openspec/changes/replace-i18n-with-paraglide/specs/multilingual-ui/spec.md
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
*** Add File: /home/edge/projects/rezics/rezics/openspec/changes/replace-i18n-with-paraglide/specs/ui-component-foundation/spec.md
## ADDED Requirements

### Requirement: Reusable UI components own only generic component messages

Reusable components in `@rezics/ui` SHALL own translations only for generic component-internal text such as ARIA labels, button labels, placeholder text, empty states, and control labels that are intrinsic to the reusable component. `@rezics/ui` SHALL NOT own product, domain, feature, or contract-derived message text.

#### Scenario: Password field uses UI-owned messages

- **WHEN** a reusable password field component renders its visibility toggle
- **THEN** the show/hide accessible labels SHALL resolve from the `@rezics/ui` message catalog
- **AND** the component SHALL NOT import app/admin product message functions for those labels

#### Scenario: Domain label is excluded from UI catalog

- **WHEN** a component needs the display label for a content rating, attribution role, book type, or other Rezics domain concept
- **THEN** that label SHALL resolve from the product/domain i18n package or a domain adapter outside the portable UI component surface
- **AND** the reusable UI component SHALL NOT add that label to the `@rezics/ui` message catalog

### Requirement: UI package i18n follows host locale

`@rezics/ui` translated components SHALL render using the active locale supplied by the host shell. `@rezics/ui` SHALL expose a runtime helper or package export that lets the host synchronize the UI locale.

#### Scenario: Host synchronizes UI locale

- **WHEN** an app/admin shell changes the active locale to `ja`
- **THEN** the shell SHALL update the `@rezics/ui` i18n runtime to `ja`
- **AND** subsequently rendered UI-owned component text SHALL use Japanese messages

### Requirement: UI package does not use react-i18next

Reusable source files under `package/ui/src/` SHALL NOT import `react-i18next` or call `useTranslation()` after the Paraglide migration. UI-owned messages SHALL be accessed through generated Paraglide message functions.

#### Scenario: UI source imports are inspected

- **WHEN** imports under `package/ui/src/` are inspected
- **THEN** no reusable component source file SHALL import from `react-i18next`
- **AND** no reusable component source file SHALL call `useTranslation()`

### Requirement: UI package provides override escape hatches

Reusable UI components with built-in translated text SHALL allow consumers to override labels when the generic UI-owned copy is not appropriate for a specific product context.

#### Scenario: Consumer overrides UI label

- **WHEN** a consumer passes an explicit label or labels object to a reusable UI component
- **THEN** the component SHALL render the explicit consumer-provided text
- **AND** the component SHALL use its UI-owned Paraglide message only for omitted labels
