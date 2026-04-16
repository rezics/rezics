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
