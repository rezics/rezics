## Why

The current login/registration flow requires 6 sequential HTTP round-trips and 3 separate token types (AUTH_IDENTITY, AUTH_CONTEXT, REZICS_SESSION) before a user is fully authenticated. AUTH_CONTEXT exists only to ferry profile claims to the server for provisioning, then is discarded. REZICS_SESSION duplicates role information the server already looks up from its database. The `/session/token` endpoint calls back to auth on every issuance to re-verify eligibility, creating a circular dependency. This complexity slows login, complicates the frontend, and makes it harder to onboard new services (Notify, Reaction) which must each understand the multi-token chain.

Moving to a single OAuth access token — the pattern used by GitHub, Reddit, and Google — eliminates the redundant tokens, reduces login to 2 round-trips, and lets every service validate requests identically via JWKS with zero inter-service communication.

## What Changes

- **Enrich access token claims**: Add `name` and conditional `email_verified: false` to better-auth's `definePayload`, giving services enough data for lazy provisioning and verification gating without calling back to auth.
- **BREAKING: Eliminate AUTH_CONTEXT token**: No longer issued or consumed. The access token claims replace it.
- **BREAKING: Eliminate REZICS_SESSION token**: The server no longer issues its own JWT. Permission checks use a cached database lookup instead of a token snapshot. The `/session/token` endpoint and `getAuthSessionState()` callback are removed.
- **BREAKING: Remove `/users/ensure` explicit endpoint**: Replaced by automatic lazy-provisioning middleware on the server that creates a user record on first authenticated access from token claims.
- **Simplify frontend auth flow**: `login()`/`register()` reduce to signIn/signUp + getToken (2 calls). `establishBusinessSession()` is removed. `AuthProvider` manages a single token refresh cycle.
- **Simplify contract token types**: Remove `AUTH_CONTEXT`, `REZICS_SESSION`, and their transport headers from `@rezics/contract`. Remove `REZICS_SESSION` entry from the token refresh registry.
- **Server permission macros refactored**: `requireOwner` resolves the user from an in-memory cache backed by the database, no longer requires a second token. `requireAdmin`/`requireRoot` check the cached role directly.
- **Notify and Reaction remain unchanged in structure**: They already verify AUTH_IDENTITY via JWKS — the same mechanism validates the access token. Only the claim type annotation changes.
- Service-to-service calls (`x-internal-secret`) are **not** affected by this change.

## Capabilities

### New Capabilities

- `unified-access-token`: Single OAuth access token replaces AUTH_IDENTITY + AUTH_CONTEXT + REZICS_SESSION. Covers enriched JWT claims (name, conditional email_verified), conditional claim semantics, and the single-token auth model across all services.
- `server-user-cache`: In-memory user/role cache on the main server, keyed by unitId with TTL-based expiry. Replaces the REZICS_SESSION token as the performance optimization for avoiding per-request DB lookups.

### Modified Capabilities

- `auth-login-orchestration`: Login/register flow changes from 6-step sequence to 2-step (signIn + getToken). `establishBusinessSession()` removed. Business session concept eliminated.
- `macro-permission-guards`: `requireOwner` drops `rezicsSessionToken` dependency. Resolves user and role from cached DB lookup. `requireAdmin`/`requireRoot` check cached role directly.
- `lazy-user-provisioning`: Trigger changes from explicit frontend `/ensure` call to automatic server-side middleware on first authenticated request. Provisioning data sourced from access token claims instead of AUTH_CONTEXT.
- `token-refresh-registry`: `REZICS_SESSION` entry removed. Registry manages gateway token only. Multi-token orchestration in `AuthProvider` simplified to single-token refresh.

## Impact

**Affected packages:**

| Package | Change |
|---|---|
| `@rezics/contract` | Remove AUTH_CONTEXT, REZICS_SESSION token types and transport headers. Remove session token claim schemas. |
| `@rezics/auth` | Enrich `definePayload` with `name`, conditional `email_verified`. |
| `@rezics/server` | Remove `/session/token` endpoint and `session-state.ts`. Rewrite permission macros. Add lazy-provision middleware + user cache. Remove `/users/ensure`. |
| `@rezics/api` | Remove `userApi.ensure()`, `userApi.issueSessionToken()`. Remove `REZICS_SESSION` from refresh registry. Simplify `AuthProvider` to single-token refresh. |
| `@rezics/app` | Rewrite `handler.ts` login/register. Remove `establishBusinessSession`. Simplify `authSessionStore`. |
| `@rezics/app-shell` | Simplify `AuthProvider.tsx` and `authSessionStore.ts`. Remove business token tracking. |
| `@rezics/notify` | Update auth claim type annotation (optional). |
| `@rezics/reaction` | Update auth claim type annotation (optional). |

**Backward compatibility:** This is a **breaking change** for the internal API contract. The `x-rezics-session-token` header, `/session/token` endpoint, `/users/ensure` endpoint, and `x-auth-context-token` header are all removed. No external consumers are affected (no public API).

**Migration:** All changes deploy atomically (monorepo). No database migration required — the user provisioning logic and permission model remain the same, only the transport and trigger change.
