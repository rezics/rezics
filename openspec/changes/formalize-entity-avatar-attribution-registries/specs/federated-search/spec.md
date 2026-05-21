## MODIFIED Requirements

### Requirement: SearchCategory contract
The `@rezics/contract` package SHALL export a `SearchCategory` Typebox union enumerating the result-view categories. The union SHALL be exactly: `"all"`, `"mixed"`, `"books"`, `"reviews"`, `"excerpts"`, `"remarks"`, `"posts"`, `"shelves"`, `"realms"`, `"users"`, `"entities"`. The default category for any scope SHALL be `"all"`.

#### Scenario: SearchCategory union is exhaustive
- **WHEN** a consumer imports `SearchCategory`
- **THEN** the type SHALL admit only the listed string literals
- **AND** any other value SHALL fail Typebox validation

#### Scenario: entities category is accepted
- **WHEN** a request specifies `category = "entities"`
- **THEN** Typebox validation SHALL accept the request

#### Scenario: chapters is intentionally excluded
- **WHEN** a request specifies `category = "chapters"`
- **THEN** Typebox validation SHALL reject the request with a 400-class error
- **AND** the federated endpoint SHALL NOT include chapter posts in any category surface

### Requirement: Strict-membership scope-to-filter mapping
The server SHALL apply scope filters according to the table below. Other indexes for a given scope SHALL be excluded from the request rather than queried with no filter.

| Scope | content (BOOK/GAME/MEDIA/LINK) | content (SHELF) | posts | realms | users | entities |
|---|---|---|---|---|---|---|
| `global` | (no filter) | (no filter) | (no filter) | (no filter) | (no filter) | (no filter) |
| `book {unitId}` | excluded | `containedUnitIds = unitId` | `rootTargetUnitId = unitId` | excluded | excluded | excluded |
| `realm {realmId}` | `realmIds = realmId` | `realmIds = realmId` | `realmIds = realmId` | excluded | excluded | excluded |
| `user {userId}` | `userId = userId` | `userId = userId` | `authorUserId = userId` | excluded | excluded | `ownerUnitId = userId` |

The orchestrator SHALL NOT execute sub-queries against excluded indexes. Indirect-mention semantics and attribution graph expansion SHALL NOT be inferred from entity documents.

#### Scenario: Global search includes entities
- **GIVEN** `{ scope: { kind: "global" }, category: "all", query: { keyword: "liu" } }`
- **WHEN** the endpoint orchestrates sub-queries
- **THEN** it SHALL include an `entities` section backed by the entities index

#### Scenario: Book scope omits entities
- **GIVEN** `{ scope: { kind: "book", unitId: "b-9" }, category: "all", query: { keyword: "liu" } }`
- **WHEN** the endpoint orchestrates sub-queries
- **THEN** it SHALL NOT query the entities index

#### Scenario: User scope filters entities by owner
- **GIVEN** `{ scope: { kind: "user", userId: "u-3" }, category: "entities", query: {} }`
- **WHEN** the endpoint queries the entities index
- **THEN** the filter SHALL include `ownerUnitId = "u-3"`
