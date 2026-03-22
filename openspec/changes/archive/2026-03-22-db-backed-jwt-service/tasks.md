## 1. JWT Service Cache Layer (`package/server`)

- [x] 1.1 Create `src/jwt/jwtServiceCache.ts` — in-memory `Map<serviceKey, {entry, expiresAt}>` with 2-minute TTL, `getJwtService(serviceKey)` read-through function, and `invalidateJwtService(serviceKey)` eviction function
- [x] 1.2 Create `src/jwt/jwtServiceRepository.ts` — DB query function that fetches a `JwtService` record with its non-expired `Jwks` rows (ordered by `createdAt` desc), used by the cache on miss
- [x] 1.3 Create `src/jwt/bootstrapJwtService.ts` — `bootstrapJwtServiceRecord(serviceKey, defaults)` using Prisma upsert with `update: {}`; reads env vars for defaults; handles seeded crypto keys (`MAIN_SESSION_JWT_PRIVATE_JWK`/`PUBLIC_JWK`) by creating the first `Jwks` row alongside the `JwtService` row
- [x] 1.4 Export public API from `src/jwt/index.ts` — `getJwtService`, `invalidateJwtService`, `bootstrapJwtServiceRecord`, and the `CachedJwtService` type

## 2. Refactor Signing Path (`package/server`)

- [x] 2.1 Refactor `src/session/jwt/jwt.service.ts` — remove module-level `mainSessionMetadata` constant; `sign()` resolves issuer, audience, and active private key via `getJwtService('server-local')` on each call
- [x] 2.2 Remove `createSeededCryptoProvider` from `jwt.service.ts` — seeded key logic moved to bootstrap (task 1.3)
- [x] 2.3 Update rotation engine initialization — pass only `jwtServiceId` scope (not issuer/audience); the rotation engine manages key lifecycle only
- [x] 2.4 Refactor `getMainSessionPublicJwks()` — resolve public keys from `getJwtService('server-local').jwks` instead of rotation engine's `getPublicJwks()`

## 3. Refactor Verification Path (`package/server`)

- [x] 3.1 Refactor `src/session/jwt/jwt.service.ts` `verify()` — resolve issuer, audience, and JWKS from `getJwtService('server-local')` instead of module-level constants
- [x] 3.2 Refactor `src/auth/context.ts` — `identityContextPlugin` resolves auth verifier options from `getJwtService('auth-upstream')` instead of calling `getTrustedAuthJwtServiceRecord()` and env vars
- [x] 3.3 Update `getMainSessionJwtContext()` — resolve all fields from `getJwtService('server-local')`

## 4. Remove Old Metadata Layer (`package/server`)

- [x] 4.1 Delete or gut `src/session/jwt/jwt-metadata.ts` — remove `getServerSessionJwtMetadata()`, `getTrustedAuthJwtMetadata()`, `ensureLocalServerJwtServiceRecord()`, `ensureTrustedAuthJwtServiceRecord()`, and the `isMissingJwtMetadataStorage` fallback
- [x] 4.2 Refactor `src/session/jwt/jwt-persistence.ts` — replace calls to `ensureLocalServerJwtServiceRecord()` and `getServerSessionJwtMetadata()` with `getJwtService('server-local')`; scope key operations by `jwtServiceId`
- [x] 4.3 Update server startup (`src/index.ts` or bootstrap entry) — call `bootstrapJwtServiceRecord` for both `'server-local'` and `'auth-upstream'` service keys during initialization
- [x] 4.4 Grep for remaining imports of deleted functions across `package/server` and fix all references

## 5. Contract Schemas (`package/contract`)

- [x] 5.1 Add Typebox schemas for JwtService admin DTOs — `JwtServiceDTO`, `CreateJwtServiceInput`, `UpdateJwtServiceInput`, list/detail response schemas
- [x] 5.2 Export schemas from `package/contract` entry point

## 6. Admin API (`package/server`)

- [x] 6.1 Create `src/admin/jwt-service/jwt-service.service.ts` — service functions for list, fetch, create, update, activate, deactivate; each mutation calls `invalidateJwtService(serviceKey)` after DB write
- [x] 6.2 Create `src/admin/jwt-service/jwt-service.api.ts` — Elysia routes: `GET /admin/jwt-services`, `GET /admin/jwt-services/:serviceKey`, `POST /admin/jwt-services`, `PATCH /admin/jwt-services/:serviceKey`, `POST .../activate`, `POST .../deactivate`
- [x] 6.3 Mount admin JWT service API in server's admin route group
- [x] 6.4 Add input validation — 409 for duplicate serviceKey on create, 422 for invalid URL fields on update, 404 for non-existent serviceKey

## 7. API Client Hooks (`package/api`)

- [x] 7.1 Add query key factory for jwt-service admin endpoints (`['jwtServices']`, `['jwtServices', serviceKey]`)
- [x] 7.2 Add query option functions for list and detail endpoints
- [x] 7.3 Add mutation hooks for create, update, activate, deactivate with `queryClient.invalidateQueries` on success

## 8. Admin UI (`package/admin`)

- [x] 8.1 Create route entry at `routes/_admin/jwt-services.tsx` (lazy-loaded)
- [x] 8.2 Add navigation menu entry for "JWT Services" in admin layout
- [x] 8.3 Create list page with MUI table — columns: serviceKey, issuer, audience, isLocalIssuer, isActive
- [x] 8.4 Create detail/edit view — editable fields: issuer, audience, jwksUrl, jwksPath, isLocalIssuer; save button triggers PATCH mutation
- [x] 8.5 Add activate/deactivate toggle controls per record

## 9. Rotation Engine Decoupling (`package/jwt`)

- [x] 9.1 Review rotation engine interface — if `issuer` config is required at construction, refactor to accept `jwtServiceId` scope instead; update `JwtKeyPersistence` contract if needed
- [x] 9.2 Update `package/server` persistence adapter to use `jwtServiceId` scope instead of issuer string for key filtering
- [x] 9.3 Verify `package/auth` rotation usage is unaffected (out of scope but sanity check)

## 10. Validation and Cleanup

- [ ] 10.1 Build all affected packages (`package/server`, `package/contract`, `package/api`, `package/admin`, `package/jwt`) and fix compilation errors
- [ ] 10.2 Run existing tests in `package/server` and `package/jwt` — fix any failures from refactored imports
- [ ] 10.3 Add tests for cache layer — cache hit, cache miss, TTL expiry, explicit invalidation, concurrent bootstrap idempotency
- [ ] 10.4 Add tests for admin API — CRUD happy paths, 409 duplicate, 422 invalid URL, 404 not found, cache invalidation after mutation
- [x] 10.5 Run `bun run knip` at repo root — remove any unused exports introduced by the refactoring
