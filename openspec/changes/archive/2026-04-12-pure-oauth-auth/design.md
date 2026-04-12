## Context

The system currently uses three token types for user authentication:

1. **AUTH_IDENTITY** — JWT issued by auth, verified by all services via JWKS. Carries `{ id, slug, role, scope }`.
2. **AUTH_CONTEXT** — Ephemeral JWT fetched and discarded during provisioning. Carries profile data (`name`, `avatar`, `email_verified`).
3. **REZICS_SESSION** — JWT issued by the main server after a callback to auth's `getSessionState()`. Carries `{ unitId, permission.role }`.

Login requires the browser to orchestrate 6 sequential HTTP calls across two services. The server calls back to auth on every session token issuance to re-verify eligibility. Notify and Reaction independently verify AUTH_IDENTITY via JWKS — the target pattern already exists in these services.

The auth service's `definePayload` (in `instance.ts:120-125`) currently emits only `{ id, slug, role, scope }`. Adding `name` and conditional `email_verified` to this payload gives every service enough information to provision users and gate access without any additional token types or service callbacks.

## Goals / Non-Goals

**Goals:**

- Reduce login/registration from 6 round-trips to 2 (signIn + getToken)
- Eliminate AUTH_CONTEXT and REZICS_SESSION tokens entirely
- Make the server a pure resource server (validates access tokens via JWKS, never issues tokens)
- Enable automatic user provisioning from access token claims (no explicit `/ensure` call)
- Maintain identical auth behavior for Notify and Reaction (near-zero changes)
- Preserve the existing role separation: auth owns identity, server owns business permissions

**Non-Goals:**

- Service-to-service auth refactoring (`x-internal-secret` unchanged)
- Third-party OAuth flow changes (already configured via `oauthProvider` plugin)
- Database schema changes
- Changes to the auth service's session management or social provider configuration
- Admin panel auth flow (follows the same pattern, changes naturally)

## Decisions

### Decision 1: Enrich access token claims with `name` and conditional `email_verified`

**Choice:** Add `name` to `definePayload`. Include `email_verified: false` only when the user is unverified; omit the field when verified.

**Rationale:** AUTH_CONTEXT exists solely to carry `name` and `avatar` to the `/ensure` endpoint for provisioning. Adding `name` to the access token eliminates AUTH_CONTEXT entirely. The `email_verified` field replaces the `canAcquireMemberToken` eligibility gate. Using absence-means-verified avoids payload overhead on the 99% of tokens issued for verified users (the unverified window is minutes to hours after registration).

**Alternative considered:** Always include `email_verified: true/false`. Rejected because it adds ~20 bytes to every token for all time with no benefit — the field is always `true` for verified users.

**Alternative considered:** Block token issuance for unverified users. Rejected because it prevents unverified users from accessing any endpoints at all (not even reading public content), and it mixes verification policy into the token issuer.

### Decision 2: Replace REZICS_SESSION with in-memory user cache

**Choice:** Server resolves user permissions via a `Map<unitId, { user, expiresAt }>` cache backed by Prisma. Cache TTL aligns with access token TTL. `requireOwner` reads from cache instead of requiring a second token.

**Rationale:** The current `requireOwner` macro already queries the database (`userService.getByUnitId` at `permission.ts:99`). The session token role is a stale snapshot checked against the DB result. The cache replaces the snapshot with a time-bound DB result — same performance, simpler architecture, single source of truth for roles.

**Alternative considered:** Encode business roles in the access token via auth-service sync. Rejected because it couples auth to server business logic and introduces a cross-service sync dependency.

**Alternative considered:** No cache, DB lookup on every request. Acceptable for low traffic, but the cache is trivial to implement and prevents unnecessary Prisma queries within the TTL window.

### Decision 3: Lazy provisioning as middleware, not an explicit endpoint

**Choice:** Move user provisioning into the `requireLogin` / `requireOwner` macro chain. On first request with an unknown `sub`, upsert a user record from token claims (`sub`, `slug`, `name`).

**Rationale:** The current flow requires the browser to explicitly call `/users/ensure` with an AUTH_CONTEXT token. This makes the frontend responsible for provisioning timing and requires a separate token type. Server-side lazy provisioning is transparent — the user's first API call provisions them automatically. This is the standard resource-server pattern (GitHub, Google).

**Integration point:** The lazy provisioning runs inside the existing `requireOwner` resolve function, before the role check. If the user is not found, upsert from token claims, then cache the result.

### Decision 4: Frontend reduces to signIn + getToken

**Choice:** `login()` and `register()` become: call auth API → call `ensureAuthIdentityToken()` → hydrate minimal auth state. `establishBusinessSession()` is deleted.

**Rationale:** Without REZICS_SESSION and the explicit ensure endpoint, there's nothing for the frontend to orchestrate between auth and server. The access token is sufficient for all API calls. The first API call handles provisioning transparently.

**What changes in `authSessionStore`:** The `capabilityLevel` concept simplifies. There's no longer a "guest" level (has auth token but no business token). The levels become: `anonymous` (no token) and `member` (has access token). The `needsVerification` flag is derived from the access token's `email_verified` claim.

### Decision 5: Token resolver context key remains `authIdentityToken`

**Choice:** Keep the existing context key name `authIdentityToken` in the Elysia token resolver. Do not rename it to `accessToken`.

**Rationale:** Renaming the context key would cascade through every route file, macro, and handler in the server. The token IS an auth identity token — it's just no longer accompanied by other token types. The semantic is unchanged; only the surrounding infrastructure is removed.

## Risks / Trade-offs

**[Role changes are eventually consistent]** → Role updates take up to cache TTL (aligned with access token TTL, e.g., 15 minutes) to take effect. Mitigation: For critical admin actions (blocking a user), the admin endpoint can invalidate the specific cache entry immediately.

**[First request is slightly slower for new users]** → The upsert during lazy provisioning adds one DB write to the first authenticated request. Mitigation: This is a one-time cost of a few milliseconds, invisible to the user. Subsequent requests hit the cache.

**[Absence-means-verified claim semantics]** → If a bug in `definePayload` drops the `email_verified` claim, unverified users would be treated as verified. Mitigation: The risk is bounded (unverified users are authenticated, just haven't confirmed email — not a privilege escalation). The reverse bug (always including `false`) would lock out all users, which is worse.

**[avatar not in token claims]** → The access token carries `name` but not `avatar` (avatar URLs are large and change frequently). Lazy provisioning creates users without an avatar. Mitigation: The existing onboarding flow prompts for avatar setup. Profile updates via `PUT /users/me` set the avatar independently.

## Data Flow

```
BEFORE (6 round-trips):
  Browser → signIn → getToken → getSessionState → getContextToken → ensure → issueSessionToken

AFTER (2 round-trips + transparent provisioning):
  Browser → signIn → getToken → [first API call auto-provisions]
```

```
BEFORE (per-request validation, server):
  Request → verify authIdentityToken → verify rezicsSessionToken → match tokens
          → DB lookup user → match role snapshot vs DB → proceed

AFTER (per-request validation, server):
  Request → verify authIdentityToken → cache lookup (or DB + cache write) → proceed
```

## Integration Points

| Boundary | Before | After |
|---|---|---|
| Browser → Auth | signIn + getToken + getSessionState + getContextToken | signIn + getToken |
| Browser → Server | ensure + issueSessionToken + Bearer + x-rezics-session-token | Bearer only |
| Browser → Notify | Bearer AUTH_IDENTITY | Bearer access token (same JWKS) |
| Browser → Reaction | Bearer AUTH_IDENTITY | Bearer access token (same JWKS) |
| Server → Auth | getAuthSessionState() callback on every session issuance | None (removed) |
| Auth JWKS | Used by Server, Notify, Reaction | Unchanged |
