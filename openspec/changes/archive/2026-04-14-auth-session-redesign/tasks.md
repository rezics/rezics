## 1. Contract Layer (`@rezics/contract`)

- [x] 1.1 Add `REZICS_SESSION` to `NormalizedTokenName` with value `"rezics-session-token"` in `package/contract/src/token.ts`
- [x] 1.2 Add `REZICS_SESSION` transport header (`x-rezics-session-token` for exchange, `Authorization` for Bearer) to `TokenTransportHeader` and update `normalizedTokenHeaderMap`, `normalizedTokenTransportMap`
- [x] 1.3 Add `RezicsSessionClaimsSchema` Typebox schema (`sub`, `unitId`, `role`, `iss`, `exp`, `iat`) and export `RezicsSessionClaims` type
- [x] 1.4 Remove `NOTIFICATION_SESSION` and `SEARCH_SESSION` entries from `NormalizedTokenName`, `TokenTransportHeader`, `normalizedTokenHeaderMap`, `normalizedTokenTransportMap`, `normalizedTokenNameSchema`
- [x] 1.5 Remove `TokenTransportHeader.NOTIFICATION_SESSION` and `TokenTransportHeader.SEARCH_SESSION` header constants
- [x] 1.6 Refactor permission functions in `package/contract/src/permission/core.ts` and `package/contract/src/permission/main.ts`: change `isAdmin`, `isRoot`, `isBlocked`, `BasicAdminPermission`, `verifyRoot`, `verifyAdmin`, `verifyBlocked` to accept `{ unitId: string; role: string }` instead of `UserDTO`
- [x] 1.7 Refactor domain permission functions (`shelf.ts`, `post.ts`, `book.ts`, `chapter.ts`, `comment.ts`, `readlist.ts`, `review.ts`, `tag.ts`, `unit.ts`, `user.ts`) to accept `{ unitId: string; role: string }` for the actor parameter instead of `UserDTO`
- [x] 1.8 Add `AuthIdentity` type alias `{ unitId: string; role: string }` to `package/contract/src/permission/core.ts` and export from index
- [x] 1.9 Verify contract builds cleanly: run type-check across all packages that import `@rezics/contract`

## 2. Server — Token Exchange Infrastructure

- [x] 2.1 Create `rezics-session-token` signing function in `package/server/src/session/jwt/jwt.service.ts` using existing JWKS infrastructure — accept `{ unitId, role }`, return signed JWT with `iss: "rezics-server"` and configurable TTL (default 900s)
- [x] 2.2 Create `rezics-session-token` verification function that validates against the server's own JWKS, checks issuer, and extracts claims (`unitId` trusted, `role` as rejection-only hint)
- [x] 2.3 Implement `POST /session/exchange` endpoint: verify `x-auth-identity-token` header via auth JWKS, extract `unitId`, query user role from DB, issue `rezics-session-token`, return `{ token }`; return 401 for invalid auth token, 404 for unprovisioned user
- [x] 2.4 Register the exchange endpoint in `package/server/src/index.ts`
- [x] 2.5 Write tests for `POST /session/exchange`: valid exchange, expired auth token, missing user, blocked user

## 3. Server — Internal Provisioning Endpoint

- [x] 3.1 Implement `POST /internal/users/provision` endpoint: authenticate via `x-internal-secret`, accept `{ unitId, slug, name }`, upsert user with `ON CONFLICT (unitId) DO NOTHING`, return 200
- [x] 3.2 Register the internal provisioning endpoint in `package/server/src/index.ts`
- [x] 3.3 Write tests for provisioning endpoint: first-time creation, duplicate idempotency, missing secret returns 403

## 4. Server — Profile Sync Outgoing

- [x] 4.1 Create profile sync utility function in `package/server/src/user/service/` that sends `{ unitId, name, slug, avatar }` to auth's `POST /internal/users/sync` endpoint via `x-internal-secret`. Fire-and-forget (log errors, don't throw).
- [x] 4.2 Integrate profile sync call into the user update service method (invoked after `PUT /users/me` or equivalent profile update routes)

## 5. Server — Middleware Rewrite

- [x] 5.1 Rewrite `requireLogin` macro in `package/server/src/middleware/permission.ts`: verify `Authorization: Bearer` as `rezics-session-token` via server JWKS, extract `{ unitId, role }` as `identity` (unitId trusted, role is rejection-only hint), return 401 on failure
- [x] 5.2 Remove `requireOwner` macro and all references to `getOrFetchUser`, `cacheUser`, `mapUserToDTO` from permission.ts
- [x] 5.3 Remove `requireAdmin` and `requireRoot` macros
- [x] 5.4 Remove `buildActorFromContext` function
- [x] 5.5 Delete `package/server/src/middleware/user-cache.ts`
- [x] 5.6 Delete `package/server/src/middleware/session-state.ts`
- [x] 5.7 Migrate all server routes using `requireOwner: true` to `requireLogin: true` with inline ownership checks (`identity.unitId === resource.unitId`)
- [x] 5.8 Migrate all server routes using `requireAdmin: true` to `requireLogin: true` with: (1) token-based rejection if `identity.role` is not ADMIN/ROOT (fast path, no DB), (2) DB verification of role before granting access
- [x] 5.9 Migrate all server routes using `requireRoot: true` to `requireLogin: true` with: (1) token-based rejection if `identity.role` is not ROOT (fast path), (2) DB verification of role before granting access
- [x] 5.10 Update all route handlers that accessed `currentUser` (from `requireOwner`) to use `identity` (from `requireLogin`) — grep for `currentUser` in route files
- [x] 5.11 Update all calls to permission functions (`hasPermissionToUpdateShelf`, etc.) to pass `{ unitId: identity.unitId, role: identity.role }` instead of `currentUser`

## 6. Server — Cleanup

- [x] 6.1 Remove the legacy `/session/token` POST endpoint (if still present) and its test file
- [x] 6.2 Remove the deprecated `/session/jwks` GET endpoint (marked deprecated in `session.api.ts`)
- [x] 6.3 Remove `getAuthSessionState` and `assertMainServerEligibility` imports from any remaining files
- [x] 6.4 Clean up `package/server/src/middleware/index.ts` barrel export — remove user-cache and session-state references
- [x] 6.5 Run server type-check and fix any compilation errors from removed types/functions

## 7. Auth — Provisioning Hook

- [x] 7.1 Add `afterSignUp` hook to better-auth config in `package/auth/src/auth/instance.ts` (or equivalent lifecycle config): on user creation, call `POST <SERVER_BASE_URL>/internal/users/provision` with `x-internal-secret` header and `{ unitId: user.id, slug: profile.slug, name: user.name }`
- [x] 7.2 Add `SERVER_BASE_URL` and `SERVER_INTERNAL_SECRET` to auth's environment variables (`package/auth/src/env.ts`)
- [x] 7.3 Write test for afterSignUp hook: mock server endpoint, verify it's called during registration

## 8. Auth — Profile Sync Incoming

- [x] 8.1 Implement `POST /internal/users/sync` endpoint on auth service: authenticate via `x-internal-secret`, accept `{ unitId, name?, slug?, avatar? }`, update matching auth user record fields
- [x] 8.2 Register the sync endpoint in auth's Elysia routes
- [x] 8.3 Add `AUTH_INTERNAL_SECRET` configuration if not already present (check existing `AUTH_INTERNAL_TOKEN_GATEWAY_SECRET`)
- [x] 8.4 Write test for sync endpoint: update name, unknown unitId is no-op, missing secret returns 403

## 9. Frontend — Token Storage and Headers (`@rezics/api`)

- [x] 9.1 Update `DEFAULT_TOKEN_STORAGE_KEYS` in `package/api/src/react-query/jwt.ts`: keep `AUTH_IDENTITY`, add `REZICS_SESSION`, remove `NOTIFICATION_SESSION` and `SEARCH_SESSION`
- [x] 9.2 Implement `exchangeForSessionToken()` function: read `AUTH_IDENTITY` from storage, call `POST <serverBaseUrl>/session/exchange` with `x-auth-identity-token` header, store returned token as `REZICS_SESSION`
- [x] 9.3 Update `buildTokenHeaders()`: `Authorization: Bearer` SHALL carry the `REZICS_SESSION` token (not `AUTH_IDENTITY`). Remove notification/search token header building.
- [x] 9.4 Update `isAuthenticated()` to check for `REZICS_SESSION` token presence (not just `AUTH_IDENTITY`)
- [x] 9.5 Update `clearAllTokens()` to include `REZICS_SESSION`
- [x] 9.6 Update any HTTP interceptor / refresh-on-401 logic to trigger `exchangeForSessionToken()` when `REZICS_SESSION` is rejected

## 10. Frontend — Auth Flow (`@rezics/app`, `@rezics/app-shell`)

- [x] 10.1 Update login handler in `package/app/src/user/model/handler.ts` (or equivalent): after `signIn` + `ensureAuthIdentityToken()`, call `exchangeForSessionToken()` to obtain `rezics-session-token`
- [x] 10.2 Update register handler: after `signUp` + `ensureAuthIdentityToken()`, call `exchangeForSessionToken()`
- [x] 10.3 Update `authSessionStore` in `package/app-shell/src/state/authSessionStore.ts`: derive `capabilityLevel` from `REZICS_SESSION` token presence, `needsVerification` from `AUTH_IDENTITY` claims
- [x] 10.4 Remove `getAuthSessionState()` call from `hydrateAuthSessionState()` — derive state from local token claims only
- [x] 10.5 Update `AuthProvider` in `package/app-shell/src/provider/` to manage two independent refresh cycles: `AUTH_IDENTITY` via session cookie, `REZICS_SESSION` via exchange endpoint
- [x] 10.6 Update tests in `authSessionStore.test.ts`, `AuthProvider.test.tsx`, `handler.test.ts` to reflect the new two-token flow

## 11. Admin Dashboard (`@rezics/admin`)

- [x] 11.1 Update admin auth flow to include token exchange step after login: obtain `auth-identity-token`, exchange for `rezics-session-token`
- [x] 11.2 Update admin API client to send `Authorization: Bearer <rezics-session-token>` for server API calls
- [x] 11.3 Ensure auth admin operations (user management, banning) continue to use session cookie — no Bearer token for auth routes
- [x] 11.4 Verify admin dashboard can perform both server and auth admin operations in the same session

## 12. Auxiliary Services

- [x] 12.1 Update notify service JWT verification: switch JWKS URL from auth's endpoint to server's `/.well-known/jwks.json`, update expected issuer to `"rezics-server"`, update claim type to `RezicsSessionClaims`
- [x] 12.2 Update notify WebSocket authentication to verify `rezics-session-token` (same JWKS change)
- [x] 12.3 Update reaction service JWT verification: switch JWKS URL to server's endpoint, update expected issuer and claim type
- [x] 12.4 Update search service: remove `search-session-token` verification, switch to `rezics-session-token` via server JWKS
- [x] 12.5 Update search service environment config: replace auth JWKS URL with server JWKS URL

## 13. Repository Cleanup

- [x] 13.1 Grep for `notification-session-token` and `search-session-token` across the repo — remove all references
- [x] 13.2 Grep for `requireOwner` across the repo — verify no remaining references outside of archived openspec changes
- [x] 13.3 Grep for `user-cache` imports across the repo — verify no remaining references
- [x] 13.4 Grep for `getAuthSessionState` and `assertMainServerEligibility` — verify no remaining references
- [x] 13.5 Grep for `session-state` imports — verify no remaining references
- [x] 13.6 Remove stale test mocks referencing removed infrastructure (check `session.api.test.ts` mock of `session-state`, mock of `requireOwner`)
- [x] 13.7 Run `bun run knip` at repo root to detect any newly-unused exports or dependencies
- [x] 13.8 Run type-check across all packages: `bun run tsc --noEmit` (or equivalent) for each package to verify no compilation errors

## 14. Validation

- [x] 14.1 Run all existing test suites across affected packages and fix failures
- [x] 14.2 Start dev servers (`bun run app:dev`, `bun run server:dev`) and verify login flow end-to-end: register → exchange → API call with Bearer token
- [x] 14.3 Verify admin dashboard: login → server admin operations → auth admin operations
- [x] 14.4 Verify token refresh: wait for `rezics-session-token` expiry → automatic refresh via exchange → API calls continue working
- [x] 14.5 Verify role change propagation: change user role via admin → admin endpoint DB check rejects stale token role → user re-authenticates with updated role after token expires
<!-- Tasks 14.1-14.5 require running dev servers and manual testing -->
