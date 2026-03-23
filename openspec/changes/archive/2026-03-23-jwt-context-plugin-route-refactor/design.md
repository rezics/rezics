## Context

The server currently uses two Elysia context plugins (`identityContextPlugin`, `sessionContextPlugin`) defined in `package/server/src/auth/context.ts`. These plugins combine JWT parsing, cross-token validation, user loading, and authorization into monolithic `.derive()` blocks. Every protected route must wrap itself in `new Elysia().use(sessionContextPlugin)`, creating ~30 inline Elysia sub-instances across the codebase.

Additionally, `package/server/src/core.ts` provides a `coreInstance(prefix)` factory that bundles `mainSessionJwtPlugin` into every domain API, adding another layer of indirection.

Current verification options are built dynamically per-call through `package/server/src/user/util/index.ts` (`verifyAuth`, `verifyAuthIdentityToken`, etc.), which fetch JWT service records from a cache at request time.

### Current flow

```
request → domain.api.ts
           └→ new Elysia().use(sessionContextPlugin)
               └→ .derive() runs:
                   1. verifyAuth(headers.authorization)     ← identity parsing
                   2. verifySessionToken(headers[...])      ← session parsing
                   3. unitId cross-check                    ← authorization
                   4. userService.getByUnitId()             ← data loading
                   5. role snapshot check                   ← authorization
                   6. BLOCKED check                         ← authorization
               └→ handler receives { identity, session, currentUser }
```

## Goals / Non-Goals

**Goals:**
- Separate JWT token parsing (shared, root-level) from authorization (route-level scoped guards)
- Provide typed token payloads directly on Elysia context (`authIdentityToken`, `rezicsSessionToken`) via a reusable plugin factory in `@package/jwt`
- Replace all inline `new Elysia()` sub-instances in domain APIs with flat route chains
- Establish a standard permission guard pattern (`requireLogin`, `requireAdmin`, `requireOwner`) with domain-extensible permission files
- Remove `core.ts` and the `coreInstance()` factory
- Use Elysia `resolve` with `as: 'global'` for token injection (runs after validation, before handler)

**Non-Goals:**
- Changing HTTP API contracts (routes, request/response shapes)
- Modifying the JWT verification algorithm or key resolution logic in `@package/jwt`
- Adding cookie or query-string JWT transport
- Modifying the auth server or `@package/auth`
- Refactoring `@package/contract` token type definitions

## Decisions

### 1. Per-token factory plugin using `resolve` with `as: 'global'`

**Decision:** Create a `createTokenResolver<Name, TPayload>(name, config)` factory in `@package/jwt/src/adapters/` that returns an Elysia plugin. Each call produces one plugin for one token type.

**Why `resolve` over `derive`:** Elysia docs recommend `resolve` for request-scoped context that doesn't need to run before validation. It executes at `beforeHandle` with typed request properties.

**Why `as: 'global'`:** Tokens are registered once at the app root and must be visible to all domain APIs mounted via `.use()`.

**Why per-token factory over multi-token bundle:** Simpler typing (one generic per plugin), standard Elysia `.use()` composition, independent registration order.

**Type assertion:** The factory uses `as { [K in Name]: TPayload | null }` on the resolve return because TypeScript erases literal types from computed property keys. This is a single, bounded assertion at the plugin boundary.

**Alternatives considered:**
- Multi-token config object with mapped types → complex Elysia generic threading, not proven to work
- `derive` instead of `resolve` → runs before validation, less type safety on inputs
- `decorate` → static injection, cannot be request-scoped

### 2. Scoped guard plugins for authorization

**Decision:** Create permission guard plugins in `package/server/src/auth/auth.permission.ts` that use `resolve` with `as: 'scoped'`. These consume the globally-injected token payloads and enforce authorization rules.

**Guards:**
- `requireLogin` — requires `authIdentityToken` to be present, resolves `identity` with normalized `unitId`
- `requireAdmin` — chains on `requireLogin`, additionally requires `rezicsSessionToken`, validates role snapshot, loads persisted user, checks admin permission. Resolves `{ currentUser }`
- `requireOwner` — chains on `requireLogin`, requires `rezicsSessionToken`, validates ownership (unitId match between identity and session). Resolves `{ currentUser }`

**Why scoped:** Guards apply from the `.use()` point onward in a route chain. `as: 'scoped'` makes the resolved values available to routes after the guard but not to unrelated route groups.

**Domain extensions:** Domains with custom permission logic (e.g., `hasPermissionToUpdateBook`) create a `{domain}.permission.ts` file with scoped guard plugins that chain on the base guards.

### 3. Verifier initialization at startup

**Decision:** Build `JwtVerifier<T>` instances during server startup (after `bootstrapJwtServiceRecord` completes) and pass them to `createTokenResolver`. This avoids per-request JWT service lookups.

**Current problem:** `verifyAuth()` and `verifySessionToken()` call `getJwtService('auth-upstream')` on every request to build verification options. After refactoring, the verifier is created once with the bootstrapped config and closed over by the resolver plugin.

**Alternative considered:** Lazy verifier that fetches config on first use → adds unnecessary complexity when we already have a startup bootstrap phase.

### 4. Remove `core.ts` and flatten domain APIs

**Decision:** Each domain API file creates `new Elysia({ prefix: '/domain' })` directly. CORS is handled by the `corsPolicy` plugin from the parallel `elysia-native-cors-policy` change — each domain applies `.use(serverCorsPolicy('credentialed'))` at the top of its chain. `mainSessionJwtPlugin` is no longer used — session JWT signing moves to a `decorate` at root or remains in the session API only.

**Target pattern for domain APIs:**
```
export const bookApi = new Elysia({ prefix: '/books' })
  .use(serverCorsPolicy('credentialed'))  // CORS (from elysia-native-cors-policy change)
  .get('/:unitId', handler)               // public
  .get('/:unitId/rating', handler)        // public
  .use(requireOwner)                      // guard: everything below needs auth
  .get('/', handler)                      // protected
  .post('/', handler)                     // protected
  .put('/:unitId', handler)              // protected
  .delete('/:unitId', handler)           // protected
```

### 5. Token context key naming convention

**Decision:** Context keys follow `camelCase(NormalizedTokenName key) + Token`:
- `AUTH_IDENTITY` → `authIdentityToken`
- `REZICS_SESSION` → `rezicsSessionToken`
- `AUTH_CONTEXT` → `authContextToken`

These are defined as constants in `@package/contract` alongside the existing `NormalizedTokenName` to keep naming centralized.

## Risks / Trade-offs

**[Every request verifies all configured tokens]** → The global resolver runs on every request, including public routes where tokens are absent. For absent tokens it returns `null` immediately (no crypto work). Present-but-invalid tokens fail with 401 even on public routes — this is intentional (don't silently accept bad tokens).

**[Type assertion at plugin boundary]** → The `as { [K in Name]: ... }` cast means the compiler trusts the plugin author. Mitigating: the assertion is small, bounded, and covered by tests.

**[Large refactor surface]** → ~15 domain API files need rewriting. Mitigating: each file is independent, the HTTP API contract doesn't change, and existing tests validate behavior.

**[Startup-time verifier binding]** → If JWT service config changes at runtime (e.g., JWKS URL rotation), the verifier won't pick it up. Mitigating: JWKS key rotation is handled by `jose`'s remote JWKS set which re-fetches automatically. The service record (issuer, audience) is static.

**[CORS handling]** → Removing `withCredentialedCors(coreInstance(...))` is handled by the parallel `elysia-native-cors-policy` change. Each domain applies `serverCorsPolicy('credentialed')` from the new `@package/cors` shared package. Mixed-policy routers (session API) use a route-level `{ corsPolicy: 'public' }` macro override. Domain API refactoring (Phase 4) applies both changes in a single pass per file.
