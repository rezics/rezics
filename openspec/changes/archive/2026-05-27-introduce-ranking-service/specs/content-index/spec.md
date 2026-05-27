## ADDED Requirements

### Requirement: Content documents include ranking fields

Each `content` Meilisearch document SHALL include numeric ranking fields for list serving: `hotScore`, `topScore`, `trendingScore`, `qualityScore`, and a `rankUpdatedAt` timestamp or null. These fields SHALL be populated from the ranking service projection and SHALL default to numeric zero values when no projection exists.

#### Scenario: Content document has default ranking fields
- **WHEN** a content document is built before ranking has computed a projection
- **THEN** the document SHALL include `hotScore = 0`, `topScore = 0`, `trendingScore = 0`, and `qualityScore = 0`

#### Scenario: Ranking patch updates content fields
- **WHEN** the ranking service patches the `content` document for `book-1`
- **THEN** the document SHALL store the latest ranking scores from the ranking projection

### Requirement: Content index supports ranking sorts

The `content` Meilisearch index SHALL configure `hotScore`, `topScore`, `trendingScore`, and `qualityScore` as sortable attributes in addition to existing temporal sortable attributes.

#### Scenario: Content hot sort is accepted
- **WHEN** a content search query requests sort `hotScore:desc`
- **THEN** Meilisearch SHALL accept the sort because `hotScore` is configured as sortable

#### Scenario: Existing temporal sort remains accepted
- **WHEN** a content search query requests sort `publishedAt:desc`
- **THEN** Meilisearch SHALL continue to accept the sort

### Requirement: Content search options expose ranking sorts

Content search APIs SHALL allow clients to request ranking sort fields for content discovery. Ranking sort fields SHALL be additive and SHALL NOT remove existing relevance or temporal sort options.

#### Scenario: Client requests trending content
- **WHEN** a client calls the content search endpoint with sort field `trendingScore` and order `desc`
- **THEN** the server SHALL forward `trendingScore:desc` to Meilisearch

#### Scenario: Relevance remains available
- **WHEN** a client calls the content search endpoint with sort field `relevance`
- **THEN** the server SHALL preserve the existing relevance behavior
