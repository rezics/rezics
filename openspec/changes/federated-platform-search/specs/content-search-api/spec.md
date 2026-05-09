## ADDED Requirements

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
