## ADDED Requirements

### Requirement: List all JWT service records on auth service

The auth service SHALL expose `GET /api/auth/admin/jwt-services` that returns all `JwtService` records from the auth database. The endpoint SHALL require `owner` role authorization via better-auth access control.

#### Scenario: Owner lists all auth JWT services
- **WHEN** an authenticated user with `owner` role sends `GET /api/auth/admin/jwt-services`
- **THEN** the auth service SHALL return an array of all `JwtService` records with metadata fields (serviceKey, issuer, audience, jwksUrl, jwksPath, isLocalIssuer, isActive)

#### Scenario: Admin user is denied access
- **WHEN** an authenticated user with `admin` role sends `GET /api/auth/admin/jwt-services`
- **THEN** the auth service SHALL return 403 Forbidden

#### Scenario: Unauthenticated request is denied
- **WHEN** an unauthenticated request is sent to `GET /api/auth/admin/jwt-services`
- **THEN** the auth service SHALL return 401 Unauthorized

### Requirement: Fetch single JWT service record on auth service

The auth service SHALL expose `GET /api/auth/admin/jwt-services/:serviceKey` that returns a single `JwtService` record by its `serviceKey`. The endpoint SHALL require `owner` role.

#### Scenario: Owner fetches existing service
- **WHEN** an authenticated owner sends `GET /api/auth/admin/jwt-services/auth-local`
- **THEN** the auth service SHALL return the full `JwtService` record for that key

#### Scenario: Fetch non-existent service returns 404
- **WHEN** an authenticated owner sends `GET /api/auth/admin/jwt-services/non-existent`
- **THEN** the auth service SHALL return 404

### Requirement: Create JWT service record on auth service

The auth service SHALL expose `POST /api/auth/admin/jwt-services` that creates a new `JwtService` record. The `serviceKey` SHALL be unique. The endpoint SHALL require `owner` role.

#### Scenario: Owner creates new service
- **WHEN** an authenticated owner sends `POST /api/auth/admin/jwt-services` with valid fields
- **THEN** the auth service SHALL create the record and return it with 201 status

#### Scenario: Duplicate serviceKey returns 409
- **WHEN** an authenticated owner sends `POST /api/auth/admin/jwt-services` with a `serviceKey` that already exists
- **THEN** the auth service SHALL return 409 with a clear error message

### Requirement: Update mutable fields on auth service

The auth service SHALL expose `PATCH /api/auth/admin/jwt-services/:serviceKey` that updates mutable fields: `issuer`, `audience`, `jwksUrl`, `jwksPath`, `isLocalIssuer`. The `serviceKey` SHALL NOT be mutable. The endpoint SHALL invalidate the JWT service cache after a successful write. The endpoint SHALL require `owner` role.

#### Scenario: Owner updates issuer
- **WHEN** an authenticated owner sends `PATCH /api/auth/admin/jwt-services/auth-local` with `{ "issuer": "https://new-issuer.example.com" }`
- **THEN** the auth service SHALL update the record, invalidate the cache for `'auth-local'`, and return the updated record

#### Scenario: Invalid URL field returns 422
- **WHEN** an authenticated owner sends a PATCH with an invalid URL for `jwksUrl`
- **THEN** the auth service SHALL return 422 with field-level validation errors

### Requirement: Activate JWT service on auth service

The auth service SHALL expose `POST /api/auth/admin/jwt-services/:serviceKey/activate` that sets `isActive = true` and invalidates the cache. The endpoint SHALL require `owner` role.

#### Scenario: Owner activates a deactivated service
- **WHEN** an authenticated owner sends `POST /api/auth/admin/jwt-services/auth-local/activate`
- **THEN** the auth service SHALL set `isActive = true`, invalidate the cache, and return the updated record

### Requirement: Deactivate JWT service on auth service

The auth service SHALL expose `POST /api/auth/admin/jwt-services/:serviceKey/deactivate` that sets `isActive = false` and invalidates the cache. The endpoint SHALL require `owner` role.

#### Scenario: Owner deactivates an active service
- **WHEN** an authenticated owner sends `POST /api/auth/admin/jwt-services/auth-local/deactivate`
- **THEN** the auth service SHALL set `isActive = false`, invalidate the cache, and return the updated record

### Requirement: All auth JWT service mutations write DB first then invalidate cache

Every mutation endpoint SHALL write to the database before invalidating the JWT service cache. This ordering SHALL be enforced consistently across create, update, activate, and deactivate operations.

#### Scenario: Cache reflects DB state after mutation
- **WHEN** any auth JWT service mutation endpoint completes successfully
- **THEN** the next cache lookup for that serviceKey SHALL return the newly written database state

### Requirement: Shared DTO schema with server

The auth JWT service admin API SHALL use the same `JwtServiceDTO`, `CreateJwtServiceInput`, and `UpdateJwtServiceInput` schemas from `@rezics/contract` as the server admin API.

#### Scenario: Response shape matches server API
- **WHEN** the auth service returns a JWT service record
- **THEN** the response body SHALL conform to the `JwtServiceDTO` schema defined in `@rezics/contract`
