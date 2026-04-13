## ADDED Requirements

### Requirement: Server mediates all content search queries

All content search queries SHALL be routed through a server API endpoint. The frontend SHALL NOT query Meilisearch directly. The `getSearchKey()` pattern (issuing Meilisearch API keys to the frontend) SHALL be removed from the content search flow.

#### Scenario: Frontend calls server search endpoint

- **GIVEN** a user performs a search from the frontend
- **WHEN** the search request is sent
- **THEN** it SHALL be directed to the server's content search endpoint, not directly to Meilisearch

### Requirement: Search endpoint accepts typed ContentSearchOptions

The server SHALL expose a content search endpoint that accepts `ContentSearchOptions` with the following fields: `keyword` (free text), `type` (UnitType filter), `tagIds` (global tag UUIDs), `realmId` (realm UUID), `realmTagIds` (tag UUIDs scoped to the specified realm), `languages` (language codes), `nsfw` (boolean, default false), `isLicensed` (boolean), `sort` (field + order), `offset`, and `limit`.

#### Scenario: Search with keyword only

- **WHEN** the endpoint receives `{ keyword: "fantasy" }`
- **THEN** it SHALL query the content index with "fantasy" as the search text
- **AND** apply default filters (nsfw = false)

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

### Requirement: Default nsfw filter excludes nsfw content

When `nsfw` is not specified or is `false` in search options, the server SHALL automatically add `nsfw = false` to the Meilisearch filter. When `nsfw` is explicitly `true`, only nsfw content SHALL be returned.

#### Scenario: Default search excludes nsfw

- **WHEN** a search is performed without specifying `nsfw`
- **THEN** the filter SHALL include `nsfw = false`
- **AND** no nsfw documents SHALL appear in results

#### Scenario: Explicit nsfw search

- **WHEN** a search is performed with `{ nsfw: true }`
- **THEN** the filter SHALL include `nsfw = true`
- **AND** only nsfw documents SHALL appear in results

### Requirement: Sort defaults to relevance with temporal fallback

When no sort is specified, Meilisearch's default relevance ranking SHALL be used. When a sort field is specified, the server SHALL map it to the corresponding Meilisearch sort expression. The default sort order for temporal fields SHALL be descending.

#### Scenario: Default sort is relevance

- **WHEN** a search is performed without specifying sort
- **THEN** results SHALL be ordered by Meilisearch's default relevance ranking

#### Scenario: Explicit sort by createdAt

- **WHEN** a search is performed with `{ sort: { field: "createdAt", order: "desc" } }`
- **THEN** results SHALL be sorted by `createdAt:desc`
