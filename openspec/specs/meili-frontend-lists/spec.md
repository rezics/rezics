## ADDED Requirements

### Requirement: Frontend post list views use Meilisearch search endpoint
Frontend components that display post lists (RemarkList, ThreadList, review lists) SHALL query the server's `POST /meili/posts/search` endpoint instead of the DB-backed `GET /posts/` endpoint. An empty keyword with filters SHALL return a filtered list.

#### Scenario: RemarkList queries Meilisearch
- **WHEN** RemarkList renders for a target unit
- **THEN** it SHALL call `POST /meili/posts/search` with `{ kind: "REMARK", targetUnitId: "<id>" }`
- **AND** display the returned post documents as remark cards

#### Scenario: ThreadList queries Meilisearch
- **WHEN** ThreadList renders for a target unit
- **THEN** it SHALL call `POST /meili/posts/search` with `{ kind: "POST", targetUnitId: "<id>", depth: 0 }`
- **AND** display the returned post documents as thread cards

#### Scenario: Review list queries Meilisearch
- **WHEN** a review list renders for a target unit
- **THEN** it SHALL call `POST /meili/posts/search` with `{ kind: "REVIEW", targetUnitId: "<id>" }`

### Requirement: Frontend realm list views use Meilisearch search endpoint
Frontend components that display realm lists (realm landing, realm search, my realms browse) SHALL query the server's `POST /meili/realms/search` endpoint instead of the DB-backed `GET /realms/` endpoint.

#### Scenario: Realm landing page queries Meilisearch
- **WHEN** the realm landing page renders
- **THEN** it SHALL call `POST /meili/realms/search` with `{ isPublic: true }` for the public realms section
- **AND** `{ isOfficial: true }` for the official realms section

#### Scenario: Realm search page queries Meilisearch
- **WHEN** a user searches realms by keyword
- **THEN** it SHALL call `POST /meili/realms/search` with `{ keyword: "<input>" }`

### Requirement: DB-backed list endpoints restricted to admin role
The existing `GET /posts/` and `GET /realms/` list endpoints SHALL require `BasicAdminPermission` (admin or root role). Non-admin requests SHALL receive a 403 response. These endpoints serve the admin dashboard only.

#### Scenario: Admin can access DB-backed post list
- **GIVEN** an authenticated user with role `ADMIN`
- **WHEN** they call `GET /posts/`
- **THEN** they SHALL receive the full relational post list response

#### Scenario: Regular user denied DB-backed post list
- **GIVEN** an authenticated user with role `USER`
- **WHEN** they call `GET /posts/`
- **THEN** they SHALL receive a 403 response

#### Scenario: Admin can access DB-backed realm list
- **GIVEN** an authenticated user with role `ADMIN`
- **WHEN** they call `GET /realms/`
- **THEN** they SHALL receive the full relational realm list response

#### Scenario: Regular user denied DB-backed realm list
- **GIVEN** an authenticated user with role `USER`
- **WHEN** they call `GET /realms/`
- **THEN** they SHALL receive a 403 response

### Requirement: Meilisearch list queries support pagination and sorting
Frontend Meilisearch list queries SHALL support `offset`, `limit`, and `sort` parameters, matching the Meilisearch pagination model. Default sort for posts SHALL be `createdAt:desc`. Default sort for realms SHALL be `memberCount:desc`.

#### Scenario: Paginated post list
- **WHEN** a post list requests page 2 with limit 20
- **THEN** the search query SHALL include `offset: 20, limit: 20`

#### Scenario: Default post sort is newest first
- **WHEN** a post list renders without explicit sort
- **THEN** the search query SHALL sort by `createdAt:desc`

#### Scenario: Default realm sort is by member count
- **WHEN** a realm list renders without explicit sort
- **THEN** the search query SHALL sort by `memberCount:desc`
