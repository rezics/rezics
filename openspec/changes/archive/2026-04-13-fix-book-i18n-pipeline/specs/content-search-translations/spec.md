## ADDED Requirements

### Requirement: ContentSearchDocument includes structured translations for rendering

ContentSearchDocument SHALL include an optional `translations` field containing an array of objects, each with `language` (string), `title` (string|null), `subtitle` (string|null), `summary` (string|null), and `description` (string|null). This field provides language-keyed translation data for rendering, distinct from the flat `titles[]`/`descriptions[]` arrays used for Meilisearch full-text search.

#### Scenario: Document indexed with multiple translations

- **WHEN** a unit with translations for "zh-CN" (title: "书名") and "en" (title: "Title") is indexed
- **THEN** the ContentSearchDocument SHALL contain `translations: [{ language: "zh-CN", title: "书名", ... }, { language: "en", title: "Title", ... }]`
- **AND** the existing `titles` array SHALL still contain `["书名", "Title"]` for full-text search

#### Scenario: Document indexed with a single translation

- **WHEN** a unit with only a "zh-CN" translation is indexed
- **THEN** the ContentSearchDocument SHALL contain `translations: [{ language: "zh-CN", title: "...", ... }]`

#### Scenario: Document indexed with no translations

- **WHEN** a unit with no translation records is indexed
- **THEN** the ContentSearchDocument `translations` field SHALL be an empty array

### Requirement: Content sync populates structured translations from Prisma relations

The `buildContentDocument()` function SHALL map each Prisma translation relation into the `translations` array, preserving the `language`, `title`, `subtitle`, `summary`, and `description` fields from each `UnitTranslation` record.

#### Scenario: Sync maps all translation fields

- **WHEN** a unit has a translation with `language: "en"`, `title: "My Book"`, `subtitle: "A Story"`, `summary: "Long text"`, `description: "Short text"`
- **THEN** the corresponding entry in `translations` SHALL contain all five fields with their values

#### Scenario: Sync handles nullable fields

- **WHEN** a unit has a translation with `language: "en"`, `title: "My Book"`, `subtitle: null`, `summary: null`, `description: null`
- **THEN** the corresponding entry in `translations` SHALL contain `language: "en"`, `title: "My Book"`, and null values for the remaining fields

### Requirement: Frontend hooks construct DTOs with translations from search results

`useHomeBooks()`, `useHomeShelves()`, and the `BookLibPage` mapping logic SHALL use the `translations` field from `ContentSearchDocument` to populate the `translations` array on the constructed DTO objects, enabling `getBookTitle()` and related helpers to resolve translations correctly.

#### Scenario: Homepage book card renders title in preferred language

- **WHEN** a ContentSearchDocument has `translations: [{ language: "zh-CN", title: "书名" }, { language: "en", title: "Title" }]`
- **AND** the user's fallback chain resolves to "en"
- **THEN** `getBookTitle()` on the mapped DTO SHALL return "Title"

#### Scenario: Search result renders title in preferred language

- **WHEN** a search result ContentSearchDocument has translations for "zh-CN" and "en"
- **AND** the user's preferred language is "zh-CN"
- **THEN** the book card in search results SHALL display the "zh-CN" title

#### Scenario: Graceful fallback when translations field is missing

- **WHEN** a ContentSearchDocument lacks the `translations` field (pre-reindex documents)
- **THEN** the frontend hook SHALL fall back to constructing a single-entry translations array from `titles[0]` and `defaultLanguage`
- **AND** content SHALL still render rather than showing empty strings
