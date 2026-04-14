## Context

The system uses a single JWT (`auth-identity-token`) issued by the auth service as the bearer credential for all API calls. The server validates this token via JWKS but then immediately hits the database (or an unbounded in-memory cache) to load a full `UserDTO` for every authenticated request through `requireOwner`. User identity fields (`name`, `slug`, `avatar`) are duplicated across the auth and server databases with no synchronization mechanism — `provisionFromJwt` copies them once at creation time (`update: {}` is intentionally empty). Registration does not guarantee a server-side user record exists; lazy provisioning is buried as a side effect in middleware. Unused token types (`notification-session-token`, `search-session-token`) and a legacy `/session/jwks` endpoint remain in the contract and codebase.

The auth service runs better-auth with the JWT plugin (ES256 JWKS, configurable TTL) and the `oauthProvider` plugin. Auth admin routes are session-based, handled entirely by better-auth's admin plugin via cookie authentication. The server maintains its own JWKS infrastructure (`package/server/src/session/jwt/`) originally built for the now-removed `rezics-session-token`, which was deleted during the `pure-oauth-auth` change but whose signing infrastructure remains.

## Goals / Non-Goals

**Goals:**

- Eliminate per-request database lookups for authentication/authorization on the server hot path
- Guarantee server-side user record exists immediately after registration (no lazy provisioning gap)
- Establish clear data ownership: auth owns credentials/sessions, server owns profile/permissions
- Standardize `Authorization: Bearer` to always carry `rezics-session-token` — no ambiguity
- Remove dead code: unused token types, `user-cache.ts`, `requireOwner`, `session-state.ts`
- All services (notify, search, reaction) validate the same token type via the same JWKS
- Simplify the frontend auth flow to two independent refresh cycles

**Non-Goals:**

- OAuth scope enforcement for third-party apps (future change — the token architecture supports it, but scope vocabulary and enforcement are not in scope)
- Database schema changes (user table structures remain as-is)
- Service-to-service auth changes (`x-internal-secret` pattern is unchanged)
- Auth session management changes (better-auth's session/cookie handling is untouched)
- Admin panel UI changes beyond auth flow updates

## Decisions

### Decision 1: Three-layer token architecture

**Choice:** Session cookie → `auth-identity-token` (JWT) → `rezics-session-token` (JWT). Each layer refreshes the one below it.

```
Session cookie (httpOnly, long-lived, managed by better-auth)
    │
    │  GET /api/auth/token (credentials: 'include')
    ▼
auth-identity-token (JWT, ~1h TTL, issued by auth)
    │
    │  POST /session/exchange (x-auth-identity-token header)
    ▼
rezics-session-token (JWT, ~15min TTL, issued by server)
    │
    │  Authorization: Bearer
    ▼
All API calls (server, notify, search, reaction)
```

**Rationale:** The auth-identity-token already exists as a JWT refreshed via session cookie (`queryAccessToken` in `api/src/react-query/jwt.ts`). By making the server issue its own short-lived token, we: (1) embed server-side claims (role) without auth needing to know about them, (2) eliminate per-request DB lookups since role is in the token, (3) decouple auth and server identity systems cleanly. The session cookie never leaves the auth domain. The auth-identity-token never appears in `Authorization: Bearer`. No ambiguity.

**Alternative considered:** Single token from auth with enriched claims (the current `pure-oauth-auth` model). Rejected because it requires auth to know about server-side roles, creates a stale-role problem solvable only by a cache (which we want to delete), and doesn't support future OAuth scope enforcement where the server needs to be the access token issuer.

**Alternative considered:** Two-token model from the external report (`auth-identity-token` + `server-session-token` with `x-` headers everywhere). Rejected because it unnecessarily drops `Authorization: Bearer` when the standard header works perfectly for the access token, and it proposes the server issues tokens without the auth-identity-token-as-refresh-token insight.

### Decision 2: Server issues `rezics-session-token` via exchange endpoint

**Choice:** `POST /session/exchange` accepts `x-auth-identity-token`, verifies via auth JWKS, looks up user role in server DB, and returns a signed `rezics-session-token`.

```typescript
// rezics-session-token claims
{
  sub: string       // unitId — the ONLY trusted claim
  unitId: string    // explicit (matches sub)
  role: UserRole    // MEMBER | ADMIN | ROOT | BLOCKED — rejection hint only, never trusted for granting
  iss: "rezics-server"
  exp: number
}
```

**Rationale:** The exchange endpoint is the only place the server touches the DB for auth purposes. The `unitId` claim is the sole trusted identity assertion. The `role` claim is included as an optimization for **rejection only** — it can be used to quickly reject requests that clearly lack permission (e.g., MEMBER accessing an admin endpoint), but it is never used to grant access. Any operation requiring elevated privileges (admin, root) MUST verify the role against the database. This avoids the need for a deny-list or cache while keeping the common rejection path fast.

**Token TTL:** ~15 minutes. Role changes propagate when the token is refreshed. A blocked user can continue making normal requests for up to one TTL window — this is accepted as a reasonable tradeoff. The 15-minute bound is short enough that no immediate revocation mechanism is needed.

**Trust model:** Only `unitId` is trusted from the JWT. The role claim is a snapshot that can be stale by up to one TTL window. It is safe to use for denial (rejecting a request from a MEMBER on an admin endpoint) but never for authorization (granting admin access because the token says ADMIN).

### Decision 3: Guaranteed provisioning via auth `afterSignUp` hook

**Choice:** Better-auth's lifecycle hook calls the server's internal provisioning endpoint synchronously during registration. Registration fails if provisioning fails.

```
better-auth afterSignUp hook
    │
    │  POST http://<server>/internal/users/provision
    │  Header: x-internal-secret: <shared secret>
    │  Body: { unitId, slug, name }
    │
    └─▶ Server: upsert user record (same logic as current provisionFromJwt)
```

**Rationale:** This eliminates the gap between auth registration and server user creation. The server user is guaranteed to exist by the time the frontend receives tokens. The internal endpoint uses the existing `x-internal-secret` pattern (same as notify/reaction), so no new auth mechanism is needed.

**Alternative considered:** Event-driven provisioning (webhook/message queue). Rejected for this scale — it adds infrastructure complexity (retry, dead-letter, eventual consistency) when a synchronous call within the same deployment suffices. The auth and server services are co-located and deployed atomically.

### Decision 4: Server owns profile, auth holds a read-only copy

**Choice:** `name`, `slug`, `avatar` are owned by the server database. When the server updates these fields, it notifies auth via a best-effort internal call. Auth updates its local copy but does not fail the server operation if the notification fails.

```
Server: PUT /users/me { name: "New Name" }
    │
    ├─ Update server DB (source of truth) ✓
    │
    ├─ POST http://<auth>/internal/users/sync
    │  Header: x-internal-secret
    │  Body: { unitId, name, slug, avatar }
    │  (fire-and-forget or retry-once, non-blocking)
    │
    └─ Return 200 to client
```

**Rationale:** Auth needs `name` for `definePayload` (JWT claims) and `/userinfo` (OAuth). A slightly stale copy is acceptable — the consent screen showing yesterday's display name is not a correctness problem. This avoids bidirectional coupling: auth never queries the server at runtime.

### Decision 5: `requireLogin` as the sole middleware, inline role checks

**Choice:** Delete `requireOwner`, `requireAdmin`, `requireRoot` macros. Replace with a single `requireLogin` macro that verifies `rezics-session-token` and extracts `{ unitId, role }`. Routes that need elevated access verify the role against the database. Token role is used only for early rejection.

```typescript
// New requireLogin — the only auth middleware
const requireLogin = new Elysia({ name: "macro/auth" })
  .macro("requireLogin", {
    async resolve({ headers }) {
      const token = headers["authorization"];
      if (!token) return status(401, "Unauthorized");
      const claims = await verifyRezicsSessionToken(token);
      if (!claims) return status(401, "Unauthorized");
      return { identity: claims };
    },
  });

// Route with admin check — token rejects, DB confirms
.get("/admin/users", async ({ identity }) => {
  // Token-based rejection (fast path, no DB):
  if (identity.role !== "ADMIN" && identity.role !== "ROOT") {
    return status(403, "Forbidden");
  }
  // DB verification (required — token role is never trusted for granting):
  const user = await db.user.findUnique({
    where: { unitId: identity.unitId },
    select: { permission: true },
  });
  if (!isAdminRole(user)) return status(403, "Forbidden");
  // ... proceed
}, { requireLogin: true })
```

**Rationale:** The current macro chain (`requireLogin` → `requireOwner` → `requireAdmin`) hides DB lookups, caching, and provisioning inside middleware. The new model is explicit: the token's `role` claim rejects requests that obviously lack permission (MEMBER on admin endpoint — no DB hit needed for 99% of rejections), but granting access always requires DB verification. Admin endpoints are low-frequency, so the DB lookup is not a performance concern. Normal endpoints only need `unitId` (trusted) and don't check role at all.

### Decision 6: All services validate `rezics-session-token` via server JWKS

**Choice:** Notify, search, and reaction services switch from verifying `auth-identity-token` via auth JWKS to verifying `rezics-session-token` via server JWKS.

**Rationale:** One token type, one JWKS endpoint, uniform validation across all services. The server already publishes its JWKS at `/.well-known/jwks.json`. Services update their `createRemoteJWKSet` URL and claim type annotation — no structural changes needed. Per-service tokens (`notification-session-token`, `search-session-token`) are deleted from the contract.

### Decision 7: Auth admin routes remain session-based

**Choice:** Auth admin endpoints (`/admin/list-users`, `/admin/ban-user`, etc.) continue to use better-auth's session cookie for authentication. `Authorization: Bearer` is not used for auth operations.

**Rationale:** Better-auth's admin plugin is inherently session-based — it reads the session cookie, looks up the auth user's role (`owner`/`admin`/`user` from `authRoles`), and enforces access control. This is a completely separate role system from the server's `MEMBER`/`ADMIN`/`ROOT`/`BLOCKED`. No reason to change it. The admin dashboard sends session cookies for auth operations and `Authorization: Bearer <rezics-session-token>` for server operations.

## Risks / Trade-offs

**[Role changes are eventually consistent up to token TTL]** → A user who is promoted or demoted will keep their stale token role until their `rezics-session-token` expires (~15min). For normal endpoints this is harmless (they only check `unitId`). For admin endpoints the stale role might cause early rejection (promoted user rejected until token refresh) or a failed DB verification (demoted user's token claims ADMIN but DB says MEMBER → rejected). Both cases self-heal on token refresh. A blocked user can continue making normal requests for up to 15 minutes — this is an accepted tradeoff requiring no deny-list.

**[Auth `afterSignUp` hook creates runtime coupling]** → Auth registration fails if the server is unreachable. Mitigation: Both services are co-located and deployed atomically. If the server is down, registration should fail — a user without a server record cannot use the platform. This is the correct failure mode.

**[Profile sync is best-effort]** → If the server-to-auth profile notification fails, auth's copy of `name`/`avatar` is stale until the next update. The JWT `definePayload` will include the old name. Mitigation: Profile changes are infrequent. The server can retry once. The next profile update will include current data. Staleness is bounded and non-critical.

**[All active sessions must re-authenticate after deployment]** → The `Authorization: Bearer` semantics change from `auth-identity-token` to `rezics-session-token`. Existing tokens in client localStorage will be rejected. Mitigation: The frontend's token refresh logic detects 401 responses and initiates the exchange flow automatically. Users experience a transparent re-authentication, not a forced logout.

**[Server JWKS becomes a dependency for all services]** → If the server's JWKS endpoint is unreachable, notify/search/reaction cannot verify tokens. Mitigation: `@rezics/jwt`'s `createRemoteJWKSet` already caches JWKS keys in memory. A brief server outage doesn't affect verification for already-cached keys. This is the same risk profile as the current auth JWKS dependency.

## Migration Plan

The change deploys atomically as a monorepo release. No database migrations. Order of implementation:

1. **Contract layer** — Add `REZICS_SESSION` token name/transport/claims. Refactor permission functions. Remove unused token types.
2. **Server** — Implement `POST /session/exchange`, `rezics-session-token` signing/verification, internal provisioning endpoint, profile-sync outgoing call. Rewrite `requireLogin`. Delete `requireOwner`, `user-cache.ts`, `session-state.ts`.
3. **Auth** — Add `afterSignUp` hook, profile-sync incoming handler.
4. **Frontend** — Update `jwt.ts` for two-token storage, `buildTokenHeaders` for Bearer = REZICS_SESSION, exchange flow, `AuthProvider` dual refresh cycle, `authSessionStore` simplification.
5. **Admin** — Update auth flow to include token exchange step.
6. **Auxiliary services** — Switch notify/search/reaction to server JWKS.
7. **Cleanup** — Remove dead code, stale test mocks, deprecated endpoints.

**Rollback:** Revert the monorepo commit. No database rollback needed. Users re-authenticate via session cookie (unaffected by this change).

## Open Questions

None — all design decisions were resolved during exploration.
