## MODIFIED Requirements

### Requirement: ContentSearchDocument includes structured translations for rendering

ContentSearchDocument SHALL include an optional `translations` field containing an array of objects, each with `language` (string), `title` (string|null), `subtitle` (string|null), `summary` (string|null), and `description` (string|null). The `language` field SHALL contain canonical language codes. This field provides language-keyed translation data for rendering, distinct from the flat `titles[]`/`descriptions[]` arrays used for Meilisearch full-text search.

#### Scenario: Document indexed with multiple translations

- **WHEN** a unit with translations for `"zh-hant"` (title: "書名") and `"en"` (title: "Title") is indexed
- **THEN** the ContentSearchDocument SHALL contain `translations: [{ language: "zh-hant", title: "書名", ... }, { language: "en", title: "Title", ... }]`
- **AND** the existing `titles` array SHALL still contain `["書名", "Title"]` for full-text search

#### Scenario: Document indexed with a single translation

- **WHEN** a unit with only a `"zh-hant"` translation is indexed
- **THEN** the ContentSearchDocument SHALL contain `translations: [{ language: "zh-hant", title: "...", ... }]`

#### Scenario: Document indexed with no translations

- **WHEN** a unit with no translation records is indexed
- **THEN** the ContentSearchDocument `translations` field SHALL be an empty array

### Requirement: Frontend hooks construct DTOs with translations from search results

`useHomeBooks()`, `useHomeShelves()`, and the `BookLibPage` mapping logic SHALL use the `translations` field from `ContentSearchDocument` to populate the `translations` array on the constructed DTO objects, enabling `getBookTitle()` and related helpers to resolve translations correctly.

#### Scenario: Homepage book card renders title in preferred language

- **WHEN** a ContentSearchDocument has `translations: [{ language: "zh-hant", title: "書名" }, { language: "en", title: "Title" }]`
- **AND** the user's fallback chain resolves to "en"
- **THEN** `getBookTitle()` on the mapped DTO SHALL return "Title"

#### Scenario: Search result renders title in preferred language

- **WHEN** a search result ContentSearchDocument has translations for `"zh-hant"` and `"en"`
- **AND** the user's preferred language is `"zh-hant"`
- **THEN** the book card in search results SHALL display the `"zh-hant"` title

#### Scenario: Graceful fallback when translations field is missing

- **WHEN** a ContentSearchDocument lacks the `translations` field (pre-reindex documents)
- **THEN** the frontend hook SHALL fall back to constructing a single-entry translations array from `titles[0]` and `defaultLanguage`
- **AND** content SHALL still render rather than showing empty strings

## ADDED Requirements

### Requirement: Search language filter uses canonical codes

The `defaultLanguage` and `languages` fields in ContentSearchDocument SHALL contain canonical language codes. Search queries filtering by language SHALL use canonical codes.

#### Scenario: Indexed document uses canonical language codes

- **WHEN** a unit with `defaultLanguage: "zh-hant"` and translations in `"zh-hant"` and `"en"` is indexed
- **THEN** the ContentSearchDocument SHALL contain `defaultLanguage: "zh-hant"` and `languages: ["zh-hant", "en"]`
- **AND** no legacy codes (`zh-CN`, `zh-SC`, `en-US`) SHALL appear in the indexed document

#### Scenario: Meilisearch reindex produces canonical codes

- **WHEN** a full reindex is triggered after the language code migration
- **THEN** all ContentSearchDocuments SHALL contain canonical language codes in `defaultLanguage`, `languages`, and `translations[].language` fields
