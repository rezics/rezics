## MODIFIED Requirements

### Requirement: User-Visible Search Parity

The search feature SHALL consume the new `ContentSearchResult` from the server-mediated search API. Search results SHALL display content from `ContentSearchDocument` fields (`titles`, `creditNames`, `type`, `coverAssetUnitId`). The frontend SHALL resolve display title from the `titles` array based on the user's preferred language, falling back to the first available title.

#### Scenario: Query behavior with new result shape

- **GIVEN** the search API returns `ContentSearchResult` with `items` containing `ContentSearchDocument` objects
- **WHEN** results are rendered
- **THEN** each result SHALL display the title resolved from `titles` array, attribution from `creditNames`, and content type from `type`

#### Scenario: Multilingual title resolution

- **GIVEN** a search result document with `titles: ["Harry Potter...", "哈利·波特..."]` and `languages: ["en", "zh"]`
- **WHEN** the user's preferred language is "zh"
- **THEN** the displayed title SHALL be "哈利·波特..."

### Requirement: Public Search Feature Entry

The app SHALL expose search functionality through a stable public feature entry point (`index.ts`) with explicit named exports only. The search feature SHALL use `ContentSearchOptions` for query construction and `ContentSearchResult` for result handling, both imported from `@rezics/contract` via `@rezics/api` query hooks.

#### Scenario: Consumer imports from explicit entry exports

- **GIVEN** a route or component integrates search behavior
- **WHEN** it imports search modules
- **THEN** it MUST import from feature `index.ts` explicit named exports
- **AND** search queries SHALL use `ContentSearchOptions` shape

### Requirement: Search supports realm and tag filtering

The search feature SHALL support filtering by realm and by tags (both global and realm-scoped). Tag filtering SHALL use tag UUIDs, not tag name strings. The frontend SHALL pass tag UUIDs obtained from prior tag lookups or UI state.

#### Scenario: Search within a realm

- **GIVEN** the user is browsing a realm page
- **WHEN** they perform a search
- **THEN** the search request SHALL include `realmId` in the `ContentSearchOptions`
- **AND** results SHALL be scoped to that realm

#### Scenario: Search with tag filter

- **GIVEN** the user selects a tag filter in the search UI
- **WHEN** the search request is sent
- **THEN** it SHALL include the tag's UUID in `tagIds` (global) or `realmTagIds` (realm-scoped)

### Requirement: Search supports content type filtering

The search feature SHALL allow filtering by content type (BOOK, GAME, MEDIA, SHELF) via the `type` field in `ContentSearchOptions`.

#### Scenario: Filter search to books only

- **GIVEN** the user selects "Books" type filter
- **WHEN** the search is executed
- **THEN** the request SHALL include `type: "BOOK"` in search options
- **AND** only book results SHALL be displayed
