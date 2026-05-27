## ADDED Requirements

### Requirement: Post documents include post ranking fields

Each `posts` Meilisearch document SHALL include numeric post ranking fields: `hotScore`, `topScore`, `trendingScore`, `qualityScore`, and a `rankUpdatedAt` timestamp or null. These fields SHALL support hot/top/trending ordering for realm feeds, review lists, and other post list surfaces.

#### Scenario: Post document has default ranking fields
- **WHEN** a post document is built before ranking has computed a projection
- **THEN** the document SHALL include numeric zero values for hot, top, trending, and quality scores

#### Scenario: Ranking patch updates post fields
- **WHEN** the ranking service patches the `posts` document for `post-1`
- **THEN** the document SHALL store the latest post ranking scores from the ranking projection

### Requirement: Post documents include comment ranking fields

Each `posts` Meilisearch document representing a comment or reply SHALL include numeric comment ranking fields: `commentHotScore`, `commentTopScore`, `commentQualityScore`, and `commentRankUpdatedAt` timestamp or null. These fields SHALL be used for sibling-level comment sorting.

#### Scenario: Comment document has comment ranking fields
- **WHEN** a reply post document is built
- **THEN** the document SHALL include numeric comment hot, top, and quality score fields

#### Scenario: Comment rank patch updates only ranking fields
- **WHEN** ranking recomputes comment rank for `comment-1`
- **THEN** the Meili patch SHALL update comment ranking fields without rebuilding unrelated author or target fields

### Requirement: Posts index supports ranking sorts

The `posts` Meilisearch index SHALL configure post and comment ranking fields as sortable attributes. Existing sortable attributes such as `createdAt`, `updatedAt`, and `replyCount` SHALL remain sortable.

#### Scenario: Realm feed hot sort is accepted
- **WHEN** a post search query requests sort `hotScore:desc`
- **THEN** Meilisearch SHALL accept the sort because `hotScore` is configured as sortable

#### Scenario: Comment sibling hot sort is accepted
- **WHEN** a post search query requests sort `commentHotScore:desc`
- **THEN** Meilisearch SHALL accept the sort because `commentHotScore` is configured as sortable

### Requirement: Comment hot sorting is sibling-scoped

Post search APIs SHALL support comment hot sorting only after applying filters that identify a sibling comment set, such as `parentPostUnitId`, or a root/depth pair for top-level comments. The API SHALL NOT expose whole-tree comment hot sorting that intermixes ancestors and descendants.

#### Scenario: Reply query sorts siblings
- **WHEN** a client requests replies under `parentPostUnitId = "comment-1"` sorted by `commentHotScore:desc`
- **THEN** the server SHALL forward the parent filter and comment sort to Meilisearch

#### Scenario: Whole-tree hot sort is rejected or normalized
- **WHEN** a client requests comment hot sorting without a sibling-scope filter
- **THEN** the server SHALL reject the request or normalize it to a supported sibling-scoped query
