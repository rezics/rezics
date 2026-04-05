## Context

The JWT infrastructure spans three services: `package/jwt` (shared library), `package/auth` (issues identity/context tokens), and `package/server` (issues session tokens, hosts admin API). The admin dashboard (`package/admin`) manages server-side JWT services only.

Currently:
- Auth tokens use audience `rezics-api`; server session tokens use `rezics-main-server`.
- Token purpose is already distinguished by transport headers (`Authorization` vs `x-rezics-session-token`) and `NormalizedTokenName`, making audience differentiation redundant within core services.
- The auth service has no admin API for JWT service management — configuration requires direct database access.
- Server JWT admin endpoints use `requireAdmin` (ROOT or ADMIN), but JWT service management is sensitive infrastructure that should be restricted further.

## Goals / Non-Goals

**Goals:**
- Unify default audience to `rezics` across all core services.
- Add JWT service admin API to the auth service, matching the server's existing pattern.
- Admin dashboard manages JWT services from both server and auth backends.
- Restrict all JWT service management to owner/root permission level.

**Non-Goals:**
- Changing key rotation logic or intervals (stays as-is).
- Adding new token types or claims.
- Changing the `package/jwt` library internals (audience is a parameter, not hardcoded there).
- Proxying auth admin requests through the server — admin calls auth directly.
- Adding JWT key management (create/delete/rotate individual keys) to the admin UI.

## Decisions

### D1: Unified audience value `rezics`

All bootstrap defaults and environment variable fallbacks change from `rezics-api` / `rezics-main-server` to `rezics`. This affects:

- `package/auth/src/session/jwt/options.ts` — `getAuthJwtAudience()` default
- `package/server/src/index.ts` — both `serverLocal` and `authUpstream` bootstrap audience defaults
- Verification configs in `package/server/src/index.ts` — verifier audience expectations

**Alternative considered:** Keep distinct audiences but add a shared "platform audience" claim. Rejected — adds complexity without security benefit since transport headers already disambiguate token purpose.

**Alternative considered:** Remove audience validation entirely. Rejected — audience remains a useful defense-in-depth claim for external integrations and future multi-tenant scenarios.

### D2: Auth service admin API at `/api/auth/admin/jwt-services/*`

The auth service will expose JWT service CRUD endpoints under `/api/auth/admin/jwt-services/`, using better-auth's access control to restrict to `owner` role only. The endpoint structure mirrors the server's existing `/admin/jwt-services/*` pattern.

Implementation follows the auth service's existing admin route pattern:
- New Elysia route group under the auth service's admin prefix
- Uses the auth service's own Prisma client and `JwtService` model
- Reuses `JwtServiceDTO` and input schemas from `@rezics/contract`

**Alternative considered:** Proxy auth JWT management through the main server. Rejected — violates decoupling principle, adds latency, and creates a circular dependency (server depends on auth for tokens, auth depends on server for management).

### D3: New `requireRoot` macro on the server

A new `requireRoot` macro will be added to `package/server/src/middleware/permission.ts` that restricts access to `ROOT` role only (excluding `ADMIN`). JWT service admin endpoints switch from `requireAdmin` to `requireRoot`.

```
requireLogin → requireOwner → requireAdmin → requireRoot
                                (ROOT|ADMIN)    (ROOT only)
```

On the auth side, JWT service endpoints use better-auth's access control with a new `jwt-service` resource, granting permissions only to the `owner` role.

**Alternative considered:** Reuse `requireAdmin` and add a separate permission check. Rejected — a dedicated macro is cleaner and reusable for other sensitive operations.

### D4: Auth service permissions extension

The `package/auth/src/auth/permissions.ts` access control statement gains a new `jwt-service` resource with actions: `list`, `get`, `create`, `update`, `activate`, `deactivate`. Only the `owner` role receives these permissions.

This follows the existing pattern of resource-based access control in the auth service.

### D5: Admin dashboard direct auth service communication

The admin dashboard will call the auth service directly for auth-side JWT management. This requires:
- A new environment variable for the auth service base URL in the admin app (or reuse existing auth URL config).
- New TanStack Query hooks in `package/api` for auth-side JWT service endpoints.
- The admin UI groups JWT services by backend (server vs auth) with clear labeling.

**Alternative considered:** Single unified JWT services page that merges both backends. Rejected for initial implementation — keeping them visually separate is simpler and avoids confusion about which backend owns which service record. Can be unified later if desired.

### D6: Bootstrap upsert updates existing audience values

The `bootstrapJwtServiceRecord` function already uses Prisma upsert. On the next deployment, bootstrap will update the `audience` field of existing records to `rezics`. No separate migration script is needed — the upsert's `update` clause handles this.

Tokens in flight with the old audience will fail verification until they expire. The maximum window is:
- Auth identity tokens: up to 1 hour (3600s TTL)
- Server session tokens: up to 15 minutes (900s TTL)

Coordinated deployment (auth first, then server) minimizes disruption.

## Risks / Trade-offs

**[Risk] Tokens in flight during deployment will fail verification** → Deploy auth service first (it issues tokens with new audience), then server (it verifies with new audience). Session tokens issued by the server have a short 15-minute TTL. Identity tokens have a 1-hour TTL but are refreshed proactively by the frontend. A brief disruption window is acceptable for this infrastructure change.

**[Risk] Admin UI now depends on two backend URLs** → The auth service URL is already known to the frontend for login flows. Reuse the same configuration. No new infrastructure dependency.

**[Risk] Tightening permissions may lock out current ADMIN users from JWT management** → This is intentional. Only ROOT/owner users should manage JWT infrastructure. Document the change in deployment notes.

**[Trade-off] Separate auth/server JWT management pages vs unified view** → Simpler initial implementation at the cost of slight UX fragmentation. The admin manages two lists instead of one. Acceptable given the decoupling principle.
