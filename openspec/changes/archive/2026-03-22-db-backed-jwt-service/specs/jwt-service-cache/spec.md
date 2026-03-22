## ADDED Requirements

### Requirement: Single entry point for JWT service metadata

The system SHALL expose `getJwtService(serviceKey)` as the sole runtime entry point for
reading JWT service metadata. All consumers — token signing, JWKS endpoint, verifier
construction — SHALL call this function instead of reading environment variables or
querying Prisma directly.

#### Scenario: Token signing resolves metadata from cache
- **WHEN** the server signs a session token
- **THEN** it SHALL obtain issuer, audience, and the active private key by calling
  `getJwtService('server-local')`

#### Scenario: Verifier resolves trusted auth metadata from cache
- **WHEN** the server constructs a verifier for auth-issued tokens
- **THEN** it SHALL obtain issuer, audience, and jwksUrl by calling
  `getJwtService('auth-upstream')`

### Requirement: Read-through cache with TTL

`getJwtService(serviceKey)` SHALL implement a read-through cache: on cache hit with a
non-expired entry, it SHALL return the cached value without querying the database. On cache
miss or TTL expiry, it SHALL query the database, populate the cache, and return the result.

#### Scenario: Cache hit returns without DB query
- **WHEN** `getJwtService('server-local')` is called and a valid cached entry exists
- **THEN** the system SHALL return the cached entry without executing a database query

#### Scenario: Cache miss triggers DB read
- **WHEN** `getJwtService('server-local')` is called and no cached entry exists
- **THEN** the system SHALL query the database for the `JwtService` record with its
  associated `Jwks` rows, populate the cache, and return the result

#### Scenario: Expired TTL refreshes from DB
- **WHEN** a cached entry's TTL (2 minutes) has elapsed
- **THEN** the next call to `getJwtService` SHALL query the database and replace the
  stale cache entry

### Requirement: Cache entry includes full service record with keys

Each cache entry SHALL contain the full `JwtService` fields (issuer, audience, jwksUrl,
jwksPath, isLocalIssuer, isActive) together with all associated non-expired `Jwks` rows
ordered by `createdAt` descending. Private key material (`privateJwk`) SHALL be included
in the cached entry.

#### Scenario: Cache entry contains service metadata and keys
- **WHEN** the cache is populated from a database read
- **THEN** the cached entry SHALL include all `JwtService` fields and all non-expired
  `Jwks` rows with both `publicJwk` and `privateJwk`

### Requirement: Explicit invalidation on every write

Every mutation to a `JwtService` record (create, update, activate, deactivate) SHALL call
`invalidateJwtService(serviceKey)` immediately after the database write succeeds. The
invalidation SHALL remove only the entry for the affected `serviceKey`, not flush the
entire cache.

#### Scenario: Update triggers per-key invalidation
- **WHEN** an admin updates the issuer of `JwtService` with key `'server-local'`
- **THEN** the system SHALL write to the database, then call
  `invalidateJwtService('server-local')`, and the next read SHALL return the updated values

#### Scenario: Invalidation is per-key not global
- **WHEN** `invalidateJwtService('server-local')` is called
- **THEN** only the `'server-local'` cache entry SHALL be removed; other entries
  (e.g., `'auth-upstream'`) SHALL remain cached

### Requirement: Write-then-invalidate ordering

Cache invalidation SHALL always occur after the database write completes. The system
SHALL NOT invalidate before writing, as this would allow a concurrent cache miss to
repopulate with stale data.

#### Scenario: Concurrent read during update sees consistent data
- **WHEN** an update writes new metadata to the database and then invalidates the cache
- **THEN** any concurrent `getJwtService` call that triggers a cache miss SHALL read
  the already-committed new data from the database

### Requirement: Bootstrap from environment variables

`bootstrapJwtServiceRecord(serviceKey, defaults)` SHALL create a `JwtService` database row
from environment variable defaults using Prisma upsert with `update: {}`. If the row already
exists, the upsert SHALL be a no-op. Environment variables SHALL NOT be read at runtime
after bootstrap.

#### Scenario: First boot creates DB row from env
- **WHEN** the server starts and no `JwtService` row exists for `'server-local'`
- **THEN** `bootstrapJwtServiceRecord` SHALL create the row using values derived from
  environment variables

#### Scenario: Subsequent boot is a no-op
- **WHEN** the server starts and a `JwtService` row already exists for `'server-local'`
- **THEN** `bootstrapJwtServiceRecord` SHALL not modify the existing row

#### Scenario: Env changes after first boot have no runtime effect
- **WHEN** `MAIN_SESSION_JWT_ISSUER` is changed after the `JwtService` row exists
- **THEN** `getJwtService('server-local')` SHALL continue returning the DB-stored issuer,
  not the new env value
