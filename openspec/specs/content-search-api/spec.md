## ADDED Requirements

### Requirement: Server mediates all content search queries

All content search queries SHALL be routed through a server API endpoint. The frontend SHALL NOT query Meilisearch directly. The `getSearchKey()` pattern (issuing Meilisearch API keys to the frontend) SHALL be removed from the content search flow.

#### Scenario: Frontend calls server search endpoint

- **GIVEN** a user performs a search from the frontend
- **WHEN** the search request is sent
- **THEN** it SHALL be directed to the server's content search endpoint, not directly to Meilisearch

### Requirement: Search endpoint accepts typed ContentSearchOptions

The server SHALL expose a content search endpoint that accepts `ContentSearchOptions` with the following fields: `keyword` (free text), `type` (UnitType filter), `tagIds` (global tag UUIDs), `realmId` (realm UUID), `realmTagIds` (tag UUIDs scoped to the specified realm), `languages` (language codes), `ratings` (ContentRating array), `isLicensed` (boolean), `sort` (field + order), `offset`, and `limit`.

#### Scenario: Search with keyword only

- **WHEN** the endpoint receives `{ keyword: "fantasy" }`
- **THEN** it SHALL query the content index with "fantasy" as the search text
- **AND** apply default filters including the caller's allowed `rating IN [...]` set

#### Scenario: Search with realm and scoped tags

- **WHEN** the endpoint receives `{ realmId: "realm-uuid", realmTagIds: ["tag-uuid-1", "tag-uuid-2"] }`
- **THEN** it SHALL build Meilisearch filter expressions: `realmTagKeys = "realm-uuid:tag-uuid-1" OR realmTagKeys = "realm-uuid:tag-uuid-2"`

#### Scenario: Search with type filter

- **WHEN** the endpoint receives `{ keyword: "zelda", type: "GAME" }`
- **THEN** it SHALL query the content index with filter `type = "GAME"`

#### Scenario: Search with global tag filter

- **WHEN** the endpoint receives `{ tagIds: ["tag-uuid-1"] }`
- **THEN** it SHALL build filter `tagIds = "tag-uuid-1"`

#### Scenario: Search with language filter

- **WHEN** the endpoint receives `{ keyword: "test", languages: ["zh"] }`
- **THEN** it SHALL build filter `languages = "zh"`

### Requirement: Search endpoint returns ContentSearchResult

The server search endpoint SHALL return a `ContentSearchResult` containing: `items` (array of `ContentSearchDocument`), `total` (total hit count), `processingTimeMs`, and `query` (final query string). Each `ContentSearchDocument` in `items` SHALL include the `translations` array field containing structured language-keyed translation data for rendering.

#### Scenario: Successful search returns structured result

- **GIVEN** the content index contains matching documents
- **WHEN** a search query is executed
- **THEN** the response SHALL include `items` with document data including `translations`, `total` with the matched count, and `processingTimeMs`

#### Scenario: Search result documents include translations

- **WHEN** a search query returns a book with translations in "zh-CN" and "en"
- **THEN** the `ContentSearchDocument` in the result SHALL include `translations: [{ language: "zh-CN", title: "...", ... }, { language: "en", title: "...", ... }]`

### Requirement: Default rating filter excludes disallowed content

When `ratings` is not specified, the server SHALL automatically add a `rating IN [...]` Meilisearch filter derived from the caller's allowed rating set. When `ratings` is specified, the server SHALL intersect the requested set with the caller's allowed set before querying Meilisearch.

#### Scenario: Default search filters to allowed ratings

- **WHEN** a search is performed without specifying `ratings`
- **THEN** the filter SHALL include the caller's allowed `rating IN [...]` set
- **AND** no documents outside that allowed set SHALL appear in results

#### Scenario: Explicit ratings are intersected with allowed ratings

- **WHEN** a search is performed with `{ ratings: ["GENERAL", "R_18"] }`
- **THEN** the filter SHALL include only ratings that are also allowed for the caller
- **AND** SHALL NOT widen the result set beyond the caller's allowed ratings

### Requirement: Sort defaults to relevance with temporal fallback

When no sort is specified, Meilisearch's default relevance ranking SHALL be used. When a sort field is specified, the server SHALL map it to the corresponding Meilisearch sort expression. The default sort order for temporal fields SHALL be descending.

#### Scenario: Default sort is relevance

- **WHEN** a search is performed without specifying sort
- **THEN** results SHALL be ordered by Meilisearch's default relevance ranking

#### Scenario: Explicit sort by createdAt

- **WHEN** a search is performed with `{ sort: { field: "createdAt", order: "desc" } }`
- **THEN** results SHALL be sorted by `createdAt:desc`

### Requirement: Post search endpoint accepts PostSearchOptions
The server SHALL expose `POST /meili/posts/search` that accepts `PostSearchOptions` with fields: `keyword` (free text), `kind` (PostKind filter), `targetUnitId`, `realmUnitId`, `authorUserId`, `rootPostUnitId`, `parentPostUnitId`, `depth` (integer), `isLocked` (boolean), `sort` (field + order), `offset`, and `limit`.

#### Scenario: Search posts by keyword
- **WHEN** the endpoint receives `{ keyword: "amazing story" }`
- **THEN** it SHALL query the posts index with "amazing story" as search text

#### Scenario: Search reviews for a specific book
- **WHEN** the endpoint receives `{ kind: "REVIEW", targetUnitId: "book-uuid" }`
- **THEN** it SHALL query the posts index with filter `kind = "REVIEW" AND targetUnitId = "book-uuid"`

#### Scenario: Search remarks in a realm
- **WHEN** the endpoint receives `{ kind: "REMARK", realmUnitId: "realm-uuid" }`
- **THEN** it SHALL query the posts index with filter `kind = "REMARK" AND realmUnitId = "realm-uuid"`

#### Scenario: Search top-level threads only
- **WHEN** the endpoint receives `{ kind: "POST", depth: 0 }`
- **THEN** it SHALL query the posts index with filter `kind = "POST" AND depth = 0`

### Requirement: Post search endpoint returns PostSearchResult
The post search endpoint SHALL return `PostSearchResult` containing: `items` (array of post search documents), `total` (total hit count), `processingTimeMs`, and `query`. Each item SHALL contain all fields from the post document schema (sufficient for list rendering).

#### Scenario: Successful post search
- **GIVEN** the posts index contains matching documents
- **WHEN** a post search query is executed
- **THEN** the response SHALL include `items` with post documents, `total`, and `processingTimeMs`

### Requirement: Realm search endpoint accepts RealmSearchOptions
The server SHALL expose `POST /meili/realms/search` that accepts `RealmSearchOptions` with fields: `keyword` (free text), `isPublic` (boolean), `isOfficial` (boolean), `sort` (field + order), `offset`, and `limit`.

#### Scenario: Search realms by keyword
- **WHEN** the endpoint receives `{ keyword: "fantasy" }`
- **THEN** it SHALL query the realms index with "fantasy" as search text

#### Scenario: List public realms
- **WHEN** the endpoint receives `{ isPublic: true }`
- **THEN** it SHALL query the realms index with filter `isPublic = true`

#### Scenario: List official realms sorted by member count
- **WHEN** the endpoint receives `{ isOfficial: true, sort: { field: "memberCount", order: "desc" } }`
- **THEN** it SHALL query the realms index with filter `isOfficial = true` sorted by `memberCount:desc`

### Requirement: Realm search endpoint returns RealmSearchResult
The realm search endpoint SHALL return `RealmSearchResult` containing: `items` (array of realm search documents), `total`, `processingTimeMs`, and `query`. Each item SHALL include `translations` array for multilingual display rendering.

#### Scenario: Successful realm search with translations
- **GIVEN** the realms index contains a realm with translations in "en" and "zh-hant"
- **WHEN** a realm search query is executed
- **THEN** each result item SHALL include the full `translations` array

### Requirement: Federated endpoint orchestrates per-index endpoints

The federated search endpoint defined by `federated-search` SHALL reuse the filter-construction logic of the existing per-index endpoints (`POST /meili/posts/search`, `POST /meili/realms/search`, content search) rather than duplicate it. The shared filter builders SHALL be exported from each domain service module (e.g., `buildContentFilter`, `buildPostFilter`, `buildRealmFilter`) and SHALL be the single source of truth for "how a `SearchQuery` and a scope translate into a Meilisearch filter expression."

#### Scenario: Single-category federated query reuses single-index filter logic

- **GIVEN** a federated request with `category: "books"` and `scope: { kind: "global" }`
- **WHEN** the orchestrator builds the content sub-query
- **THEN** it SHALL call `buildContentFilter(query, scope)` from the content service
- **AND** SHALL produce the same filter expression that `POST /meili/contents/search` would produce for the same `query`

#### Scenario: Filter-builder change propagates to both paths

- **GIVEN** a regression fix to `buildPostFilter` (e.g., correcting how `isLocked` is included)
- **WHEN** the fix is deployed
- **THEN** both the legacy `POST /meili/posts/search` endpoint and the federated endpoint's post sub-queries SHALL reflect the fix
- **AND** no duplicate change to the federated path SHALL be required

### Requirement: Per-index endpoints remain stable

The existing endpoints `POST /meili/contents/search`, `POST /meili/posts/search`, and `POST /meili/realms/search` SHALL continue to accept their existing options shapes (`ContentSearchOptions`, `PostSearchOptions`, `RealmSearchOptions`) and return their existing result shapes (`ContentSearchResult`, `PostSearchResult`, `RealmSearchResult`) unchanged. They SHALL NOT be deprecated by the federated endpoint; the federated endpoint orchestrates over them rather than replacing them.

#### Scenario: Existing post-search call still works

- **GIVEN** a client that calls `POST /meili/posts/search` with `{ kind: "REVIEW", targetUnitId: "b-1" }`
- **WHEN** the federated endpoint is deployed
- **THEN** the legacy call SHALL continue to return `PostSearchResult` exactly as before
- **AND** SHALL NOT be redirected through the federated path

#### Scenario: Existing content-search call still works

- **GIVEN** a client that calls the content search endpoint with `{ keyword: "magic" }`
- **WHEN** the federated endpoint is deployed
- **THEN** the legacy call SHALL continue to return `ContentSearchResult` exactly as before

### Requirement: Public content search is public-only
Public content search filters SHALL require `visibility=PUBLIC` and SHALL rely on indexes that contain only public published content.

#### Scenario: Search includes shelves
- **WHEN** public content search includes shelf results
- **THEN** private system shelves SHALL NOT appear

#### Scenario: Search is scoped to a book
- **WHEN** public content search is scoped to a book and requests shelves
- **THEN** returned shelf documents SHALL be public shelves whose `containedUnitIds` include the book Unit ID

### Requirement: License filter keeps existing isLicensed behavior
The content search `isLicensed` filter SHALL continue to filter by licensed-work metadata, not Unit publication license.

#### Scenario: Search filters licensed works
- **WHEN** a search query sets `isLicensed=true`
- **THEN** the filter SHALL match the existing `isLicensed` indexed field
- **AND** it SHALL NOT match by license slug

### Requirement: Content Search Filters Use Inherited Work Tags

When a content search request filters by tags, the server SHALL apply the tag
filter against the document's inherited-aware tag field (`allTagIds` or its
successor), not only release-local `ownTagIds`.

#### Scenario: Work tag finds release

- **GIVEN** hidden work `work-x` has tag `tag-fantasy`
- **AND** release `release-a` belongs to `work-x` through `UnitWork`
- **WHEN** a user searches for content with `tag-fantasy`
- **THEN** `release-a` SHALL be eligible to appear even if it has no release-local `UnitTag(tag-fantasy)` row

#### Scenario: Release-local tag also matches

- **GIVEN** release `release-a` has local tag `tag-translation-quality`
- **WHEN** a user searches for content with `tag-translation-quality`
- **THEN** `release-a` SHALL be eligible to appear through its release-local tag projection

### Requirement: Content Search Groups Same-Work Releases By Default

The content search API SHALL group ordinary release search results by
`searchGroupId` by default. For each group, the API SHALL choose a primary
visible result using release-specific match quality, language preference,
`UnitWork.position`, and `displayPolicy`.

#### Scenario: Same work has many tag matches

- **GIVEN** 20 releases belong to `work-x`
- **AND** all 20 inherit the same work tag
- **WHEN** a user searches by that tag
- **THEN** the default response SHALL NOT render all 20 releases as independent top-ranked results
- **AND** it SHALL return a grouped result with collapsed alternatives

#### Scenario: Precise release field expands matches

- **WHEN** a search query includes an explicit release-specific constraint such as publisher, ISBN, source site, format, or exact language mode
- **THEN** the API MAY return multiple release rows from the same work group
- **AND** those rows SHALL remain associated with their `searchGroupId`

### Requirement: Search Projection Drift Is Repairable

The search API and admin diagnostics SHALL tolerate eventual consistency after
work-domain mutations and SHALL provide a repair path that rebuilds inherited
work projections for affected releases.

#### Scenario: Work tag projection is temporarily stale

- **WHEN** a work tag is changed and the release fan-out job has not completed
- **THEN** content search MAY temporarily reflect the old tag projection
- **AND** the queued repair job SHALL eventually rebuild affected release documents

### Requirement: Creation Work Matching Uses Content Search

Creation-time work matching SHALL use ordinary content search APIs to find
candidate visible releases. Search results used for matching SHALL expose enough
work-domain metadata for the caller to bind a new release to the candidate's
canonical work and to preview existing same-work releases.

#### Scenario: Matching search returns candidate work metadata

- **WHEN** a creation surface searches for similar books
- **THEN** the search API response SHALL include visible release results
- **AND** each result that belongs to a work SHALL expose its canonical work id
  or equivalent work-domain metadata
- **AND** the UI SHALL be able to show sibling releases and tags before binding
