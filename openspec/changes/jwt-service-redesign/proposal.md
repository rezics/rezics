## Why

The JWT service currently uses different `aud` claims per service (`rezics-api` for auth, `rezics-main-server` for the main server), but all services belong to the same Rezics platform and token purpose is already distinguished by transport headers and `NormalizedTokenName`. This audience fragmentation adds configuration overhead without meaningful security benefit. Additionally, the auth service lacks admin APIs for JWT service management — administrators must use direct database commands to inspect or modify auth-side JWT configuration, while the main server already exposes a full admin CRUD. This inconsistency limits operational control and violates the principle that sensitive infrastructure should be manageable through proper interfaces.

## What Changes

- **BREAKING**: Default `aud` claim changes from `rezics-api` / `rezics-main-server` to `rezics` for all core services (auth, server). Environment variable overrides remain available.
- Auth service gains admin API endpoints for JWT service management (`/api/auth/admin/jwt-services/*`), mirroring the existing server admin API pattern.
- Admin dashboard adds auth-service JWT management pages that call the auth service directly, alongside the existing server JWT management.
- All JWT service management endpoints (both server and auth) are restricted to **owner/root** permission level only.
- Server admin API permission for JWT service endpoints tightened from generic `admin` to `owner`/`root`.
- Bootstrap defaults updated across both services to use `rezics` as the default audience.
- Verification configurations updated to expect `rezics` audience.

## Capabilities

### New Capabilities
- `auth-jwt-service-admin-api`: Admin API endpoints on the auth service for JWT service CRUD, activate/deactivate — restricted to owner/root.
- `admin-auth-jwt-service-ui`: Admin dashboard pages for managing auth-service JWT services, calling the auth service directly.
- `unified-jwt-audience`: Standardized `rezics` audience across all core services, with updated bootstrap defaults and verification configs.

### Modified Capabilities
- `jwt-service-admin-api`: Tighten permission from admin-level to owner/root-level for all JWT service management endpoints.
- `jwt-service-admin-ui`: Add service selector to manage JWT services from both server and auth backends; update permission requirements display.
- `auth-admin`: Extend auth admin plugin to include JWT service management routes under owner/root guard.

## Impact

**Affected packages:**
- `package/auth` — New admin API routes for JWT service management; updated default audience to `rezics`; env defaults changed.
- `package/server` — Updated default audience from `rezics-main-server` to `rezics`; bootstrap defaults changed; admin API permission tightened to owner/root; verifier audience configs updated.
- `package/admin` — New pages/components for auth-service JWT management; direct API client for auth service; permission gate updates.
- `package/jwt` — No changes (audience is passed in, not hardcoded here).
- `package/contract` — Possible DTO/schema additions for auth-side JWT service endpoints.
- `package/api` — New query hooks for auth-service JWT admin endpoints.

**Migration:** Existing `JwtService` database records with old audience values (`rezics-api`, `rezics-main-server`) will need updating. Bootstrap upsert logic handles this on restart, but a note in deployment docs is warranted.

**Backward compatibility:** Tokens issued before the change will have old audience values and will fail verification against the new `rezics` audience until they expire. Deployment should coordinate token refresh or accept a brief disruption window equal to the longest token TTL (≤1 hour for auth, ≤15 min for server sessions).
