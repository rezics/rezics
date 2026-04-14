## Why

The current architecture conflates authentication and authorization into a single token (`auth-identity-token`), forces the server to maintain an unbounded in-memory user cache (`user-cache.ts`) for per-request role lookups, and relies on a misnamed `requireOwner` middleware that provisions users as a side effect instead of checking ownership. User identity data (`name`, `slug`, `avatar`) is duplicated across auth and server databases with no synchronization — provisioning copies fields once at creation and never updates them. After registration, there is no guarantee the server user record exists until the first API call triggers lazy provisioning inside middleware. Unused token types (`notification-session-token`, `search-session-token`) and a legacy server JWKS endpoint add dead code. The `Authorization: Bearer` header ambiguously carries the `auth-identity-token` for all endpoints, making it impossible to distinguish identity verification from resource access.

## What Changes

- **BREAKING: Introduce `rezics-session-token`** — A short-lived JWT access token issued by the server. Carries `{ sub: unitId, role, iss: "rezics-server" }`. Only `unitId` is trusted for identity; `role` is a rejection-only hint (can deny, never grant). Used via `Authorization: Bearer` for all API calls to server, notify, search, and reaction services.
- **Redefine `auth-identity-token` as refresh/exchange token** — The existing auth JWT (issued by better-auth's JWT plugin, refreshed via session cookie) is no longer sent as `Authorization: Bearer`. It is presented via `x-auth-identity-token` header exclusively to the server's token exchange endpoint (`POST /session/exchange`) to obtain a `rezics-session-token`.
- **BREAKING: Add `POST /session/exchange` endpoint** — Server verifies `auth-identity-token` via auth JWKS, extracts `unitId`, looks up user role from its own DB, and issues a `rezics-session-token`. This is the only server endpoint that touches the DB for authentication purposes.
- **Guaranteed user provisioning via auth `afterSignUp` hook** — Auth's registration lifecycle hook synchronously calls the server to create the user record. Registration fails if provisioning fails. Eliminates the lazy provisioning side effect in middleware.
- **Best-effort profile sync from server to auth** — When a user updates profile fields (`name`, `slug`, `avatar`) on the server, the server notifies auth to update its copy. Failure is non-critical — auth may serve slightly stale profile data in OAuth/token flows.
- **BREAKING: Remove `requireOwner` macro** — Replaced by a minimal `requireLogin` that verifies `rezics-session-token` and extracts `{ unitId, role }` from claims. No DB lookup, no cache, no provisioning. Normal endpoints use only `unitId` (trusted). Admin endpoints use token role for fast rejection, then verify role against DB for granting access (low frequency, no performance concern).
- **Delete `user-cache.ts`** — The unbounded `Map<unitId, UserDTO>` cache is removed entirely. No deny-list or replacement cache is needed — the token's short TTL (~15min) bounds role staleness, and admin endpoints verify role against the DB.
- **BREAKING: Remove `notification-session-token` and `search-session-token`** — All services validate the same `rezics-session-token` via the server's JWKS. No per-service tokens.
- **Remove legacy `/session/token` endpoint and `session-state.ts`** — The server no longer calls back to auth's `getAuthSessionState()`. The `POST /session/exchange` endpoint replaces this flow entirely.
- **Simplify `@rezics/contract` token registry** — Only two token names remain: `AUTH_IDENTITY` and `REZICS_SESSION`. Transport headers, token maps, and schemas are reduced accordingly.
- **Simplify `@rezics/api` frontend auth flow** — Token refresh becomes two independent cycles: session cookie → `auth-identity-token`, then `auth-identity-token` → `rezics-session-token`. `Authorization: Bearer` always carries `rezics-session-token`. `buildTokenHeaders` is simplified.
- **Refactor `@rezics/contract` permission functions** — `hasPermissionTo*` functions accept `{ unitId: string; role: string }` (from token claims) instead of full `UserDTO`. `isAdmin`, `isRoot`, `isBlocked`, `BasicAdminPermission` are updated to match.
- **Update `@rezics/admin` auth flow** — Admin dashboard uses `rezics-session-token` for server API calls and session cookie for auth admin operations. Auth admin routes remain session-based (handled by better-auth internally).
- **Repository cleanup** — Remove dead code paths, unused token transport constants, stale test mocks referencing removed infrastructure, and the deprecated `/session/jwks` endpoint.

## Capabilities

### New Capabilities

- `server-access-token`: Server-issued `rezics-session-token` JWT — signing, verification, exchange endpoint, claims schema (unitId trusted, role rejection-only), TTL/refresh lifecycle.
- `auth-user-provisioning-hook`: Synchronous `afterSignUp` hook in auth that calls the server to create user records during registration. Guarantees server-side user existence.
- `profile-sync`: Best-effort notification from server to auth when user profile fields (`name`, `slug`, `avatar`) change. Server owns profile, auth holds a read-only copy.

### Modified Capabilities

- `unified-access-token`: `auth-identity-token` is no longer the universal access token. It becomes an exchange/refresh token used solely to obtain `rezics-session-token`.
- `macro-permission-guards`: `requireOwner`, `requireAdmin`, `requireRoot` macros are removed. `requireLogin` verifies `rezics-session-token` only. Role/ownership checks become inline.
- `server-user-cache`: Deleted entirely. No replacement — role is carried in token claims.
- `token-refresh-registry`: Registry manages two tokens (`AUTH_IDENTITY` via session cookie, `REZICS_SESSION` via exchange endpoint). `NOTIFICATION_SESSION` and `SEARCH_SESSION` entries removed.
- `frontend-auth-state-separation`: `authSessionStore` simplifies — `capabilityLevel` is derived from `rezics-session-token` existence. `getAuthSessionState()` call removed.
- `lazy-user-provisioning`: Replaced by the `auth-user-provisioning-hook` capability. Lazy provisioning in middleware is deleted.
- `auth-login-orchestration`: Login/register flow changes. Registration: signUp → afterSignUp hook provisions server user → getToken → exchange for rezics-session-token. Login: signIn → getToken → exchange for rezics-session-token.
- `auth-token-lifecycle-provider`: `AuthProvider` manages two independent refresh cycles instead of one. `Authorization: Bearer` always carries `rezics-session-token`.
- `server-permission-guards`: Inline role/ownership checks replace macro-based guards. Permission functions accept `{ unitId, role }` instead of `UserDTO`.
- `notify-auth`: Notify service validates `rezics-session-token` via server JWKS instead of `auth-identity-token` via auth JWKS.
- `reaction-auth`: Reaction service validates `rezics-session-token` via server JWKS instead of `auth-identity-token` via auth JWKS.

## Impact

**Affected packages:**

| Package | Change |
|---|---|
| `@rezics/contract` | Simplify token registry to 2 tokens. Update `TokenTransportHeader`, `NormalizedTokenName`, token maps. Add `RezicsSessionClaims` schema. Refactor permission functions to accept `{ unitId, role }`. Remove `ApiTokenScopes` if unused. |
| `@rezics/server` | Add `POST /session/exchange`. Add `rezics-session-token` signing/verification via existing JWKS infra. Rewrite `requireLogin` macro. Delete `requireOwner`, `requireAdmin`, `requireRoot`, `user-cache.ts`, `session-state.ts`, legacy `/session/token`. Migrate all routes to inline role/ownership checks. Add internal provisioning endpoint for auth hook. Add profile-sync notification endpoint or outgoing call. |
| `@rezics/auth` | Add `afterSignUp` hook calling server provisioning endpoint. Add incoming profile-sync endpoint (or handler) for server notifications. No changes to admin routes (remain session-based). |
| `@rezics/jwt` | Update `elysia-token-resolver` for new token name. No structural changes — existing JWKS verification supports both issuers. |
| `@rezics/api` | Rewrite `jwt.ts` token storage to manage two tokens. Update `buildTokenHeaders` — `Authorization: Bearer` always carries `REZICS_SESSION`. Add exchange flow. Remove `NOTIFICATION_SESSION`/`SEARCH_SESSION` storage keys. |
| `@rezics/app` | Update login/register handlers to include exchange step. Update `authSessionStore` — derive state from `rezics-session-token`. |
| `@rezics/app-shell` | Simplify `AuthProvider` — two independent refresh cycles. Remove `getAuthSessionState()` dependency. |
| `@rezics/admin` | Update API client to use `rezics-session-token` for server calls. Auth admin calls remain session-based. Ensure admin auth flow includes token exchange. |
| `@rezics/notify` | Switch token verification from auth JWKS to server JWKS. Update claim types. |
| `@rezics/search` | Switch token verification from auth JWKS to server JWKS. Remove `search-session-token` infrastructure. |
| `@rezics/reaction` | Switch token verification from auth JWKS to server JWKS. Update claim types. |

**Backward compatibility:** This is a **breaking change** for the internal API contract. The `Authorization: Bearer` header semantics change (carries `rezics-session-token` instead of `auth-identity-token`). The `/session/token` endpoint is removed and replaced by `/session/exchange`. `notification-session-token` and `search-session-token` headers are removed. All changes deploy atomically (monorepo).

**Migration:** No database schema changes required. The user provisioning endpoint and profile-sync mechanism are additive. All existing user records remain valid. Token format changes require all active sessions to re-authenticate after deployment.
