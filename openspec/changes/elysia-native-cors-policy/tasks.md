## 1. Shared Package Setup

- [ ] 1.1 Create `package/cors` workspace with `package.json` (`@package/cors`), `tsconfig.json`, and entry point `src/index.ts`
- [ ] 1.2 Define `CorsPolicyName` type and `CorsPolicyConfig` interface in `package/cors/src/types.ts`
- [ ] 1.3 Implement `applyHeaders(request, response, config)` utility — origin validation, method/header/credentials/expose header logic (~40 lines)
- [ ] 1.4 Implement `preflightResponse(request, config)` utility — returns 204 with CORS headers and `Access-Control-Max-Age`
- [ ] 1.5 Implement `corsPolicy(defaultPolicy, configs)` plugin factory — scoped `resolve` for default, `macro` for route override, `onRequest` for preflight, `onAfterHandle` for header application
- [ ] 1.6 Add unit tests for the shared plugin: default inheritance, route override, origin validation, credentials header, preflight interception, error response headers, scope isolation

## 2. Migrate `package/server`

- [ ] 2.1 Add `@package/cors` dependency to `package/server/package.json`
- [ ] 2.2 Create `package/server/src/cors/index.ts` thin wrapper: export `serverCorsPolicy(defaultPolicy)` that calls `corsPolicy()` with server-specific configs (`credentialedCorsConfig`, `publicCorsConfig`, `internalCorsConfig`), and re-export `allowedOrigins`
- [ ] 2.3 Migrate simple credentialed APIs (~13 files): replace `withCredentialedCors(coreInstance('/path'))` with `coreInstance('/path').use(serverCorsPolicy('credentialed'))`
- [ ] 2.4 Migrate `package/server/src/session/session.api.ts`: collapse two sub-routers into one using `serverCorsPolicy('credentialed')` + `{ corsPolicy: 'public' }` on the `/jwks` route
- [ ] 2.5 Remove `@elysiajs/cors` dependency from `package/server/package.json`
- [ ] 2.6 Delete old CORS module exports (old `package/server/src/cors/index.ts` content: `createCredentialedCors`, `withCredentialedCors`, `withPublicCors`, `withInternalCors`, `withCorsResponse`, `withPolicyCorsResponse`, `createCorsPreflightResponse`, `createPolicyCorsPreflightResponse`, CorsResponder instances)
- [ ] 2.7 Verify existing tests pass: `bun test` in `package/server` (especially `echokv.api.test.ts`)

## 3. Migrate `package/auth`

- [ ] 3.1 Add `@package/cors` dependency to `package/auth/package.json`
- [ ] 3.2 Create `package/auth/src/cors/index.ts` thin wrapper: export `authCorsPolicy(defaultPolicy)` with auth-specific configs, and re-export `allowedOrigins`
- [ ] 3.3 Migrate credentialed auth APIs (`sign-in.ts`, `password.ts`, `self-service.ts`, `organization.ts`, `admin.ts`, catch-all `index.ts`): replace `withCredentialedCors` with `.use(authCorsPolicy('credentialed'))`
- [ ] 3.4 Migrate public auth APIs (`oauth.ts`): replace `withPublicCors` with `.use(authCorsPolicy('public'))`
- [ ] 3.5 Migrate `package/auth/src/openapi/session.ts`: collapse sub-routers, use `authCorsPolicy('credentialed')` + `{ corsPolicy: 'public' }` on JWKS route
- [ ] 3.6 Remove `@elysiajs/cors` dependency from `package/auth/package.json`
- [ ] 3.7 Delete old CORS module exports from `package/auth/src/cors/index.ts`
- [ ] 3.8 Verify existing tests pass: `bun test` in `package/auth` (especially `auth-openapi.test.ts`)

## 4. Cleanup

- [ ] 4.1 Move spike test from `package/server/src/cors/macro-resolve-order.test.ts` into `package/cors` test suite (or delete if redundant with 1.6)
- [ ] 4.2 Run `bun run knip` at repo root to verify no unused exports remain
- [ ] 4.3 Verify both servers start successfully: `bun run server:dev` and auth dev server
