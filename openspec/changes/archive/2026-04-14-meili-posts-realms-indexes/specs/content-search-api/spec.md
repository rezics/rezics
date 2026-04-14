## ADDED Requirements

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
