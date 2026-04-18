## ADDED Requirements

### Requirement: ContentSearchDocument type is defined in @rezics/contract

The `@rezics/contract` package SHALL export a `ContentSearchDocument` interface that defines the shape of a document in the Meilisearch content index. This type SHALL be shared across backend (sync, search API) and frontend (result rendering).

#### Scenario: Backend sync uses ContentSearchDocument

- **GIVEN** the sync function builds a document for Meilisearch
- **WHEN** the document is constructed
- **THEN** it SHALL conform to the `ContentSearchDocument` interface from `@rezics/contract`

#### Scenario: Frontend receives ContentSearchDocument in results

- **GIVEN** a search query returns results
- **WHEN** the frontend processes the response
- **THEN** each item in the results array SHALL conform to `ContentSearchDocument`

### Requirement: ContentSearchOptions type is defined in @rezics/contract

The `@rezics/contract` package SHALL export a `ContentSearchOptions` interface that defines the input shape for content search queries. This type SHALL be used by the server search endpoint and the frontend API client.

#### Scenario: Server endpoint validates against ContentSearchOptions

- **GIVEN** a search request arrives at the server
- **WHEN** the request body is parsed
- **THEN** it SHALL be validated against the `ContentSearchOptions` schema

### Requirement: ContentSearchResult type is defined in @rezics/contract

The `@rezics/contract` package SHALL export a `ContentSearchResult` interface with fields: `items` (array of `ContentSearchDocument`), `total` (number), `processingTimeMs` (number), and `query` (string).

#### Scenario: Search result conforms to ContentSearchResult

- **GIVEN** a successful search query
- **WHEN** the server returns the response
- **THEN** it SHALL conform to `ContentSearchResult` with all required fields present

### Requirement: Old search types are removed

The following types SHALL be removed from `@rezics/contract`: `BookSearchDocument`, `BookSearchResult`, `BookQueryOptions`, `UnitSearchDocument`, `UnitSearchResult`, `UnitListQuery`, `ReadlistSearchDocument`, `ReadlistSearchResult`, `ReadlistListQuery`, and `toBookQueryString`.

#### Scenario: Old book search types no longer exported

- **GIVEN** the contract package is updated
- **WHEN** a consumer attempts to import `BookSearchDocument` from `@rezics/contract`
- **THEN** the import SHALL fail (type no longer exists)

### Requirement: Contract types use Typebox schemas

All new search contract types (`ContentSearchDocument`, `ContentSearchOptions`, `ContentSearchResult`) SHALL be defined as Typebox schemas, consistent with the existing contract-first pattern in `@rezics/contract`.

#### Scenario: ContentSearchOptions has Typebox schema

- **GIVEN** the contract defines `ContentSearchOptions`
- **WHEN** it is imported
- **THEN** it SHALL be a Typebox schema usable for both TypeScript type inference and runtime validation

### Requirement: Search result total count
Meilisearch search service functions SHALL use `estimatedTotalHits` (from `InfinitePagination`) instead of `totalHits` (from `FinitePagination`) when the search call uses `offset`/`limit` parameters.

The fallback chain `resp.totalHits ?? resp.estimatedTotalHits ?? resp.hits.length` SHALL be replaced with `resp.estimatedTotalHits ?? resp.hits.length`.

Affected files:
- `package/server/src/meili/content/content.service.ts`
- `package/server/src/meili/post/post.service.ts`
- `package/server/src/meili/realm/realm.service.ts`
- `package/server/src/meili/user/user.api.ts`

#### Scenario: Content search returns total from estimatedTotalHits
- **WHEN** a content search is performed with `offset: 0, limit: 20`
- **THEN** the returned `total` field is sourced from `resp.estimatedTotalHits`
- **AND** `tsc --noEmit` produces zero errors about `totalHits` not existing on the response type

#### Scenario: Fallback to hits length when estimatedTotalHits is missing
- **WHEN** the Meilisearch response does not include `estimatedTotalHits`
- **THEN** the returned `total` falls back to `resp.hits.length`

## ADDED Requirements

### Requirement: ContentSearchOptions supports SlugRef tags

The `ContentSearchOptions` schema SHALL add a `tags` field of type `SlugRef[]` (array of `{ slug: string; unitId?: string }` objects). Each entry represents an independent tag filter. The backend SHALL resolve each `SlugRef` independently — using `unitId` directly when present, falling back to slug lookup otherwise.

#### Scenario: Search with SlugRef tags containing unitId

- **WHEN** a search request includes `tags: [{ slug: "light-novel", unitId: "uuid-1" }]`
- **THEN** the backend SHALL use `unitId: "uuid-1"` directly in the MeiliSearch filter
- **AND** SHALL NOT perform a slug lookup

#### Scenario: Search with SlugRef tags containing slug only

- **WHEN** a search request includes `tags: [{ slug: "light-novel" }]`
- **THEN** the backend SHALL resolve `slug: "light-novel"` to its `unitId` via database lookup
- **AND** use the resolved `unitId` in the MeiliSearch filter

#### Scenario: Search with mixed SlugRef entries

- **WHEN** a search request includes `tags: [{ slug: "a", unitId: "uuid-1" }, { slug: "b" }]`
- **THEN** the backend SHALL use `uuid-1` directly for the first tag and resolve `"b"` by slug for the second

### Requirement: ZoneFilters type in contract

The `@rezics/contract` package SHALL export a `ZoneFilters` Typebox schema that is a strict subset of `ContentSearchOptions`. It SHALL include the following optional fields: `type` (string or string array), `tags` (SlugRef array), `realmId` (string), `nsfw` (boolean), `isLicensed` (boolean), `languages` (string array). `ZoneFilters` SHALL NOT include `keyword`, `sort`, `offset`, or `limit` — those are user-controlled search parameters, not zone-defined base conditions.

#### Scenario: ZoneFilters accepts valid filter combination

- **WHEN** `{ type: ["BOOK"], tags: [{ slug: "light-novel" }], isLicensed: true }` is validated against `ZoneFilters`
- **THEN** validation SHALL pass

#### Scenario: ZoneFilters rejects keyword field

- **WHEN** `{ keyword: "test" }` is validated against `ZoneFilters`
- **THEN** validation SHALL fail because `keyword` is not a valid `ZoneFilters` field

### Requirement: ZoneDTO type in contract

The `@rezics/contract` package SHALL export a `ZoneDTO` Typebox schema representing the public-facing zone data. It SHALL include: `slug` (string), `name` (string — resolved translation), `description` (string? — resolved translation), `filters` (ZoneFilters), `template` (string), `styling` (Json?), `startsAt` (string? — ISO datetime), `endsAt` (string? — ISO datetime).

#### Scenario: ZoneDTO is returned by zone resolution endpoint

- **WHEN** a client fetches a zone by slug
- **THEN** the response body SHALL conform to `ZoneDTO`

## MODIFIED Requirements

### Requirement: ContentSearchOptions type is defined in @rezics/contract

The `@rezics/contract` package SHALL export a `ContentSearchOptions` interface that defines the input shape for content search queries. This type SHALL be used by the server search endpoint and the frontend API client. The schema SHALL include a `tags` field of type `SlugRef[]` alongside the existing `tagIds` field. When both `tags` and `tagIds` are present in a request, `tags` SHALL take precedence.

#### Scenario: Server endpoint validates against ContentSearchOptions

- **GIVEN** a search request arrives at the server
- **WHEN** the request body is parsed
- **THEN** it SHALL be validated against the `ContentSearchOptions` schema

#### Scenario: Both tags and tagIds present

- **GIVEN** a search request with `tags: [{ slug: "a" }]` and `tagIds: ["uuid-1"]`
- **WHEN** the server processes the request
- **THEN** it SHALL use the `tags` field and ignore `tagIds`

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
