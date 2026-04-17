## MODIFIED Requirements

### Requirement: `ids` field on every list query
Every list-query schema in `@rezics/contract` SHALL include an optional `ids` field sourced from one of two shared mixins that mirror the HTTP transport: GET querystring schemas spread `...listGetQueryBase.properties` (where `ids` is a CSV `string`, split server-side via the shared `parseIdsCsv` helper), and POST body schemas spread `...listPostBodyBase.properties` (where `ids` is a native `string[]` with `maxItems: 200`). The GET CSV and POST array SHALL represent the same logical value — both paths MAY be implemented for the same resource, and when both exist they SHALL accept the same id set. When `ids` is provided, it SHALL compose with other filters via intersection.

#### Scenario: GET schema spreads listGetQueryBase
- **WHEN** a developer defines `postListQuerySchema = t.Object({ ...listGetQueryBase.properties, kind: t.Optional(...) })`
- **THEN** `ids` is present as an optional CSV string field

#### Scenario: POST body schema spreads listPostBodyBase
- **WHEN** a developer defines `postListBodySchema = t.Object({ ...listPostBodyBase.properties, kind: t.Optional(...) })`
- **THEN** `ids` is present as an optional `string[]` with `maxItems: 200`

#### Scenario: GET handler splits CSV via shared helper
- **WHEN** a client sends `GET /user/brief/list?ids=a,b,c`
- **THEN** the handler calls `parseIdsCsv(query.ids)` which returns `["a","b","c"]` after trimming and deduplicating empty entries

#### Scenario: POST with ids array
- **WHEN** a client sends `POST /user/brief/list` with body `{ "ids": ["a","b","c"] }`
- **THEN** the handler reads `body.ids` directly as a validated `string[]`

#### Scenario: ids composes with other filters
- **WHEN** a client sends `POST /post/list` with body `{ "ids": ["p1","p2","p3"], "kind": "REVIEW" }`
- **THEN** the response contains only posts whose unitId is in the ids set AND whose kind is REVIEW

#### Scenario: GET ids CSV over cap is rejected
- **WHEN** a client sends `GET /post/list?ids=<201 comma-separated ids>`
- **THEN** `parseIdsCsv` throws and the route returns 400

#### Scenario: POST ids array over cap is rejected
- **WHEN** a client sends `POST /post/list` with body containing `ids.length > 200`
- **THEN** the server returns 400 (schema validation error)

### Requirement: When to choose GET versus POST for list
GET SHALL be preferred for cacheability when all filters fit comfortably in a URL (under ~2 KB) and when `ids.length <= 30`. POST SHALL be preferred when `ids.length > 30`, when filters contain nested objects (e.g., cursor objects, sort objects), or when the total serialized querystring would exceed ~2 KB. The `listGetQueryBase` and `listPostBodyBase` mixins SHALL each carry JSDoc documenting this guidance and the CSV-vs-array transport distinction.

#### Scenario: Small hydration uses GET
- **WHEN** a frontend hydrates 10 actor briefs on a notification page
- **THEN** it sends `GET /user/brief/list?ids=a,b,c,...`

#### Scenario: Large hydration uses POST
- **WHEN** a frontend hydrates 80 author briefs on a feed page
- **THEN** it sends `POST /user/brief/list` with body `{ ids: [...] }`

#### Scenario: Nested cursor filter uses POST
- **WHEN** a frontend queries posts with `{ cursor: { unitId, createdAt, sortPath } }`
- **THEN** it sends `POST /post/list` with the cursor in the body rather than encoding the nested object into querystring
