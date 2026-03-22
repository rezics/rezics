## 1. Token Resolver Plugin (`@package/jwt`)

- [ ] 1.1 Create `package/jwt/src/adapters/elysia-token-resolver.ts` with `createTokenResolver<Name, TPayload>(name, config)` factory. Implement `resolve` with `as: 'global'`, bearer extraction, null-on-absent, and error-on-invalid semantics
- [ ] 1.2 Export `createTokenResolver` from `package/jwt/src/adapters/export.ts` and `package/jwt/src/export.ts` (root)
- [ ] 1.3 Add context key name constants to `@package/contract` (e.g., `TokenContextKey.AUTH_IDENTITY = 'authIdentityToken'`) alongside existing `NormalizedTokenName`
- [ ] 1.4 Write tests in `package/jwt/src/adapters/elysia-token-resolver.test.ts`: absent header → null, valid token → payload, invalid token → 401, bearer extraction, multiple resolvers compose, deduplication

## 2. Permission Guards (`package/server`)

- [ ] 2.1 Create `package/server/src/auth/auth.permission.ts` with `requireLogin` guard: reads `authIdentityToken` from context, resolves `{ identity }` with normalized `unitId`, throws 401 if null
- [ ] 2.2 Add `requireOwner` guard to `auth.permission.ts`: chains on `requireLogin`, requires `rezicsSessionToken`, validates unitId match, loads persisted user, checks role snapshot, resolves `{ identity, session, currentUser }`
- [ ] 2.3 Add `requireAdmin` guard to `auth.permission.ts`: chains on `requireOwner`, additionally checks admin permission via `BasicAdminPermission`
- [ ] 2.4 Move `buildActorFromContext` to `auth.permission.ts` or a shared auth utility
- [ ] 2.5 Write tests for permission guards: login pass/fail, admin pass/fail, owner pass/fail, blocked user rejection, unitId mismatch

## 3. Root-Level Token Registration (`package/server/src/index.ts`)

- [ ] 3.1 Refactor `index.ts`: after `bootstrapJwtServiceRecord` resolves, create `JwtVerifier` instances for `authIdentityToken` (from `auth-upstream` config) and `rezicsSessionToken` (from `server-local` config)
- [ ] 3.2 Register `createTokenResolver('authIdentityToken', ...)` and `createTokenResolver('rezicsSessionToken', ...)` on the root Elysia app before domain API `.use()` calls
- [ ] 3.3 Remove `mainSessionJwtPlugin` import from root registration path (keep only in session API for signing)

## 4. Domain API Refactoring

> **Coordination note:** This phase runs in parallel with `elysia-native-cors-policy` change. Each domain API is rewritten ONCE applying both JWT flattening and CORS plugin migration together. The target pattern for every domain API is:
>
> ```ts
> export const bookApi = new Elysia({ prefix: '/books' })
>   .use(serverCorsPolicy('credentialed'))   // ← from CORS change
>   .get('/:unitId', handler)                // public route
>   .use(requireOwner)                       // ← guard from JWT change
>   .post('/', handler)                      // protected route
> ```
>
> `coreInstance` and `withCredentialedCors` are both removed in the same edit.

- [ ] 4.1 Refactor `book.api.ts`: flatten to single `new Elysia({ prefix: '/books' })`, add `.use(serverCorsPolicy('credentialed'))`, replace sub-instances with `.use(requireOwner)` / `.use(requireAdmin)` guards. Create `book.permission.ts` for book-specific ownership checks if needed
- [ ] 4.2 Refactor `chapter.api.ts`: same pattern — single Elysia instance, CORS plugin, scoped guards
- [ ] 4.3 Refactor `readlist.api.ts`: same pattern
- [ ] 4.4 Refactor `review.api.ts`: same pattern
- [ ] 4.5 Refactor `comment.api.ts`: same pattern
- [ ] 4.6 Refactor `reaction.api.ts`: same pattern
- [ ] 4.7 Refactor `tag.api.ts`: same pattern
- [ ] 4.8 Refactor `unit.api.ts`: same pattern
- [ ] 4.9 Refactor `user/api/user.core.api.ts`, `user.admin.api.ts`, `user.follow.api.ts`, `user.api.ts`: flatten sub-routes, CORS plugin, guards
- [ ] 4.10 Refactor `token/token.api.ts`, `token.book.api.ts`, `token.user.api.ts`: flatten HOF pattern to single instances with CORS plugin and guards
- [ ] 4.11 Refactor `feedback.api.ts`: same pattern
- [ ] 4.12 Refactor `echokv.api.ts`: same pattern
- [ ] 4.13 Refactor `meili.api.ts`: same pattern
- [ ] 4.14 Refactor `session/session.api.ts`: merge public and credentialed sub-routers into single flat chain with `.use(serverCorsPolicy('credentialed'))` and `{ corsPolicy: 'public' }` on `/jwks` route. Session signing remains local
- [ ] 4.15 Refactor `admin/jwt-service/jwt-service.api.ts`: same pattern

## 5. Cleanup

- [ ] 5.1 Delete `package/server/src/core.ts` and remove all `coreInstance` imports
- [ ] 5.2 Remove or reduce `package/server/src/auth/context.ts` — delete `identityContextPlugin`, `sessionContextPlugin`, keep `requireAdminSession` only if still referenced (otherwise delete)
- [ ] 5.3 Clean up `package/server/src/user/util/index.ts` — remove `verifyAuth`, `verifyAuthIdentityToken`, `verifyAuthContextToken` and related helpers that are no longer called from domain APIs. Keep re-exports only if needed by permission guards internally
- [ ] 5.4 Grep entire `package/server/src` for any remaining imports of `identityContextPlugin`, `sessionContextPlugin`, `coreInstance`, `verifyAuth`, `withCredentialedCors`, `withPublicCors` — ensure zero results

## 6. Verification

- [ ] 6.1 Run `bun run build` in `package/jwt` — verify clean compile
- [ ] 6.2 Run `bun test` in `package/jwt` — verify all tests pass including new resolver tests
- [ ] 6.3 Run `bun run build` in `package/server` — verify clean compile with no type errors
- [ ] 6.4 Run `bun test` in `package/server` — verify all existing tests pass
- [ ] 6.5 Start dev server (`bun run server:dev`) and manually verify key endpoints respond correctly (health, public book GET, protected book POST with auth headers)
