## Context

JWT service metadata in `package/server` currently lives in three inconsistent locations:

1. **Environment variables** — `jwt-metadata.ts` reads `MAIN_SESSION_JWT_ISSUER`, `AUTH_JWT_ISSUER`,
   etc. on every call and derives issuer/audience/jwksUrl from them.
2. **Module-level constants** — `jwt.service.ts` captures `getServerSessionJwtMetadata()` at import
   time into `mainSessionMetadata`, freezing values for the process lifetime.
3. **Database rows** — `JwtService` and `Jwks` tables exist but are used only as a persistence
   backend for the rotation engine, not as an authoritative config source.

The rotation engine receives static metadata at construction and the persistence layer calls
`ensureLocalServerJwtServiceRecord()` (a Prisma upsert) on every key operation. There is no
caching, no runtime mutability, and no admin surface.

## Goals / Non-Goals

**Goals:**
- DB as sole runtime authority for JWT service metadata after bootstrap
- Single entry point (`getJwtService(serviceKey)`) for all runtime consumers
- In-memory cache with explicit invalidation to avoid per-request DB queries
- Admin API + UI for managing JwtService records without process restarts
- Rotation engine decoupled from metadata (Option C) — it manages key lifecycle only

**Non-Goals:**
- Modifying `package/auth` JWT lifecycle (managed by better-auth)
- Cross-instance cache coordination (Redis pub/sub) — deferred
- Remote JWKS fetch/validation in admin UI — deferred to v2
- Changing the `JwtService`/`Jwks` Prisma schema (already sufficient)

## Decisions

### 1. Option C: Rotation engine as pure key lifecycle machine

**Decision:** The rotation engine receives only `jwtServiceId` to scope key operations.
Signing and verification paths independently resolve `issuer`, `audience`, and `jwksUrl`
from `getJwtService(serviceKey)`.

**Alternatives considered:**
- *Option A (reinitialize rotation engine on config change)*: Destroys the singleton promise
  and recreates on next call. Risk of race conditions during reinitialization and complex
  lifecycle management.
- *Option B (resolver function in rotation engine)*: Makes the engine config-aware when it
  doesn't need to be. The engine's job is key generation/rotation/retirement, not metadata
  resolution.

**Rationale:** Option C gives the cleanest separation. The rotation engine is already
storage-agnostic via the persistence interface; making it metadata-agnostic is the natural
extension. Callers compose: `getJwtService` for metadata + rotation engine for active key.

### 2. In-memory LRU cache with TTL + explicit invalidation

**Decision:** Per-process `Map<serviceKey, {entry, expiresAt}>` with 2-minute TTL.
Every write operation calls `invalidateJwtService(serviceKey)` after the DB write.

**Alternatives considered:**
- *No cache (query DB every time)*: The current persistence layer already does this via upsert.
  Adds unnecessary latency to every token operation.
- *Redis cache*: Over-engineered for single-instance deployment. Adds operational dependency.
- *Infinite TTL with invalidation only*: Risk of stale data if an invalidation is missed
  (e.g., direct DB edit). 2-minute TTL is a safety net.

**Rationale:** Simple, zero-dependency, correct for single-instance. Clear seam to swap in
Redis later — replace `invalidateJwtService` internals with `DEL` + pub/sub.

### 3. Cache entry includes private key material

**Decision:** The cached `CachedJwtService` includes `privateJwk` from associated `Jwks` rows.

**Rationale:** The private key is already accessible via the DB connection. Caching it in
the same process memory doesn't increase attack surface. Avoids a second DB round-trip for
signing operations. Rotation and key changes are handled by explicit invalidation.

### 4. Bootstrap reads env once, then env is inert

**Decision:** `bootstrapJwtServiceRecord(serviceKey, defaults)` reads env vars to build the
initial DB row via Prisma upsert (`update: {}`). Once the row exists, env var changes have
no runtime effect.

**Rationale:** This eliminates the dual-authority problem. Admin changes are made through the
API, not by redeploying with new env vars. The upsert's `update: {}` ensures idempotent
bootstrap across concurrent startups.

### 5. Seeded crypto provider folds into bootstrap

**Decision:** `MAIN_SESSION_JWT_PRIVATE_JWK` and `MAIN_SESSION_JWT_PUBLIC_JWK` env vars are
consumed during `bootstrapJwtServiceRecord` to create the first `Jwks` row alongside the
`JwtService` row. The `createSeededCryptoProvider` pattern is removed.

**Rationale:** Seeding is a bootstrap concern, not a runtime concern. Having the crypto
provider conditionally return seeded vs generated keys adds hidden state to the rotation
engine. Moving it to bootstrap makes the data flow explicit: env → DB → cache → consumers.

### 6. Drop P2021/P2022 fallback

**Decision:** The `isMissingJwtMetadataStorage` error handler in `jwt-metadata.ts` is removed.
The application assumes the schema is already migrated when it starts.

**Rationale:** Migrations run as a pre-start step (init container or CI pipeline). The fallback
was a workaround for early development where migrations might not have run. It adds complexity
and hides real errors.

### 7. Admin API under `/admin/jwt-services`

**Decision:** RESTful endpoints on the server, consumed by `package/admin` via TanStack Query.

| Method | Path | Action |
|--------|------|--------|
| GET | `/admin/jwt-services` | List all records |
| GET | `/admin/jwt-services/:serviceKey` | Fetch single |
| POST | `/admin/jwt-services` | Create |
| PATCH | `/admin/jwt-services/:serviceKey` | Update mutable fields |
| POST | `/admin/jwt-services/:serviceKey/activate` | Set isActive=true |
| POST | `/admin/jwt-services/:serviceKey/deactivate` | Set isActive=false |

Mutable fields: `issuer`, `audience`, `jwksUrl`, `jwksPath`, `isLocalIssuer`.
`serviceKey` is immutable after creation.

**Rationale:** Follows existing admin API patterns in the codebase. Activate/deactivate are
separate POST actions (not PATCH) because they trigger cache invalidation and represent
distinct operational intents.

## Data Flow

```
Bootstrap (once):
  env vars ──► bootstrapJwtServiceRecord() ──► DB (upsert)

Runtime read path:
  getJwtService(serviceKey)
    ├─ cache hit + not expired ──► return cached
    └─ cache miss / expired ──► DB query ──► populate cache ──► return

Runtime write path (admin API):
  validate request
    ──► Prisma write to DB
    ──► invalidateJwtService(serviceKey)
    ──► next read repopulates from DB

Signing path:
  getJwtService('server-local')
    ├─ metadata: issuer, audience
    └─ jwks[0]: privateJwk (most recent active key)
    ──► SignJWT with resolved values

Verification path:
  getJwtService('auth-upstream')
    ├─ metadata: issuer, audience, jwksUrl
    └─ build verifier options
    ──► jose verify with resolved values

JWKS endpoint:
  getJwtService('server-local')
    └─ jwks[*]: publicJwk (all non-expired)
    ──► return JWKS document
```

## Integration Points

```
package/contract          package/server                    package/admin
┌──────────────┐         ┌─────────────────────────────┐   ┌──────────────┐
│ JwtServiceDTO│◄────────│ src/jwt/                    │   │ src/session/ │
│ schemas      │         │   jwtServiceRepository.ts   │   │   page/      │
└──────────────┘         │   jwtServiceCache.ts        │   │   section/   │
                         │                             │   │   component/ │
package/api              │ src/admin/jwt-service/      │   └──────┬───────┘
┌──────────────┐         │   jwt-service.api.ts        │          │
│ jwt-service  │◄────────│   jwt-service.service.ts    │◄─────────┘
│ query hooks  │         │                             │   (API calls)
└──────────────┘         │ src/session/jwt/            │
                         │   jwt.service.ts (refactored)│
                         │   session.api.ts            │
                         │                             │
                         │ src/auth/context.ts         │
                         │   (uses getJwtService)      │
                         └─────────────────────────────┘
```

## Risks / Trade-offs

**[Risk] Stale cache after direct DB edit** → 2-minute TTL as safety net. Document that
admin API is the only supported mutation path.

**[Risk] Bootstrap race condition** → Prisma upsert with `update: {}` is idempotent.
Two concurrent starts produce one row, second is a no-op.

**[Risk] Issuer/audience change invalidates all active tokens** → This is intentional and
documented in the update flow. Clients must re-authorize. The admin UI should warn before
changing these fields.

**[Risk] Private key in process memory** → Same risk profile as the current DB connection.
No new attack surface. Key rotation via explicit invalidation.

**[Trade-off] Env vars become inert after first boot** → Intentional. Operational changes
go through the admin API. If users need to re-seed from env, they must delete the DB row
first (or use a bootstrap reset endpoint in the future).
