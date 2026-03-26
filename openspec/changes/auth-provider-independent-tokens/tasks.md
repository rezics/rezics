## 1. Token Refresh Registry

- [x] 1.1 Create `package/api/src/react-query/tokenRefreshRegistry.ts` — define `TokenRefreshFn` type (`() => Promise<{token: string}>`), `TokenRefreshRegistry` type (`Partial<Record<NormalizedTokenName, TokenRefreshFn>>`), and `createTokenRefreshRegistry(overrides?)` factory that merges overrides with defaults.
- [x] 1.2 Add default registry entry for `REZICS_SESSION` — calls `userApi.issueSessionToken()`, syncs `useAuthSessionStore.getState().syncBusinessToken(token)`, returns `{token}`.
- [x] 1.3 Export `createTokenRefreshRegistry`, `TokenRefreshRegistry`, and `TokenRefreshFn` from `package/api/src/react-query/tokenRefreshRegistry.ts` and from the `@package/api` barrel.
- [x] 1.4 Add tests for `createTokenRefreshRegistry`: default entries present, override replaces default, custom entries merge with defaults, missing entry returns undefined.

## 2. Refactor AuthProvider to Gateway + Fan-Out Model

- [x] 2.1 Update `AuthProviderProps` to accept optional `registry?: TokenRefreshRegistry` prop alongside `tokens`. Default `tokens` to `[NormalizedTokenName.AUTH_IDENTITY]` when omitted.
- [x] 2.2 Remove the hardcoded `refreshToken()` switch statement. Replace with: gateway phase calls `queryAccessToken()` for `AUTH_IDENTITY`; service phase looks up `registry[tokenName]()` for each service token.
- [x] 2.3 Refactor `runRefreshCycle()` — first refresh `AUTH_IDENTITY` (gateway). If gateway fails non-retryably, call `handleAuthSessionExpired()` and return. If gateway succeeds, collect all service tokens that need refresh and process them via `Promise.allSettled()`.
- [x] 2.4 Handle per-token results from `Promise.allSettled()` — for each settled result: success → `setToken()` + state='managing' + reset retry; retryable error → schedule retry for that token; non-retryable → state='dormant'. No token blocks another.
- [x] 2.5 Update `computeNextRefreshDelay()` to also consider retry delays for tokens in backoff state, not just expiry times.
- [x] 2.6 Remove direct imports of `userApi` from `AuthProvider.tsx`. AuthProvider SHALL only import from `@package/api/react-query/*` and `@package/contract`.

## 3. Update Consuming Apps

- [x] 3.1 Update `package/app/src/app/App.tsx` — pass `registry={createTokenRefreshRegistry()}` to AuthProvider alongside the existing `tokens` prop.
- [x] 3.2 Update `package/admin/src/app/App.tsx` — pass `tokens={[AUTH_IDENTITY, REZICS_SESSION]}` and `registry={createTokenRefreshRegistry()}` to AuthProvider. Remove the proxy `AuthProvider.tsx` if it was re-added.
- [x] 3.3 Verify that admin `_admin.tsx` route guard still works with the new AuthProvider configuration (role check via `getToken` + `parseJwt`).

## 4. Tests and Validation

- [x] 4.1 Add AuthProvider unit tests: gateway failure stops all service tokens; one service token dormant doesn't affect others; parallel refresh via `Promise.allSettled`; missing registry entry → dormant.
- [x] 4.2 Run existing test suites: `bun test` in `package/api`, `package/app-shell`, `package/app`, `package/server`. Fix any regressions.
- [x] 4.3 Type-check affected packages: `tsc --noEmit` for `package/app-shell`, `package/app`, `package/admin`. Verify no new errors introduced.
