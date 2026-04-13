## MODIFIED Requirements

### Requirement: Search endpoint returns ContentSearchResult

The server search endpoint SHALL return a `ContentSearchResult` containing: `items` (array of `ContentSearchDocument`), `total` (total hit count), `processingTimeMs`, and `query` (final query string). Each `ContentSearchDocument` in `items` SHALL include the `translations` array field containing structured language-keyed translation data for rendering.

#### Scenario: Successful search returns structured result

- **GIVEN** the content index contains matching documents
- **WHEN** a search query is executed
- **THEN** the response SHALL include `items` with document data including `translations`, `total` with the matched count, and `processingTimeMs`

#### Scenario: Search result documents include translations

- **WHEN** a search query returns a book with translations in "zh-CN" and "en"
- **THEN** the `ContentSearchDocument` in the result SHALL include `translations: [{ language: "zh-CN", title: "...", ... }, { language: "en", title: "...", ... }]`
