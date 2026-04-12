## ADDED Requirements

### Requirement: In-memory user cache for permission resolution

The server SHALL maintain an in-memory cache mapping `unitId` to `{ user: UserDTO, expiresAt: number }`. The cache SHALL be used by permission macros to avoid redundant database queries within the TTL window.

#### Scenario: Cache miss triggers database lookup

- **WHEN** a request arrives with a `unitId` not present in the cache
- **THEN** the server SHALL query the database for the user record
- **AND** store the result in the cache with the configured TTL
- **AND** return the user record to the caller

#### Scenario: Cache hit returns cached user

- **WHEN** a request arrives with a `unitId` that has a non-expired cache entry
- **THEN** the server SHALL return the cached user record without querying the database

#### Scenario: Expired cache entry triggers refresh

- **WHEN** a request arrives with a `unitId` whose cache entry has expired
- **THEN** the server SHALL query the database for a fresh user record
- **AND** update the cache entry with the new result and a new TTL

### Requirement: Cache TTL aligns with access token TTL

The user cache TTL SHALL be configurable and SHALL default to a value that aligns with the access token TTL (e.g., 5 minutes). This ensures that role changes propagate within a bounded window consistent with the stateless token model.

#### Scenario: Default cache TTL

- **WHEN** no custom TTL is configured
- **THEN** the cache SHALL use a TTL of 300 seconds (5 minutes)

### Requirement: Cache supports explicit invalidation

The cache SHALL expose an `invalidate(unitId)` method that removes a specific entry. This is used by admin actions that change user roles to provide faster propagation than waiting for TTL expiry.

#### Scenario: Admin blocks a user and cache is invalidated

- **WHEN** an admin changes a user's role to BLOCKED
- **THEN** the admin endpoint SHALL call `cache.invalidate(unitId)` for the affected user
- **AND** the next request from that user SHALL trigger a fresh database lookup

#### Scenario: Non-existent cache entry invalidation is a no-op

- **WHEN** `cache.invalidate(unitId)` is called for a unitId not in the cache
- **THEN** the operation SHALL complete without error

### Requirement: Cache handles lazy provisioning integration

When the cache misses and the database lookup also returns no user, the cache SHALL NOT store a negative result. The lazy provisioning middleware SHALL create the user, and the resulting record SHALL be stored in the cache.

#### Scenario: New user provisioned and cached

- **WHEN** a cache miss occurs and no user exists in the database
- **AND** lazy provisioning creates a new user record
- **THEN** the newly created user SHALL be stored in the cache
- **AND** subsequent requests within TTL SHALL hit the cache
