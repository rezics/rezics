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
