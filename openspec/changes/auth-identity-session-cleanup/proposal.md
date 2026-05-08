## Why

Four interconnected forms of drift have accumulated in the auth/identity layer and need to be cleaned up in one cutover:

1. The `User` table's primary key is misleadingly named `unitId` even though `User` is **not** a `Unit` subtype (no FK from `User.unitId` to `Unit.id`); a user is independent first-class content with its own `slug`, and conflating the two has leaked into ~115 server files and ~555 frontend references.
2. `User.accountStatus` (`PROFILE_SETUP_REQUIRED` | `MEMBER_READY`) duplicates the readiness signal that `slug !== null` already conveys, and the gate is enforced inconsistently across endpoints.
3. The legacy JWT-in-header session path (`POST /session/exchange` + `x-auth-session-token` + the `auth-upstream` JWKS verifier) is dead code: there are zero callers in `package/api`, `package/auth`, or any monorepo consumer; cookie-based `/auth/session/refresh` already covers all browser flows, while API tokens use `/token/session`.
4. The seed pipeline writes server users without corresponding auth users (mock users cannot log in), and the cross-seed flow interleaves auth + main writes per user instead of phasing them, making partial failures asymmetric.

Doing this as one change preserves a coherent narrative — "user identity is a first-class, slug-keyed entity; sessions live in cookies; seed mirrors production" — and avoids interim states where (e.g.) the schema has moved but contract/frontend still call the old field.

## What Changes

- **BREAKING** Rename `User.unitId` → `User.userId` (primary key); update all FK relations referencing it (`Unit.userId`, `WorkLinkClaim.claimerUserId/resolvedBy`, `UserUnitProgress.userId`, `Follow.followerId/followingId`, `ApiToken.userId`, etc.) to `references: [userId]`.
- **BREAKING** Drop `User.accountStatus` field, the `UserAccountStatus` enum, and the `@@index([accountStatus])`; replace all usages with `slug !== null` / `slug === null` predicates.
- **BREAKING** Delete the JWT-header session pathway end-to-end:
  - Remove `POST /session/exchange` and its tests
  - Remove the deprecated `POST /session/jwks` (covered by `/.well-known/jwks.json`)
  - Remove the `auth-upstream` JWT service bootstrap and `getJwtService("auth-upstream")` callers
  - Remove `package/server/src/user/utils/index.ts` (`buildTrustedAuthVerifyOptions`, `buildAuthVerifyOptions`, `verifyAuthToken` — exported but uncalled)
  - Remove `verifyAuth` / `verifyAuthSessionToken` from `@rezics/auth` exports
  - Remove `x-auth-session-token` from CORS `allowedHeaders` in both `package/server` and `package/auth`
  - Remove `env.SERVER_BASE_URL` from `package/auth` (declared, never used)
- **BREAKING** Contract (`package/contract/src/token.ts`) cleanup:
  - Remove `NormalizedTokenName.AUTH_SESSION`
  - Remove `TokenTransportHeader.AUTH_SESSION_EXCHANGE` constant
  - Remove `AuthSessionTokenClaims` schema and its `normalizedTokenHeaderMap` / `normalizedTokenTransportMap` / `TokenContextKey` entries
  - Drop the redundant `role` claim from `RezicsSessionClaims` (keep only `permission.role`)
  - Rename DTO field `unitId` → `userId` on `User`-shaped contracts
- **BREAKING** Frontend `package/api/src/react-query/jwt.ts` cleanup:
  - Remove `tokenStrategy.storeKeyByToken` machinery, `getToken`/`setToken`/`removeToken`/`writeAuthSnapshot`/`readStoredToken`/`isAuthenticated` (all no-ops or legacy localStorage cleanup)
  - Remove `AUTH_TOKEN_STORAGE_EVENT`
  - `exchangeForSessionToken()` keeps the same name but only calls `/auth/session/refresh`
- **BREAKING** Seed pipeline restructure:
  - Two-phase seed: complete `seedAllAuthUsers()` first, then `seedAllMainUsers()` using the captured `{email → authUserId}` map
  - Factory mock seeding (`package/server/prisma/factory/users.ts`) cross-seeds: each mock user is created in auth first via `seedAuthUser`, then in main with `userId = authUserId` and `authUserId` set
  - Factory orchestrator/strategy threads `authPrisma` through the `SeedCtx`
  - `resetDatabase` resets both auth and server DBs (currently only server)
  - Drop `accountStatus` writes from both `seedServerUser` and factory `seedUsers`
- Update JWT claim handling: `signRezicsSessionToken` and `signRezicsProfileSetupToken` already accept `userId`; the consumer `/session/exchange`'s `claims.unitId || claims.sub` fallback dies with the endpoint.
- Single Prisma migration captures schema changes; per CLAUDE.md "Development-Stage Compatibility", no compatibility aliases or dual-read shims are introduced.

## Capabilities

### New Capabilities

None. This change consolidates and cleans up existing capabilities.

### Modified Capabilities

- `server-access-token`: Remove all `/session/exchange` references; remove the redundant `role` claim from `rezics-session-token`; assert that `auth-session-token` is never sent through `Authorization` or `x-auth-session-token` (already a SHALL NOT, but supporting endpoint goes away).
- `unified-access-token`: Remove the section that names `auth-session-token` as a JWT-in-header exchange/refresh credential; the only auth credential crossing the main boundary is the opaque session cookie.
- `server-permission-model`: Replace the requirement specifying behavior of `POST /session/exchange` with the equivalent requirement on `POST /auth/session/refresh`.
- `dispatch-token-session`: Define the `rezics-session-token` claim schema directly instead of referencing `/session/exchange`.
- `token-refresh-registry`: Remove the `AUTH_SESSION` registry entry; only `REZICS_SESSION` (refreshed via `/auth/session/refresh`) remains as a refreshable token.
- `exchange-auto-provision`: **Archived in full** — eager provisioning via JWT exchange has already been removed from the auth service; the spec describes behavior that no longer exists.
- `identity-claim-consistency`: Update to reflect `User.userId` as the primary key name; `sub === userId` (no `unitId` claim).
- `lazy-user-provisioning`: Provisioning happens in `materializeMainAccountFromAuth` / `refreshMainSessionFromAuth` via the cookie boundary; remove any mention of exchange-time provisioning.
- `main-owned-account-registration`: Readiness is `slug !== null`; remove `accountStatus` references.
- `main-auth-public-boundary`: Confirm the boundary remains cookie-only (no header-based credential acceptance).
- `opaque-auth-session-refresh`: Sole browser path for obtaining a session JWT; minor wording updates if it referenced exchange parity.
- `server-user-cache`: Cache key/lookup field renames `unitId` → `userId`.
- `infra-seed`: Two-phase auth-then-main ordering; factory mock users cross-seed auth.
- `user-brief-api` and `user-domain-decoupling`: DTO field rename `unitId` → `userId` on user-shaped responses.
- `app-auth-onboarding`, `frontend-auth-state-separation`, `auth-token-lifecycle-provider`, `main-token-wallet-context`: Remove references to the AUTH_SESSION token name and JWT-header pathway in the frontend token model.

## Impact

**Affected packages:**

- `package/server` — schema, migration, all `where: { unitId: ... }` user queries, `auth-boundary/*`, `session/session.api.ts` (large delete), `meili/user/sync.ts`, `middleware/permission.ts`, `user/utils/index.ts` (delete), `user/service/*`, `user/api/*`, `user/models/mapper.ts`, `index.ts` (CORS + bootstrap), tests
- `package/auth` — `session/jwt/verify.ts` exports (delete), `index.ts` CORS, `env.ts` (drop `SERVER_BASE_URL`), tests
- `package/contract` — `token.ts` (large delete + rename), `user.ts` (DTO `unitId → userId`), tests
- `package/api` — `react-query/jwt.ts` (large delete), `react-query/http.ts`, `providers/AuthProvider.tsx`, `states/authSessionModel.ts`, `auth/*.ts`, hooks consuming user DTOs
- `package/app`, `package/admin` — every reference to `user.unitId` on a user DTO; routes under `/_mainLayout/user/me/*`, profile pages, components reading `unitId` from the user contract
- `package/utils` — `seed/users.ts` (split into two phases), `seed/index.ts` (orchestration), `lib/prisma-factory.ts` (no change expected, just re-exports)
- `package/server/prisma/factory` — `users.ts` (cross-seed), `orchestrator.ts`, `strategy.ts`, `types.ts` (`SeedCtx` carries `authPrisma`), `index.ts`
- `package/notify`, `package/reaction` — only consume `REZICS_SESSION`, no functional change but `NormalizedTokenName.AUTH_SESSION` removal must not break their imports
- `package/jwt` — `adapter/jose-verifier.ts` defaults `NormalizedTokenName.AUTH_SESSION` everywhere; default needs to be re-pointed to `REZICS_SESSION` or made required
- `package/ui`, `package/app-shell`, `package/search` — incidental imports if any consume user DTOs

**Database migrations:** one Prisma migration on `package/server` (rename PK column, drop `accountStatus`, drop enum, drop index, update FK targets). Auth DB unchanged. Migration is destructive in the sense that the column is renamed in place; existing data is preserved.

**Breaking-change posture:** Per project CLAUDE.md "Development-Stage Compatibility", no compatibility aliases, no dual-read shims, no legacy field re-exports. Single cutover. All internal call sites updated in the same change.

**Testing:** Existing tests under `auth-boundary/*.test.ts`, `session/session.api.test.ts`, `middleware/permission.test.ts`, `user/api/*.test.ts`, `factory/presets.test.ts` will need updates or deletion (the `session.api.test.ts` for `/session/exchange` is deleted with the endpoint). New tests verify that `slug !== null` is the readiness gate and that factory mock users can complete a full sign-in round-trip.

**Out of scope (explicit non-goals):**

- Strict-typing `User.permission` JSON column — tracked separately under the `typed-json-fields` direction.
- Restructuring the two-cookie split (`rezics-session-token` vs `rezics-profile-setup-token`) — they grant different scopes and the split is intentional.
- Touching API-token (`api_*` Bearer) flows under `/token/*` and `/dispatch/*`.
- Renaming any `Unit.userId` FK column (the field is already correctly named; only the target reference changes).
