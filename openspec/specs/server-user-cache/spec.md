## REMOVED Requirements

### Requirement: In-memory user cache for permission resolution

**Reason**: The `rezics-session-token` carries `role` in its JWT claims. Per-request DB lookups for permission resolution are eliminated entirely. The unbounded `Map<unitId, UserDTO>` cache (which had a known performance issue — `user-cache.ts:1`) is no longer needed.
**Migration**: Delete `package/server/src/middleware/user-cache.ts`. Remove all imports and usages of `cacheUser`, `getOrFetchUser`, `invalidate`, `setUserCacheTtl`. The `requireLogin` macro reads role from token claims.

### Requirement: Cache TTL aligns with access token TTL

**Reason**: No cache exists. Role staleness is bounded by the `rezics-session-token` TTL (~15 minutes).
**Migration**: TTL configuration (`setUserCacheTtl`) is deleted with the cache module.

### Requirement: Cache supports explicit invalidation

**Reason**: No immediate invalidation mechanism is needed. Role changes propagate when the token expires (~15 minutes). Admin/privileged operations verify role against the database, so a stale token role cannot grant access. The delay for normal operations is accepted.
**Migration**: Admin operations that called `invalidate(unitId)` on the cache need no replacement — the DB verification on admin endpoints catches stale roles.

### Requirement: Cache handles lazy provisioning integration

**Reason**: Lazy provisioning is removed entirely. User provisioning is guaranteed at registration via the `afterSignUp` hook.
**Migration**: Remove the provisioning branch from the macro and the cache miss handler.

## ADDED Requirements

### Requirement: User lookups key on userId

Any direct `User` lookups in server code (Prisma queries, mappers, helpers) SHALL key on `userId` as the primary key field. The legacy column name `unitId` on the `User` table SHALL NOT be referenced — both because the column has been renamed and because the misnomer would conflate user identity with content (`Unit`) identity.

#### Scenario: Direct user lookup uses userId

- **WHEN** any server code reads a single `User` by primary key
- **THEN** the Prisma query SHALL be `prisma.user.findUnique({ where: { userId } })`
- **AND** the field name `unitId` SHALL NOT appear in any user-table query

#### Scenario: User mapper exposes userId on DTOs

- **WHEN** the user mapper produces a DTO
- **THEN** the DTO SHALL contain a `userId` field
- **AND** it SHALL NOT contain a `unitId` field for user-shaped responses

### Requirement: No in-memory user cache exists

The server SHALL NOT maintain an in-memory `Map`-style user cache for permission resolution or DTO hydration. Permission is resolved via `rezics-session-token` claims (fast path) and verified against the database for privileged operations (slow path). The legacy `package/server/src/middleware/user-cache.ts` SHALL NOT exist.

#### Scenario: Permission resolution skips cache

- **WHEN** the request middleware needs the actor's role for a fast-path denial
- **THEN** it reads `permission.role` from the validated `rezics-session-token` claims
- **AND** it SHALL NOT consult any in-memory cache

#### Scenario: Privileged endpoint verifies against DB

- **WHEN** an admin- or root-only endpoint authorizes a request
- **THEN** it queries `User.permission` from the database by `userId`
- **AND** it SHALL NOT short-circuit on a cached value
