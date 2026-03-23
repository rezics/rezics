## Why

The server's domain APIs are cluttered with inline `new Elysia()` sub-instances solely to apply `identityContextPlugin` or `sessionContextPlugin` for JWT verification. This creates ~30 unnecessary Elysia instances across the codebase, inconsistent patterns across domains (some use inline wrappers, some use HOFs, some use dual instances), and obscures the actual route definitions. JWT parsing and authorization are tangled together in the context plugins, making both harder to reason about.

## What Changes

- **New `createTokenResolver` factory in `@package/jwt`**: A per-token Elysia plugin factory that reads a configured header, verifies the JWT, and injects the typed payload (or `null`) directly onto Elysia context. One plugin per token type, registered once at root level with `as: 'global'`.
- **New scoped guard permission plugins in `package/server/src/auth/auth.permission.ts`**: Common authorization guards (`requireLogin`, `requireAdmin`, `requireOwner`) that check token presence and enforce permission rules. These are scoped plugins applied via `.use()` at the point in the route chain where protection begins.
- **Domain-specific permission extensions**: Domains with custom permission logic (e.g., book ownership) get their own `{domain}.permission.ts` file.
- **Flatten all domain API files**: Remove all inline `new Elysia()` sub-instances from domain `.api.ts` files. Each domain exports a single `new Elysia({ prefix })` instance with flat `.get()/.post()/.put()/.delete()` chains. Permission guards are applied inline via `.use(requireLogin)` etc.
- **Remove `package/server/src/core.ts`**: The `coreInstance()` factory is no longer needed. Each domain API creates its own `new Elysia({ prefix })` directly.
- **Remove `identityContextPlugin` and `sessionContextPlugin`**: Replaced by the combination of root-level token resolvers + scoped permission guards.
- **Refactor `package/server/src/index.ts`**: Register token resolver plugins at root level before mounting domain APIs. Remove `mainSessionJwtPlugin` from the old `coreInstance` pattern.

## Capabilities

### New Capabilities
- `jwt-token-resolver-plugin`: Reusable Elysia plugin factory in `@package/jwt` that creates per-token context resolvers. Reads headers, verifies JWTs, injects typed payloads onto Elysia context with `as: 'global'`.
- `server-permission-guards`: Scoped Elysia guard plugins for authorization (`requireLogin`, `requireAdmin`, `requireOwner`) in `package/server/src/auth/`. Domain-specific permission files for extended checks.
- `server-route-cleanup`: Flatten all domain `.api.ts` files to single Elysia instances with no sub-instance wrappers. Remove `core.ts`.

### Modified Capabilities
_(none — no existing spec-level requirements are changing)_

## Impact

- **`@package/jwt`**: New `createTokenResolver` factory and `extractBearer` helper added to adapters.
- **`package/server`**: All domain `.api.ts` files refactored. `auth/context.ts` removed or reduced. `auth/auth.permission.ts` created. `core.ts` removed. `index.ts` updated to register token resolvers at root.
- **`package/contract`**: No changes — token names, headers, and claim types already defined.
- **Backward compatibility**: No API contract changes. All routes maintain the same HTTP interface. Internal refactor only.
- **Migration**: No database migration. No client-side changes needed.
