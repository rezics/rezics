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
