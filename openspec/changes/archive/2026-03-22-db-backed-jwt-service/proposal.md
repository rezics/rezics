## Why

JWT service metadata in `package/server` is split between environment variables and database rows
with no clear authority. `jwt-metadata.ts` derives config from env vars on every call,
`jwt.service.ts` freezes issuer/audience at module load time, and `jwt-persistence.ts` upserts
the service record on every key operation. Changing issuer or audience at runtime is impossible
without restarting the process. This change makes the database the single source of truth for
all JWT service metadata after initial bootstrap, enabling runtime configuration and admin
management without process restarts.

## What Changes

- **New `jwtServiceRepository` layer** (`package/server`) — read-through in-memory cache
  keyed by `serviceKey` with 2-minute TTL and explicit invalidation on writes.
  Single entry point: `getJwtService(serviceKey)`.
- **Decouple rotation engine from metadata** (Option C) — rotation engine becomes a pure key
  lifecycle machine (generate, rotate, retire). Signing and verification independently resolve
  metadata from the cached repository. The rotation engine no longer needs issuer/audience config.
- **Remove env-var runtime reads** — env vars (`MAIN_SESSION_JWT_ISSUER`, `AUTH_JWT_ISSUER`, etc.)
  are read only during bootstrap to seed the initial DB row. Once a `JwtService` row exists,
  env changes have no runtime effect.
- **Admin CRUD API** (`package/server`) — REST endpoints under `/admin/jwt-services` for
  list, fetch, create, update, activate, and deactivate operations. Every mutation writes to DB
  first, then invalidates the cache.
- **Admin UI** (`package/admin`) — new `session` module following existing admin patterns
  (MUI table + detail view, TanStack Query integration).
- **Drop P2021/P2022 fallback** — the `isMissingJwtMetadataStorage` error handler in
  `jwt-metadata.ts` is removed. Bootstrap assumes schema is already migrated.
- **Seeded crypto provider folds into bootstrap** — `MAIN_SESSION_JWT_PRIVATE_JWK` /
  `PUBLIC_JWK` env vars are consumed during `bootstrapJwtServiceRecord` to seed the first
  JWKS row, rather than being wired through a custom crypto provider at runtime.

## Capabilities

### New Capabilities

- `jwt-service-cache`: In-memory read-through cache for JwtService records with TTL and
  explicit invalidation. Single entry point `getJwtService(serviceKey)` for all runtime consumers.
- `jwt-service-admin-api`: Admin REST API for managing JwtService records
  (list/fetch/create/update/activate/deactivate) with cache invalidation on every mutation.
- `jwt-service-admin-ui`: Admin dashboard page for viewing and managing JWT service
  configurations (MUI table, detail/edit forms, activate/deactivate controls).

### Modified Capabilities

- `es256-jwks-jwt-verification`: Verification now resolves issuer, audience, and JWKS from
  `getJwtService` instead of env-derived module-level constants.
- `shared-jwt-rotation`: Rotation engine decoupled from metadata — receives only
  `jwtServiceId` for key scoping; signing/verification paths independently resolve metadata.

## Impact

**Affected packages:**
- `package/server` — `src/session/jwt/` rewritten; new `src/jwt/` repository layer;
  new `src/admin/jwt-service/` API module; `src/auth/context.ts` updated to use cached metadata
- `package/admin` — new `src/session/` feature module (page, route, nav entry)
- `package/contract` — new Typebox schemas for JwtService admin DTOs
- `package/api` — new query hooks for jwt-service admin endpoints

**Not affected:**
- `package/auth` — JWT lifecycle fully managed by better-auth, explicitly out of scope
- `package/jwt` — rotation engine interface unchanged; consumers adapt at the call site

**Database:** No schema migration needed — `JwtService` and `Jwks` models already exist.

**Breaking:** Runtime env-var changes for JWT config will no longer take effect without
re-bootstrapping the DB row. This is intentional — DB is the authority after first boot.
