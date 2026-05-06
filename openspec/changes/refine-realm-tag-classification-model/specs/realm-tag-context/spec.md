## ADDED Requirements

### Requirement: Unit tag context endpoint distinguishes highlights from pair contexts

The `GET /tags/for-unit/:unitId/context` endpoint SHALL remain a unit-detail aggregation endpoint. Its `realmHighlights` entries SHALL describe realm-scoped tag applications for the current target Unit, while pair-level explanatory data SHALL belong to the separate `RealmTagContext(realmUnitId, tagUnitId)` capability. The endpoint MAY include `contextUnitId` or a context link for each highlighted realm/tag pair, but it SHALL NOT treat the pair itself as a Tag or Unit.

#### Scenario: Highlight entry references pair context without becoming identity

- **GIVEN** `RealmTagUnit(realm-1, tag-1, unit-1)` exists
- **AND** `RealmTagContext(realm-1, tag-1)` exists with `contextUnitId = "context-1"`
- **WHEN** an authenticated user requests `GET /tags/for-unit/unit-1/context`
- **THEN** the relevant realm highlight entry MAY include `contextUnitId = "context-1"` or a context route
- **AND** the tag entry SHALL still identify the applied tag by global `tagUnitId = "tag-1"`
- **AND** the response SHALL NOT emit a fake tag id for `realm-1:tag-1`

#### Scenario: Highlight entry without pair context still renders as realm tag use

- **GIVEN** `RealmTagUnit(realm-1, tag-1, unit-1)` exists
- **AND** no `RealmTagContext(realm-1, tag-1)` exists
- **WHEN** an authenticated user requests `GET /tags/for-unit/unit-1/context`
- **THEN** the response SHALL still include the realm-highlight tag entry
- **AND** the context reference SHALL be null or absent according to the DTO contract

## MODIFIED Requirements

### Requirement: Tag context endpoint

The server SHALL expose `GET /tags/for-unit/:unitId/context` that returns global tags and realm highlights in a single response. The response body SHALL conform to `{ tags: UnitTagDTO[], realmHighlights: RealmTagHighlight[] }` where each `RealmTagHighlight` contains a realm identifier, realm display data, and an array of tag entries resolved from existing global TAG Units. Authentication SHALL be optional for this endpoint.

The endpoint SHALL NOT be the pair-level `RealmTagContext` read endpoint. Pair-level interpretation pages SHALL be read through the dedicated realm-tag context API, while this endpoint MAY include lightweight context references for highlighted pairs.

#### Scenario: Authenticated user receives tags and realm highlights

- **WHEN** an authenticated user sends `GET /tags/for-unit/:unitId/context`
- **THEN** the server SHALL return `tags` sorted by score descending
- **AND** the server SHALL return `realmHighlights` based on the user's realm-tag preferences
- **AND** every highlighted tag SHALL resolve to an existing global tag Unit

#### Scenario: Request for non-existent unit returns 404

- **WHEN** a request is sent to `GET /tags/for-unit/:unitId/context` with a unitId that does not exist
- **THEN** the server SHALL return 404
