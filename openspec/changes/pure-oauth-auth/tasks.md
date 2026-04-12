## 1. Enrich Access Token Claims (Auth)

- [x] 1.1 Update `definePayload` in `package/auth/src/auth/instance.ts` to include `name: user.name` and conditional `email_verified: false` (only when `!user.emailVerified`)
- [x] 1.2 Verify the enriched JWT payload by starting the auth dev server and inspecting a token from `/api/auth/token`

## 2. Contract Cleanup

- [x] 2.1 Remove `AUTH_CONTEXT` from `NormalizedTokenName`, `TokenTransportHeader`, `normalizedTokenHeaderMap`, `TokenContextKey`, and `normalizedTokenTransportMap` in `package/contract/src/token.ts`
- [x] 2.2 Remove `AuthContextTokenClaims` and `authContextTokenClaimsSchema` from `package/contract/src/token.ts`
- [x] 2.3 Remove `REZICS_SESSION` from `NormalizedTokenName`, `TokenTransportHeader`, `normalizedTokenHeaderMap`, `TokenContextKey`, and `normalizedTokenTransportMap` in `package/contract/src/token.ts`
- [x] 2.4 Remove `RezicsSessionTokenClaims`, `rezicsSessionTokenClaimsSchema`, `SessionPermissionSnapshot`, and `sessionPermissionSnapshotSchema` from `package/contract/src/token.ts`
- [x] 2.5 Remove the `SessionTokenResponse` / `sessionTokenResponseSchema` types if they are exclusively used by the eliminated `/session/token` endpoint
- [x] 2.6 Grep repo-wide for all removed exports and fix compile errors in consuming packages

## 3. Server User Cache

- [x] 3.1 Create `package/server/src/middleware/user-cache.ts` with an in-memory `Map<unitId, { user, expiresAt }>`, exporting `getOrFetchUser(unitId)`, `cacheUser(unitId, user)`, and `invalidate(unitId)` with configurable TTL (default 300s)
- [x] 3.2 Integrate cache invalidation into admin user-update/role-change endpoints

## 4. Refactor Permission Macros

- [x] 4.1 Update `requireOwner` in `package/server/src/middleware/permission.ts`: remove `rezicsSessionToken` dependency, resolve user via user cache (with lazy provisioning on cache+DB miss), resolve `{ identity, currentUser }` (no `session`)
- [x] 4.2 Add lazy provisioning logic inside `requireOwner`: on user-not-found, upsert from token claims (`sub`/`unitId`, `slug`, `name`) via `userService.provisionFromJwt()`, then cache the result
- [x] 4.3 Update `requireAdmin` and `requireRoot` to check `currentUser.permission.role` from the cached user instead of `session.permission.role`
- [x] 4.4 Add optional `requireVerified` flag or integrate `email_verified: false` check into `requireOwner` for endpoints that gate on verification
- [x] 4.5 Remove the `session` property from the resolved context type. Grep all route handlers that reference `session.permission.role` or `ctx.session` and migrate to `currentUser.permission.role`

## 5. Remove Server Session Infrastructure

- [x] 5.1 Delete the `POST /session/token` route from `package/server/src/session/session.api.ts` (keep the JWKS endpoint if still needed, or remove it too if server no longer signs tokens)
- [x] 5.2 Delete `package/server/src/middleware/session-state.ts` (`getAuthSessionState` and `assertMainServerEligibility`)
- [x] 5.3 Remove `server-local` JWT service bootstrap from `package/server/src/index.ts` (the server no longer issues tokens — only `auth-upstream` verifier is needed)
- [x] 5.4 Remove the `rezicsSessionToken` token resolver plugin registration from `package/server/src/index.ts`
- [x] 5.5 Remove the `mainSessionJwtPlugin` and related signing infrastructure from `package/server/src/session/jwt/jwt.service.ts`

## 6. Remove Explicit Ensure Endpoint

- [x] 6.1 Remove the `GET /users/ensure` route from `package/server/src/user/api/user.core.api.ts`
- [x] 6.2 Remove the `verifyAuthContextToken` utility import and usage from user routes
- [x] 6.3 Verify that `GET /users/me` and `PUT /users/me` still work via the `requireOwner` macro with lazy provisioning

## 7. Simplify Frontend Auth Handlers

- [x] 7.1 Rewrite `login()` in `package/app/src/user/model/handler.ts`: call `authApi.signIn()` → `ensureAuthIdentityToken()` → derive auth state from token claims. Remove the `canAcquireMemberToken` check and `establishBusinessSession()` call
- [x] 7.2 Rewrite `register()` similarly: call `authApi.signUp()` → `ensureAuthIdentityToken()` → derive auth state
- [x] 7.3 Delete `establishBusinessSession()` entirely from `handler.ts`
- [x] 7.4 Remove `userApi.ensure()` and `userApi.issueSessionToken()` from `package/api/src/user/user.api.ts`
- [x] 7.5 Remove `authApi.getContextToken()` from `package/api/src/auth/auth.api.ts` (if the auth endpoint is also removed)

## 8. Simplify Frontend State and Refresh

- [x] 8.1 Simplify `useAuthSessionStore` in `package/app-shell/src/state/authSessionStore.ts`: remove `hasBusinessToken`, `syncBusinessToken`, and the `guest` capability level. Levels become `anonymous` | `member`. Derive `needsVerification` from access token's `email_verified` claim
- [x] 8.2 Simplify `AuthProvider.tsx` in `package/app-shell/src/provider/`: remove Phase 2 (service token refresh). AuthProvider manages only the gateway access token refresh cycle
- [x] 8.3 Remove the `REZICS_SESSION` default entry from the token refresh registry in `package/api/src/react-query/tokenRefreshRegistry.ts`
- [x] 8.4 Remove `setToken(…, REZICS_SESSION)` and `clearToken(…, REZICS_SESSION)` calls throughout the frontend
- [x] 8.5 Update `resolvePostAuthDestination()` in `package/app/src/user/model/authRedirect.ts` to derive `needsVerification` from access token `email_verified` claim instead of session state

## 9. Update API Client Headers

- [x] 9.1 Remove `x-rezics-session-token` header injection from API client request interceptors in `package/api/`
- [x] 9.2 Remove `x-auth-context-token` header injection from API client request interceptors
- [x] 9.3 Verify that all API calls to server, notify, and reaction use only `Authorization: Bearer` header

## 10. Notify and Reaction Alignment (Optional)

- [x] 10.1 Update the `AuthIdentityTokenClaims` type reference in `package/notify/src/macro/auth.ts` if the claim shape changed (add `name`, optional `email_verified`)
- [x] 10.2 Update the `AuthIdentityTokenClaims` type reference in `package/reaction/src/macro/auth.ts` similarly
- [x] 10.3 Verify both services still validate tokens correctly against auth's JWKS

## 11. Validation

- [x] 11.1 Run `bun run build` in `package/contract`, `package/server`, `package/api`, `package/app-shell`, and `package/app` to verify compile
- [x] 11.2 Run existing tests in `package/server` and `package/auth`
- [ ] 11.3 Start dev servers (`bun run server:dev`, `bun run app:dev`) and manually test: register → verify token contents → first API call provisions user → subsequent calls use cache
- [x] 11.4 Run `bun run knip` at root to detect unused exports left behind by removals
