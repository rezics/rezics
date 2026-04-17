## ADDED Requirements

### Requirement: Singular resource prefix
All Elysia route prefixes in `@rezics/server` SHALL be singular nouns. Plural resource prefixes (e.g., `/books`, `/users`, `/tags`) SHALL NOT be used. Service-name prefixes that are already singular (e.g., `/meili`, `/score`, `/session`) and special paths (`/internal`, `/.well-known`, `/admin/stats`, `/admin/jwt-services`) are permitted as-is. The automated convention check SHALL reject plural resource prefixes.

#### Scenario: New route uses singular prefix
- **WHEN** a developer adds `new Elysia({ prefix: "/book" })`
- **THEN** the convention check passes

#### Scenario: New route uses plural prefix
- **WHEN** a developer adds `new Elysia({ prefix: "/books" })`
- **THEN** the convention check fails with a message naming the offending prefix and pointing to this spec

#### Scenario: Existing allowlisted prefix remains valid
- **WHEN** the convention check scans `new Elysia({ prefix: "/admin/stats" })`
- **THEN** the check passes because `stats` is on the explicit allowlist for non-resource names

### Requirement: `/list` suffix for collection and batch access
Endpoints that return a collection or support batch-by-id hydration SHALL use a `/list` suffix on their path. Both `GET /{resource}/list` (querystring filters) and `POST /{resource}/list` (JSON body) SHALL be supported with identical schemas and response shapes. `POST /{resource}` SHALL remain reserved for create operations only.

#### Scenario: GET list with filters
- **WHEN** a client sends `GET /book/list?status=PUBLISHED&limit=20`
- **THEN** the server returns `{ items: BookDTO[], total?: number }` matching the filter

#### Scenario: POST list for complex query
- **WHEN** a client sends `POST /book/list` with body `{ "ids": ["a","b"], "status": "PUBLISHED" }`
- **THEN** the server returns the same shape as the equivalent GET request

#### Scenario: List endpoint missing /list suffix
- **WHEN** a developer adds `.get("/", handler)` on a `/post` route tree that returns an array
- **THEN** the convention check fails and requires either `.get("/list", handler)` or an explicit annotation exempting the route

#### Scenario: POST at resource root is create only
- **WHEN** a client sends `POST /book` with a body intended to query
- **THEN** the route either handles it as create or returns 404 — it SHALL NOT double-purpose as a list/batch endpoint

### Requirement: `ids` field on every list query
Every list-query schema in `@rezics/contract` SHALL include an optional `ids: string[]` field with `maxItems: 200`, sourced from a shared `listQueryBase` mixin. The field SHALL be mirrored identically between GET (CSV string in querystring, split server-side) and POST (array in JSON body). When `ids` is provided, it SHALL compose with other filters via intersection.

#### Scenario: List schema spreads listQueryBase
- **WHEN** a developer defines `postListQuerySchema = t.Object({ ...listQueryBase.properties, kind: t.Optional(...) })`
- **THEN** `ids` is automatically present on the schema

#### Scenario: GET with ids CSV
- **WHEN** a client sends `GET /user/brief/list?ids=a,b,c`
- **THEN** the server parses the CSV, deduplicates and trims whitespace, and returns briefs for existing ids

#### Scenario: POST with ids array
- **WHEN** a client sends `POST /user/brief/list` with body `{ "ids": ["a","b","c"] }`
- **THEN** the server returns the same shape as the equivalent GET

#### Scenario: ids composes with other filters
- **WHEN** a client sends `POST /post/list` with body `{ "ids": ["p1","p2","p3"], "kind": "REVIEW" }`
- **THEN** the response contains only posts whose unitId is in the ids set AND whose kind is REVIEW

#### Scenario: ids over cap is rejected
- **WHEN** a client sends a list request with `ids.length > 200`
- **THEN** the server returns 400 (schema validation error)

### Requirement: Single-item and sub-resource path shape
Single-item reads SHALL use `GET /{resource}/:unitId`. Mutations SHALL use `PUT /{resource}/:unitId`, `DELETE /{resource}/:unitId`, and `POST /{resource}` (create). Sub-resources SHALL nest under the parent's single-item path: single-item sub-resource uses `GET /{resource}/:unitId/{sub}/:id`, sub-resource collection uses `GET /{resource}/:unitId/{sub}/list`.

#### Scenario: Single-item read
- **WHEN** a client sends `GET /book/:unitId`
- **THEN** the server returns `BookDTO` or 404

#### Scenario: Nested collection
- **WHEN** a client sends `GET /user/:unitId/follower/list?limit=50`
- **THEN** the server returns `{ items: UserBrief[], total?: number }` for that user's followers

#### Scenario: Nested single
- **WHEN** a client sends `GET /shelf/:unitId/item/:itemUnitId`
- **THEN** the server returns the single `ShelfItemDTO` or 404

### Requirement: When to choose GET versus POST for list
GET SHALL be preferred for cacheability when all filters fit comfortably in a URL (under ~2 KB) and when `ids.length <= 30`. POST SHALL be preferred when `ids.length > 30`, when filters contain nested objects (e.g., cursor objects, sort objects), or when the total serialized querystring would exceed ~2 KB. The `listQueryBase` mixin SHALL carry a JSDoc comment documenting this guidance.

#### Scenario: Small hydration uses GET
- **WHEN** a frontend hydrates 10 actor briefs on a notification page
- **THEN** it sends `GET /user/brief/list?ids=a,b,c,...`

#### Scenario: Large hydration uses POST
- **WHEN** a frontend hydrates 80 author briefs on a feed page
- **THEN** it sends `POST /user/brief/list` with body `{ ids: [...] }`

#### Scenario: Nested cursor filter uses POST
- **WHEN** a frontend queries posts with `{ cursor: { unitId, createdAt, sortPath } }`
- **THEN** it sends `POST /post/list` with the cursor in the body rather than encoding the nested object into querystring

### Requirement: Brief adopts the convention as its routing shape
The existing `@rezics/server` brief capability SHALL follow the route convention: `GET /user/brief/:unitId` for single brief and `GET /user/brief/list` + `POST /user/brief/list` for batch. Brief remains a distinct capability (separate DTO, separate access rules) — the convention governs path shape only, not feature merge.

#### Scenario: Single brief
- **WHEN** a client sends `GET /user/brief/:unitId`
- **THEN** the server returns `{ unitId, name, slug, bio, avatar }`

#### Scenario: Batch brief via GET
- **WHEN** a client sends `GET /user/brief/list?ids=a,b,c`
- **THEN** the server returns `{ items: UserBrief[], total?: number }`

#### Scenario: Batch brief via POST
- **WHEN** a client sends `POST /user/brief/list` with body `{ ids: ["a","b","c"] }`
- **THEN** the server returns the same shape as the GET variant

### Requirement: Scope limited to @rezics/server
This convention SHALL apply to routes exposed by `@rezics/server` only. `@rezics/auth` inherits better-auth's route shape and is explicitly out of scope. The convention check SHALL skip `@rezics/auth` by excluding `package/auth/` from its scan path.

#### Scenario: Auth route ignored by check
- **WHEN** the convention check scans `package/auth/src`
- **THEN** its prefixes and path shapes are not validated against this spec
