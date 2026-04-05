## MODIFIED Requirements

### Requirement: List all JWT service records

The server SHALL expose `GET /admin/jwt-services` that returns all `JwtService` records.
The endpoint SHALL require **root-level** authorization (`ROOT` role only).

#### Scenario: Root user lists all JWT services
- **WHEN** an authenticated user with `ROOT` role sends `GET /admin/jwt-services`
- **THEN** the server SHALL return an array of all `JwtService` records with their metadata
  fields (serviceKey, issuer, audience, jwksUrl, jwksPath, isLocalIssuer, isActive)

#### Scenario: Admin user is denied access
- **WHEN** an authenticated user with `ADMIN` role sends `GET /admin/jwt-services`
- **THEN** the server SHALL return 403 Forbidden

### Requirement: Fetch single JWT service record

The server SHALL expose `GET /admin/jwt-services/:serviceKey` that returns a single
`JwtService` record by its `serviceKey`. The endpoint SHALL require **root-level** authorization.

#### Scenario: Root user fetches existing service
- **WHEN** an authenticated user with `ROOT` role sends `GET /admin/jwt-services/server-local`
- **THEN** the server SHALL return the full `JwtService` record for that key

#### Scenario: Fetch non-existent service returns 404
- **WHEN** an authenticated user with `ROOT` role sends `GET /admin/jwt-services/non-existent`
- **THEN** the server SHALL return 404

### Requirement: Create JWT service record

The server SHALL expose `POST /admin/jwt-services` that creates a new `JwtService` record.
The `serviceKey` SHALL be provided in the request body and SHALL be unique. The endpoint SHALL require **root-level** authorization.

#### Scenario: Root user creates new service
- **WHEN** an authenticated user with `ROOT` role sends `POST /admin/jwt-services` with valid fields
- **THEN** the server SHALL create the record and return it with 201 status

#### Scenario: Duplicate serviceKey returns 409
- **WHEN** an authenticated user with `ROOT` role sends `POST /admin/jwt-services` with a `serviceKey`
  that already exists
- **THEN** the server SHALL return 409 with a clear error message

### Requirement: Update mutable fields

The server SHALL expose `PATCH /admin/jwt-services/:serviceKey` that updates mutable fields:
`issuer`, `audience`, `jwksUrl`, `jwksPath`, `isLocalIssuer`. The `serviceKey` SHALL NOT be
mutable after creation. The endpoint SHALL invalidate the cache after a successful write. The endpoint SHALL require **root-level** authorization.

#### Scenario: Root user updates issuer
- **WHEN** an authenticated user with `ROOT` role sends `PATCH /admin/jwt-services/server-local`
  with `{ "issuer": "https://new-issuer.example.com" }`
- **THEN** the server SHALL update the record, invalidate the cache for `'server-local'`,
  and return the updated record

#### Scenario: Invalid URL field returns 422
- **WHEN** an authenticated user with `ROOT` role sends a PATCH with an invalid URL for `jwksUrl`
- **THEN** the server SHALL return 422 with field-level validation errors

### Requirement: Activate JWT service

The server SHALL expose `POST /admin/jwt-services/:serviceKey/activate` that sets
`isActive = true` and invalidates the cache for that `serviceKey`. The endpoint SHALL require **root-level** authorization.

#### Scenario: Root user activates a deactivated service
- **WHEN** an authenticated user with `ROOT` role sends `POST /admin/jwt-services/server-local/activate`
- **THEN** the server SHALL set `isActive = true` in the database, invalidate the cache,
  and return the updated record

### Requirement: Deactivate JWT service

The server SHALL expose `POST /admin/jwt-services/:serviceKey/deactivate` that sets
`isActive = false` and invalidates the cache for that `serviceKey`. The endpoint SHALL require **root-level** authorization.

#### Scenario: Root user deactivates an active service
- **WHEN** an authenticated user with `ROOT` role sends `POST /admin/jwt-services/server-local/deactivate`
- **THEN** the server SHALL set `isActive = false` in the database, invalidate the cache,
  and return the updated record

### Requirement: All mutations write DB first then invalidate cache

Every mutation endpoint SHALL write to the database before calling
`invalidateJwtService(serviceKey)`. This ordering SHALL be enforced consistently across
create, update, activate, and deactivate operations.

#### Scenario: Cache reflects DB state after mutation
- **WHEN** any mutation endpoint completes successfully
- **THEN** the next call to `getJwtService(serviceKey)` SHALL return the newly written
  database state
