# content-search-contract Specification

## Purpose

Defines shared contract schemas and DTOs for content search documents, search
options, search results, facets, and index metadata consumed by backend and
frontend packages.
## Requirements
### Requirement: ContentSearchDocument type is defined in @rezics/contract

The `@rezics/contract` package SHALL export a `ContentSearchDocument` interface that defines the shape of a document in the Meilisearch content index. This type SHALL be shared across backend (sync, search API) and frontend (result rendering).

The `ContentSearchDocument` schema SHALL include a `rating: ContentRating` field denormalized from the source Unit's `rating`. It SHALL NOT include any `nsfw: boolean` field.

#### Scenario: Backend sync uses ContentSearchDocument

- **GIVEN** the sync function builds a document for Meilisearch
- **WHEN** the document is constructed
- **THEN** it SHALL conform to the `ContentSearchDocument` interface from `@rezics/contract`
- **AND** its `rating` field SHALL match the source Unit's `rating`

#### Scenario: Frontend receives ContentSearchDocument in results

- **GIVEN** a search query returns results
- **WHEN** the frontend processes the response
- **THEN** each item in the results array SHALL conform to `ContentSearchDocument`
- **AND** each item SHALL expose `rating` as one of `GENERAL`, `R_15`, `R_18`, or `R_18G`

#### Scenario: No nsfw field is present

- **WHEN** the `ContentSearchDocument` type is inspected
- **THEN** it SHALL NOT contain a property named `nsfw`

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

### Requirement: Content search documents project game and media metadata

Content search documents for GAME and MEDIA release Units SHALL include typed
metadata needed for filtering and result rendering. At minimum, GAME documents
SHALL expose platform Entity ids, external rating tag ids, release date,
version label, and system-requirement summary fields when available. MEDIA
documents SHALL expose kind key, external rating tag ids, release date, runtime
summary, and content-structure availability fields when available.

#### Scenario: Game document includes platform Entity ids

- **WHEN** a GAME release is indexed
- **THEN** its content search document SHALL include the Entity ids for supported platforms
- **AND** platform filters SHALL NOT depend on legacy string platform keys

#### Scenario: Media document includes kind and rating ids

- **WHEN** a MEDIA release is indexed
- **THEN** its content search document SHALL include `kindKey` and external rating tag ids when available
- **AND** clients SHALL be able to render or filter from those projected fields

### Requirement: Search options support platform Entity and rating tag filters

The content search contract SHALL provide a filter for platform Entity ids and
SHALL route age-rating filtering through the existing tag filter over external
rating tags. Platform filters SHALL be expressed in terms of Unit/Entity ids and
rating filters in terms of rating tag Units, not raw labels or legacy string
keys. No dedicated age-rating Entity filter SHALL be added.

#### Scenario: Filter games by platform Entity

- **WHEN** a client submits a content search with a PlayStation 5 platform Entity id
- **THEN** the request SHALL be valid
- **AND** the server SHALL be able to filter GAME documents by that Entity id

#### Scenario: Filter media by rating tag

- **WHEN** a client submits a content search with the `tv-14` rating tag
- **THEN** the request SHALL be valid
- **AND** the server SHALL be able to filter MEDIA documents by that rating tag through the existing tag filter

### Requirement: Search documents preserve work grouping for game and media

GAME and MEDIA search documents SHALL preserve the work-grouping fields defined
by the work-domain search contract. Grouping SHALL use the canonical
`UnitWork(role = RELEASE)` work id when present, and standalone releases SHALL
group by their own Unit id.

#### Scenario: Same-work game releases group together

- **GIVEN** two GAME releases belong to the same hidden work through `UnitWork`
- **WHEN** both releases are indexed
- **THEN** their search documents SHALL share the same search group id
- **AND** ordinary search result assembly MAY collapse them into one grouped result

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

The `@rezics/contract` package SHALL export a `ZoneFilters` Typebox schema that is a strict subset of `ContentSearchOptions`. It SHALL include the following optional fields: `type` (string or string array), `tags` (SlugRef array), `realmId` (string), `ratings` (ContentRating array), `isLicensed` (boolean), `languages` (string array). `ZoneFilters` SHALL NOT include `keyword`, `sort`, `offset`, `limit`, or `nsfw` — the first four are user-controlled search parameters not appropriate as zone-defined base conditions, and the last has been replaced by `ratings`.

When a request resolves a zone, the final applied rating filter SHALL be the intersection of the zone's `ratings` (if set) and the caller's derived allowed-rating set.

#### Scenario: ZoneFilters accepts valid filter combination

- **WHEN** `{ type: ["BOOK"], tags: [{ slug: "light-novel" }], isLicensed: true, ratings: ["GENERAL", "R_15"] }` is validated against `ZoneFilters`
- **THEN** validation SHALL pass

#### Scenario: ZoneFilters rejects keyword field

- **WHEN** `{ keyword: "test" }` is validated against `ZoneFilters`
- **THEN** validation SHALL fail because `keyword` is not a valid `ZoneFilters` field

#### Scenario: ZoneFilters rejects nsfw field

- **WHEN** `{ nsfw: true }` is validated against `ZoneFilters`
- **THEN** validation SHALL fail because `nsfw` is no longer a valid `ZoneFilters` field

#### Scenario: Zone ratings intersect with caller allowed set

- **GIVEN** a zone with `filters.ratings = ["GENERAL", "R_15", "R_18"]`
- **AND** an unauthenticated caller with allowed set `{GENERAL, R_15}`
- **WHEN** the zone resolution applies its filters
- **THEN** the effective rating filter SHALL be `{GENERAL, R_15}`

### Requirement: ZoneDTO type in contract

The `@rezics/contract` package SHALL export a `ZoneDTO` Typebox schema representing the public-facing zone data. It SHALL include: `slug` (string), `name` (string — resolved translation), `description` (string? — resolved translation), `filters` (ZoneFilters), `template` (string), `styling` (Json?), `startsAt` (string? — ISO datetime), `endsAt` (string? — ISO datetime).

#### Scenario: ZoneDTO is returned by zone resolution endpoint

- **WHEN** a client fetches a zone by slug
- **THEN** the response body SHALL conform to `ZoneDTO`

### Requirement: ContentSearchOptions type is defined in @rezics/contract

The `@rezics/contract` package SHALL export a `ContentSearchOptions` interface that defines the input shape for content search queries. This type SHALL be used by the server search endpoint and the frontend API client. The schema SHALL include a `tags` field of type `SlugRef[]` alongside the existing `tagIds` field. When both `tags` and `tagIds` are present in a request, `tags` SHALL take precedence.

The schema SHALL expose a `ratings?: ContentRating[]` field for set-based rating filtering and SHALL NOT expose any `nsfw?: boolean` field. When `ratings` is absent, the server SHALL apply the caller's derived allowed-rating set (see the `content-rating` capability). When `ratings` is present, the server SHALL intersect the request value with the caller's allowed set and apply the intersection; the server SHALL NOT widen the filter beyond what the caller is permitted to see.

#### Scenario: Server endpoint validates against ContentSearchOptions

- **GIVEN** a search request arrives at the server
- **WHEN** the request body is parsed
- **THEN** it SHALL be validated against the `ContentSearchOptions` schema

#### Scenario: Both tags and tagIds present

- **GIVEN** a search request with `tags: [{ slug: "a" }]` and `tagIds: ["uuid-1"]`
- **WHEN** the server processes the request
- **THEN** it SHALL use the `tags` field and ignore `tagIds`

#### Scenario: Ratings filter intersects with allowed set

- **GIVEN** an unauthenticated caller whose allowed set is `{GENERAL, R_15}`
- **WHEN** the request includes `ratings: ["GENERAL", "R_15", "R_18"]`
- **THEN** the server SHALL apply the filter `{GENERAL, R_15}` (intersection) to the search
- **AND** results SHALL NOT include any Unit with `rating = R_18` or `R_18G`

#### Scenario: Ratings omitted defaults to caller's allowed set

- **GIVEN** an authenticated caller whose derived allowed set is `{GENERAL, R_15, R_18}`
- **WHEN** the request omits `ratings`
- **THEN** the server SHALL apply `{GENERAL, R_15, R_18}` as the rating filter

#### Scenario: No nsfw field is present

- **WHEN** the `ContentSearchOptions` type is inspected
- **THEN** it SHALL NOT contain a property named `nsfw`

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

### Requirement: Alias matches behave as ordinary search text matches
Content search SHALL allow alias-derived fields to match free-text keyword queries. A match through a pinned alias SHALL NOT receive special ranking treatment solely because the alias is pinned.

#### Scenario: Keyword matches alias field
- **GIVEN** a content document has alias-derived searchable value `"3 Body Problem"`
- **WHEN** a user searches keyword `"3 Body"`
- **THEN** the document SHALL be eligible to appear in content search results

#### Scenario: Pinned alias does not force top ranking
- **GIVEN** two documents match a search query
- **AND** one match is through a pinned alias
- **WHEN** the search endpoint returns relevance-ranked results
- **THEN** the pinned alias SHALL NOT force its document ahead of other results solely because the alias is pinned

### Requirement: Content Search Documents Carry Work-Domain Fields

Content search documents for release-aware Units SHALL include work-domain
projection fields: `workUnitId`, `searchGroupId`, `ownTagIds`, `workTagIds`,
`allTagIds`, `ownTagLabels`, `workTagLabels`, `allTagLabels`, `position`, and
`displayPolicy`.

Content search documents for non-release Units that participate in work domains
MAY expose generic work-domain membership fields derived from `UnitWork`, such
as work ids and membership roles, analogous to existing Unit-based tag and realm
fields. These fields SHALL be derived from `UnitWork`, not from shelf/post
special-case projection columns.

`allTagIds` SHALL contain the union of release-local tag ids and inherited
work-level tag ids. `searchGroupId` SHALL equal `workUnitId` when present and
SHALL fall back to the Unit's own id otherwise.

#### Scenario: Release document includes inherited work tags

- **GIVEN** `UnitWork(release-a, work-x)` exists
- **AND** `UnitTag(work-x, tag-fantasy)` exists
- **WHEN** the content search document for `release-a` is built
- **THEN** `workTagIds` SHALL include `tag-fantasy`
- **AND** `allTagIds` SHALL include `tag-fantasy`
- **AND** `searchGroupId` SHALL equal `work-x`

#### Scenario: Standalone document groups by itself

- **GIVEN** Unit `unit-y` has no active `UnitWork` membership
- **WHEN** its content search document is built
- **THEN** `workUnitId` SHALL be null
- **AND** `searchGroupId` SHALL equal `unit-y`

### Requirement: Search Options Support Grouped Release Presentation

The content search contract SHALL expose options that allow callers to request
the default grouped release presentation or expanded release rows. Grouped
presentation SHALL be the default for ordinary content search.

#### Scenario: Default grouped search

- **WHEN** a caller sends a content search request without an explicit release expansion option
- **THEN** the response SHALL be allowed to collapse multiple releases with the same `searchGroupId`
- **AND** each grouped result SHALL expose enough metadata for the frontend to show collapsed alternatives

#### Scenario: Expanded release search

- **WHEN** a caller explicitly requests expanded release results
- **THEN** the response SHALL be allowed to return multiple release documents for the same `searchGroupId`
- **AND** each result SHALL still include its `workUnitId` and `searchGroupId`

### Requirement: Search Metadata Uses Canonical Work After Merge

Content search documents for release-aware Units SHALL use merge-resolved
canonical work ids for `workUnitId` and `searchGroupId` after work merge repair
has completed. During async merge repair, search MAY be temporarily stale, but
repair jobs SHALL converge documents to the target canonical work.

#### Scenario: Merged work groups under target

- **GIVEN** source work `work-old` has been merged into target work `work-new`
- **AND** release `release-a` was formerly grouped under `work-old`
- **WHEN** the content search document for `release-a` is rebuilt
- **THEN** `workUnitId` SHALL equal `work-new`
- **AND** `searchGroupId` SHALL equal `work-new`
