## 1. Unified Audience Defaults

- [x] 1.1 Update `getAuthJwtAudience()` default in `package/auth/src/session/jwt/options.ts` from `'rezics-api'` to `'rezics'`
- [x] 1.2 Update server bootstrap audience defaults in `package/server/src/index.ts` — change `'rezics-main-server'` to `'rezics'` for `serverLocal` and `'rezics-api'` to `'rezics'` for `authUpstream`
- [x] 1.3 Update `MAIN_SESSION_JWT_AUDIENCE` fallback in `package/server/src/index.ts` from `'rezics-main-server'` to `'rezics'`
- [x] 1.4 Update `AUTH_JWT_AUDIENCE` fallback in `package/server/src/index.ts` from `'rezics-api'` to `'rezics'`
- [x] 1.5 Verify that `bootstrapJwtServiceRecord` upsert includes `audience` in its update clause so existing records are updated on restart
- [x] 1.6 Grep codebase for any remaining hardcoded `'rezics-api'` or `'rezics-main-server'` audience references and update them

## 2. Server Permission: `requireRoot` Macro

- [x] 2.1 Add `requireRoot` macro to `package/server/src/middleware/permission.ts` that checks `session.permission.role === 'ROOT'` only (rejects `ADMIN`)
- [x] 2.2 Update all JWT service admin endpoints in `package/server/src/jwt/jwt.admin.api.ts` from `requireAdmin: true` to `requireRoot: true`
- [x] 2.3 Verify build passes for `package/server`

## 3. Auth Service: Access Control Extension

- [x] 3.1 Add `'jwt-service'` resource with actions `['list', 'get', 'create', 'update', 'activate', 'deactivate']` to the access control statement in `package/auth/src/auth/permissions.ts`
- [x] 3.2 Grant all `jwt-service` permissions to the `owner` role only (not `admin` or `user`)
- [x] 3.3 Verify build passes for `package/auth`

## 4. Auth Service: JWT Service Admin API

- [x] 4.1 Create `package/auth/src/jwt/jwt.admin.service.ts` with CRUD operations (list, fetch, create, update, activate, deactivate) using the auth Prisma client's `JwtService` model
- [x] 4.2 Create `package/auth/src/jwt/jwt.admin.api.ts` with Elysia route group at `/api/auth/admin/jwt-services` implementing all 6 endpoints (GET list, GET by key, POST create, PATCH update, POST activate, POST deactivate)
- [x] 4.3 Wire owner-only authorization on all endpoints using better-auth access control
- [x] 4.4 Ensure all mutation endpoints write DB first, then invalidate JWT service cache
- [x] 4.5 Use `JwtServiceDTO`, `CreateJwtServiceInput`, `UpdateJwtServiceInput` schemas from `@rezics/contract` for request/response validation
- [x] 4.6 Mount the new admin API routes in the auth service entry point
- [x] 4.7 Verify build passes for `package/auth`

## 5. Contract: API Client Hooks

- [x] 5.1 Add TanStack Query hooks in `package/api` for auth-side JWT service admin endpoints (list, fetch, create, update, activate, deactivate) with query keys `['authJwtServices']` and `['authJwtServices', serviceKey]`
- [x] 5.2 Configure the auth service base URL in the API client (reuse existing auth URL config from the app)
- [x] 5.3 Verify build passes for `package/api`

## 6. Admin Dashboard: Auth JWT Service Management UI

- [x] 6.1 Create auth JWT services page component in `package/admin/src/` following existing admin module pattern (table with serviceKey, issuer, audience, isLocalIssuer, isActive columns)
- [x] 6.2 Create auth JWT service edit dialog component with mutable fields and activate/deactivate controls
- [x] 6.3 Add route entry in `routes/_admin/` for the auth JWT services page
- [x] 6.4 Add "Auth JWT Services" navigation entry, visible only to owner/root users
- [x] 6.5 Wire TanStack Query cache invalidation on mutations (`['authJwtServices']` and `['authJwtServices', serviceKey]`)
- [x] 6.6 Verify build passes for `package/admin`

## 7. Admin Dashboard: Permission Gating

- [x] 7.1 Update existing "JWT Services" (server-side) navigation entry to be visible only to owner/root users
- [x] 7.2 Add permission check on JWT services pages to redirect non-owner users
- [x] 7.3 Verify both JWT services pages are hidden from admin-role users and visible to owner/root users

## 8. Validation

- [x] 8.1 Run `bun run build` in `package/auth`, `package/server`, `package/admin`, and `package/api` — all must pass
- [x] 8.2 Run existing tests in `package/server` to verify no regressions from audience and permission changes
- [x] 8.3 Run `bun run knip` at root to check for unused exports introduced by the change
