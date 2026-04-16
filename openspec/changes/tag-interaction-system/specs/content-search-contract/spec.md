## MODIFIED Requirements

### Requirement: BookDTO does not embed tag display data

`BookDTO` SHALL NOT contain a `tags` field with embedded tag labels or scores. Tag display data for a book is fetched independently via `tagQueries.list({ unitId })` (scored junction data) and the batch translation query (multilingual labels). The `scoredTagBriefSchema` type SHALL be removed from `@rezics/contract`.

#### Scenario: BookDTO has no tags field

- **GIVEN** the `BookDTO` type definition in `@rezics/contract`
- **WHEN** a consumer reads the type
- **THEN** it SHALL NOT contain a `tags` field
- **AND** `scoredTagBriefSchema` SHALL NOT exist in the contract package

#### Scenario: Book detail API response has no tags

- **GIVEN** a book with 10 associated tags
- **WHEN** the client calls `GET /api/books/:id`
- **THEN** the response SHALL NOT include a `tags` array
- **AND** the client SHALL use `tagQueries.list({ unitId: bookId })` to fetch tag data separately

#### Scenario: Migration from BookDTO.tags to independent queries

- **GIVEN** existing code that reads `bookInfo.tags` or calls `getBookTagLabels()`
- **WHEN** the migration is applied
- **THEN** all call sites SHALL be replaced with `tagQueries.list({ unitId })` + `tagQueries.batchTranslations(tagUnitIds, lang)`
- **AND** `getBookTagLabels()` SHALL be removed from `translation-helpers.ts`
