## 1. Shared Package Setup

- [ ] 1.1 Create `package/cors` workspace with `package.json` (`@package/cors`), `tsconfig.json`, and entry point `src/index.ts`
- [ ] 1.2 Define `CorsPolicyName` type and `CorsPolicyConfig` interface in `package/cors/src/types.ts`
- [ ] 1.3 Implement `applyHeaders(request, response, config)` utility — origin validation, method/header/credentials/expose header logic (~40 lines)
- [ ] 1.4 Implement `preflightResponse(request, config)` utility — returns 204 with CORS headers and `Access-Control-Max-Age`
- [ ] 1.5 Implement `corsPolicy(defaultPolicy, configs)` plugin factory — scoped `resolve` for default, `macro` for route override, `onRequest` for preflight, `onAfterHandle` for header application
- [ ] 1.6 Add unit tests for the shared plugin: default inheritance, route override, origin validation, credentials header, preflight interception, error response headers, scope isolation

## 2. Service-Specific Wrappers

- [ ] 2.1 Add `@package/cors` dependency to `package/server/package.json`
- [ ] 2.2 Create `package/server/src/cors/index.ts` thin wrapper: export `serverCorsPolicy(defaultPolicy)` that calls `corsPolicy()` with server-specific configs (`credentialedCorsConfig`, `publicCorsConfig`, `internalCorsConfig`), and re-export `allowedOrigins`
- [ ] 2.3 Add `@package/cors` dependency to `package/auth/package.json`
- [ ] 2.4 Create `package/auth/src/cors/index.ts` thin wrapper: export `authCorsPolicy(defaultPolicy)` with auth-specific configs, and re-export `allowedOrigins`

## 3. Migrate `package/server` Domain APIs

> **Coordination note:** This phase runs in parallel with `jwt-context-plugin-route-refactor` change. Each domain API is rewritten ONCE applying both CORS plugin migration and JWT flattening together. The target pattern for every domain API is:
>
> ```ts
> export const bookApi = new Elysia({ prefix: '/books' })
>   .use(serverCorsPolicy('credentialed'))   // ← from this change
>   .get('/:unitId', handler)                // public route
>   .use(requireOwner)                       // ← from JWT change
>   .post('/', handler)                      // protected route
> ```
>
> `withCredentialedCors(coreInstance(...))` is replaced with `new Elysia({ prefix }).use(serverCorsPolicy(...))` in the same edit that flattens sub-instances.

- [ ] 3.1 Migrate simple credentialed APIs (~13 files): replace `withCredentialedCors(coreInstance('/path'))` with `new Elysia({ prefix: '/path' }).use(serverCorsPolicy('credentialed'))` (done jointly with JWT change task 4.x for each file)
- [ ] 3.2 Migrate `session/session.api.ts`: single flat chain with `.use(serverCorsPolicy('credentialed'))` + `{ corsPolicy: 'public' }` on `/jwks` route (done jointly with JWT change task 4.14)
- [ ] 3.3 Remove `@elysiajs/cors` dependency from `package/server/package.json`
- [ ] 3.4 Delete old CORS module exports from `package/server/src/cors/index.ts`: `createCredentialedCors`, `withCredentialedCors`, `withPublicCors`, `withInternalCors`, `withCorsResponse`, `withPolicyCorsResponse`, `createCorsPreflightResponse`, `createPolicyCorsPreflightResponse`, CorsResponder instances
- [ ] 3.5 Verify existing tests pass: `bun test` in `package/server` (especially `echokv.api.test.ts`)

## 4. Migrate `package/auth`

- [ ] 4.1 Migrate credentialed auth APIs (`sign-in.ts`, `password.ts`, `self-service.ts`, `organization.ts`, `admin.ts`, catch-all `index.ts`): replace `withCredentialedCors` with `.use(authCorsPolicy('credentialed'))`
- [ ] 4.2 Migrate public auth APIs (`oauth.ts`): replace `withPublicCors` with `.use(authCorsPolicy('public'))`
- [ ] 4.3 Migrate `package/auth/src/openapi/session.ts`: collapse sub-routers, use `authCorsPolicy('credentialed')` + `{ corsPolicy: 'public' }` on JWKS route
- [ ] 4.4 Remove `@elysiajs/cors` dependency from `package/auth/package.json`
- [ ] 4.5 Delete old CORS module exports from `package/auth/src/cors/index.ts`
- [ ] 4.6 Verify existing tests pass: `bun test` in `package/auth` (especially `auth-openapi.test.ts`)

## 5. Cleanup

- [ ] 5.1 Move spike test from `package/server/src/cors/macro-resolve-order.test.ts` into `package/cors` test suite (or delete if redundant with 1.6)
- [ ] 5.2 Run `bun run knip` at repo root to verify no unused exports remain
- [ ] 5.3 Verify both servers start successfully: `bun run server:dev` and auth dev server
