## ADDED Requirements

### Requirement: TranslationTabs displays available languages on unit detail views

Unit detail views (book, shelf, realm, tag) SHALL render a TranslationTabs component that shows one tab per language present in the unit's `translations[]` array. The currently active language tab SHALL be visually distinguished.

#### Scenario: Unit has multiple translations

- WHEN a unit detail view loads with `translations[]` containing entries for `zh-CN`, `en`, and `ja`
- THEN TranslationTabs SHALL render three language tabs corresponding to those languages
- AND one tab SHALL be marked as active based on the user's preferred language

#### Scenario: Unit has a single translation

- WHEN a unit detail view loads with `translations[]` containing a single entry
- THEN TranslationTabs SHALL render one language tab
- AND that tab SHALL be active by default

### Requirement: Switching language tab re-renders content in the selected translation

WHEN the user selects a different language tab in TranslationTabs, the unit detail view SHALL re-render all translatable content fields (title, description, summary, subtitle) using the translation entry matching the selected language.

#### Scenario: User switches from Chinese to English

- WHEN the user activates the English language tab on a unit that has both `zh-CN` and `en` translations
- THEN the view SHALL display the title, description, summary, and subtitle from the `en` translation entry
- AND the English tab SHALL become the active tab

#### Scenario: User switches to a language and switches back

- WHEN the user switches to a different language tab and then switches back to the original tab
- THEN the view SHALL display the content from the original language's translation entry

### Requirement: TranslationEditor provides per-language translation management in edit forms

Edit forms for translatable units (book, shelf, tag) SHALL include a TranslationEditor component that allows users to manage translations per language. The editor SHALL support adding a new language, editing an existing translation, and designating the primary language.

#### Scenario: Adding a new language translation

- WHEN the user activates the "add language" action in TranslationEditor
- THEN the editor SHALL present a language selector for choosing the new language
- AND upon selection, the editor SHALL display empty fields for the new language's translatable content

#### Scenario: Editing an existing translation

- WHEN the user selects a language tab in TranslationEditor that has an existing translation
- THEN the editor SHALL populate the form fields with that translation's current values
- AND the user SHALL be able to modify and save changes to those fields

#### Scenario: Setting the primary language

- WHEN the user designates a language as the primary language in TranslationEditor
- THEN that language SHALL be marked as the unit's primary/default language
- AND the primary designation SHALL be visually indicated in the editor

### Requirement: WorkReleaseNav displays other releases of the same work on book detail

Book detail pages SHALL render a WorkReleaseNav component that shows other releases (language editions) of the same work, queried by `workUnitId`. The current release SHALL be visually distinguished from the others.

#### Scenario: Book has multiple releases under the same work

- WHEN a book detail page loads for a book whose `workUnitId` references a work with three releases
- THEN WorkReleaseNav SHALL display navigation entries for all three releases
- AND the currently viewed release SHALL be visually marked as active

#### Scenario: Book is a standalone work with no other releases

- WHEN a book detail page loads for a book that is the only release under its `workUnitId`
- THEN WorkReleaseNav SHALL NOT be rendered

### Requirement: Each release in WorkReleaseNav links to its detail page

Every release entry displayed in WorkReleaseNav SHALL be a navigable link to that release's book detail page.

#### Scenario: User navigates to a different release

- WHEN the user activates a release entry in WorkReleaseNav
- THEN the application SHALL navigate to the selected release's book detail page

### Requirement: Tag labels are resolved using the user's preferred language

Tag labels displayed throughout the application SHALL be resolved from the tag unit's `translations[]` using the user's preferred language. Tags are units with their own translations, and the label SHALL reflect the user's language preference.

#### Scenario: Tag has translation matching user's preferred language

- WHEN a tag is displayed and the user's preferred language is `en`
- AND the tag's `translations[]` contains an `en` entry
- THEN the tag label SHALL be the title from the `en` translation entry

#### Scenario: Tag has no translation for user's preferred language

- WHEN a tag is displayed and the user's preferred language is `fr`
- AND the tag's `translations[]` does not contain an `fr` entry
- THEN the tag label SHALL be resolved using the translation fallback chain

### Requirement: Translation helper uses a user-preference-aware fallback chain

The `getTranslation()` helper SHALL resolve translations using a fallback chain that prioritizes the user's preferred languages from `User.settings.preferredLanguages` before falling back to the system default chain. The hardcoded fallback chain SHALL serve only as a last resort after user preferences are exhausted.

#### Scenario: User has preferred languages configured

- WHEN `getTranslation()` is called with no explicit language parameter
- AND the user has `preferredLanguages` set to `['ja', 'en']`
- THEN the helper SHALL attempt `ja` first, then `en`, then the system default chain
- AND SHALL return the first matching translation found

#### Scenario: User has no preferred languages configured

- WHEN `getTranslation()` is called with no explicit language parameter
- AND the user has no `preferredLanguages` setting
- THEN the helper SHALL fall back to the system default chain (`zh-CN`, `zh`, `en`, `ja`)

#### Scenario: Explicit language parameter takes highest priority

- WHEN `getTranslation()` is called with an explicit language parameter
- THEN that language SHALL be attempted first, before user preferences and system defaults

### Requirement: User can configure language preferences in profile settings

The user profile or preferences page SHALL provide a setting for configuring preferred languages. The user SHALL be able to select, order, and remove languages from their preference list.

#### Scenario: User adds a preferred language

- WHEN the user adds a language to their preferred languages list
- THEN that language SHALL appear in the user's language preference list
- AND the preference SHALL take effect for translation resolution across the application

#### Scenario: User reorders preferred languages

- WHEN the user reorders their preferred languages list
- THEN the new order SHALL be reflected in translation resolution priority

#### Scenario: User removes a preferred language

- WHEN the user removes a language from their preferred languages list
- THEN that language SHALL no longer be included in the user's preference-based fallback chain

### Requirement: Language preferences are persisted in User.settings.preferredLanguages

Changes to the user's language preferences SHALL be persisted to `User.settings.preferredLanguages` via the user settings API. The persisted value SHALL be an ordered array of language codes.

#### Scenario: Preference saved to settings

- WHEN the user saves language preferences of `['en', 'zh-CN', 'ja']`
- THEN `User.settings.preferredLanguages` SHALL contain `['en', 'zh-CN', 'ja']` in that order

#### Scenario: Preference survives session restart

- WHEN the user configures preferred languages and later starts a new session
- THEN the application SHALL load `User.settings.preferredLanguages` and apply it to translation resolution

### Requirement: Default language detection from browser locale when no preference is set

WHEN the user has no `preferredLanguages` setting configured and is not authenticated or has not set a preference, the application SHALL detect the user's preferred language from the browser locale and use it as the primary language in the fallback chain.

#### Scenario: Browser locale is used as default

- WHEN the user has no `preferredLanguages` configured
- AND the browser locale is `ja-JP`
- THEN the translation fallback chain SHALL begin with `ja-JP` (and its base language `ja`) before the system default chain

#### Scenario: Authenticated user with preferences overrides browser locale

- WHEN the user has `preferredLanguages` set to `['en']`
- AND the browser locale is `zh-CN`
- THEN the translation fallback chain SHALL begin with `en` per the user's explicit preference, not the browser locale

### Requirement: All unit detail views display content in user's preferred language

All unit detail views -- book, shelf, realm, and tag -- SHALL display translatable content fields using the user's preferred language as resolved by the translation helper. This SHALL apply to titles, descriptions, summaries, and any other fields sourced from `translations[]`.

#### Scenario: Book detail loads in preferred language

- WHEN a user with preferred language `en` opens a book detail page
- AND the book has an `en` translation
- THEN the book title, description, summary, and subtitle SHALL be displayed from the `en` translation

#### Scenario: Shelf detail loads in preferred language

- WHEN a user with preferred language `ja` opens a shelf detail page
- AND the shelf has a `ja` translation
- THEN the shelf title and description SHALL be displayed from the `ja` translation

#### Scenario: Tag detail loads in preferred language

- WHEN a user with preferred language `zh-CN` opens a tag detail page
- AND the tag has a `zh-CN` translation
- THEN the tag name and description SHALL be displayed from the `zh-CN` translation

#### Scenario: Fallback when preferred language is unavailable

- WHEN a user opens any unit detail view
- AND the unit does not have a translation in the user's preferred language
- THEN the view SHALL display content from the next available language in the fallback chain
