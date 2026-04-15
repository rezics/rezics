## Current State

### Token exchange flow

```
Frontend                    Auth Service                 Main Server
────────                    ────────────                 ───────────
1. POST /email-otp/verify-email
   { email, otp }
                            verify OTP
                            updateUser(emailVerified=true)
                            createSession (autoSignIn)
                            ┌─ route interceptor ─┐
                            │ POST /internal/      │
                            │   users/provision    │──▶ upsert user
                            │ (SERVER_INTERNAL_    │    (may fail silently)
                            │  SECRET required)    │
                            └──────────────────────┘
   ◀── { status, token, user }

2. GET /api/auth/token
   ◀── auth-session JWT

3. POST /session/exchange
   (x-auth-session-token)
                                                     lookup user by unitId
                                                     → 404 if not provisioned ❌
```

### Problems

1. **Silent provisioning failure**: `provisionUserOnServer()` returns void if `SERVER_INTERNAL_SECRET` is unset. Errors from the HTTP call are caught and swallowed. No retry, no feedback.
2. **No exchange fallback**: `POST /session/exchange` returns 404 for unprovisioned users with no recovery path.
3. **Missing auth-presence cookie**: OTP verify creates a session but `isSessionEstablishingPath()` doesn't recognize the path, so the auth-presence cookie is never set.
4. **Unnecessary coupling**: Auth-to-server provisioning depends on a shared secret (`SERVER_INTERNAL_SECRET`) when the auth service already has JWT signing capability.

## Target Design

### Self-healing exchange

```
Frontend                    Auth Service                 Main Server
────────                    ────────────                 ───────────
1. POST /email-otp/verify-email
                            verify OTP, create session
                            ┌─ route interceptor ─┐
                            │ sign auth-session JWT│
                            │ POST /session/       │──▶ exchange (new flow)
                            │   exchange           │    lookup user → not found
                            │ (JWT-based, no       │    email_verified? → yes
                            │  shared secret)      │    provisionFromJwt()
                            └──────────────────────┘    return { token }
   ◀── { status, token, user }

2. GET /api/auth/token
   ◀── auth-session JWT

3. POST /session/exchange
   (x-auth-session-token)
                                                     lookup user by unitId
                                                     → found (provisioned at step 1)
                                                     → or: auto-provision (fallback)
                                                     return { token }
```

The exchange endpoint becomes self-healing: if the user doesn't exist but the JWT proves they're email-verified, provision them on the spot. This makes step 1's eager provisioning an optimization, not a requirement.

### Exchange endpoint changes (`package/server`)

**File**: `session.api.ts`

Current (lines 49-56):
```typescript
const user = await prisma.user.findUnique({
  where: { unitId },
  select: { unitId: true, permission: true },
});

if (!user) {
  return status(404, "User not found");
}
```

Target:
```typescript
let user = await prisma.user.findUnique({
  where: { unitId },
  select: { unitId: true, permission: true },
});

if (!user) {
  // Guard: only auto-provision if email is verified.
  // JWT omits email_verified when true; presence of `false` means unverified.
  if (claims.email_verified === false) {
    return status(403, "Email not verified");
  }

  const provisioned = await userService.provisionFromJwt({
    unitId,
    slug: claims.slug,
    name: claims.name,
  });

  user = {
    unitId: provisioned.unitId,
    permission: provisioned.permission,
  };
}
```

### Auth-side provisioning changes (`package/auth`)

**File**: `routes.ts` (lines 110-126)

Replace the `SERVER_INTERNAL_SECRET`-based HTTP call with a JWT-based call to `/session/exchange`:

```typescript
if (response.ok && (isVerifyEmailPath(pathname) || pathname.includes("/email-otp/verify-email"))) {
  try {
    const cloned = response.clone();
    const body = (await cloned.json()) as {
      user?: { id?: string; name?: string };
    };
    if (body.user?.id) {
      await eagerProvisionViaExchange(body.user.id);
    }
  } catch (error) {
    // Best-effort: exchange fallback will handle if this fails
    console.error("[verify-email] Eager provisioning failed:", error);
  }
}
```

The new `eagerProvisionViaExchange` function:
1. Signs an auth-session JWT for the user (using existing JWKS infrastructure)
2. Sends it to `POST ${SERVER_BASE_URL}/session/exchange`
3. Discards the returned rezics-session-token (not needed server-side)

This eliminates the `SERVER_INTERNAL_SECRET` dependency for the registration critical path.

**File**: `routes.ts` (lines 30-36)

Add OTP verify to session-establishing paths:

```typescript
function isSessionEstablishingPath(pathname: string): boolean {
  return (
    pathname.includes("/sign-in") ||
    pathname.includes("/oauth/callback") ||
    pathname.endsWith("/token") ||
    pathname.includes("/email-otp/verify-email")
  );
}
```

**File**: `instance.ts` (lines 46-59)

Add JSDoc to the database hook:

```typescript
databaseHooks: {
  user: {
    create: {
      /**
       * OAuth-only provisioning hook.
       *
       * Fires on user.create — only relevant for OAuth flows where
       * emailVerified is true at account creation time. Email-registered
       * users have emailVerified=false at creation (set to true later
       * via updateUser during OTP verify), so this hook does not serve them.
       * Email users are provisioned via the route interceptor in routes.ts
       * and the self-healing exchange fallback in the server.
       */
      after: async (user) => { ... },
    },
  },
},
```

### JWT signing for eager provisioning (`package/auth`)

The auth service needs to programmatically sign an auth-session JWT outside of a request context. The better-auth JWT plugin exposes signing through `auth.api`. We need to verify this is accessible or use the underlying JWKS infrastructure directly.

**Option A**: Use `auth.api.getToken()` — requires a session context, may be complex.

**Option B**: Use the auth service's own JWT signing infrastructure (`package/auth/src/session/jwt/`) to sign a minimal JWT with the required claims (`sub`, `scope: "user"`). This is more direct and doesn't depend on better-auth internals.

Recommended: **Option B** — the auth service already manages its own JWKS keys. Sign a minimal JWT with the claims the exchange endpoint needs.

## Data Flow

```
                    ┌──────────────────────────────────┐
                    │        Auth Session JWT           │
                    │                                   │
                    │  sub: "<user-id>"      ← unitId   │
                    │  name: "Reader"                    │
                    │  slug: undefined       ← no slug  │
                    │  scope: "user"                     │
                    │  (no email_verified)   ← verified  │
                    │  iss: "<auth-issuer>"              │
                    │  aud: "<auth-audience>"            │
                    └──────────────────┬───────────────┘
                                       │
                         ┌─────────────▼─────────────┐
                         │   POST /session/exchange   │
                         │                             │
                         │  1. Verify JWT via JWKS     │
                         │  2. Extract unitId from sub │
                         │  3. Lookup user             │
                         │     ├── found → sign token  │
                         │     └── not found           │
                         │         ├── email_verified   │
                         │         │   = false → 403   │
                         │         └── (absent) → true │
                         │             provisionFromJwt│
                         │             sign token      │
                         └─────────────────────────────┘
```

## Alternatives Considered

### Keep SERVER_INTERNAL_SECRET provisioning + add exchange fallback only

Simpler change (only modify server), but leaves the auth service coupled to a shared secret that serves no purpose when JWT-based auth already exists. The internal secret remains required in auth's env for a call that the exchange fallback makes redundant.

**Rejected**: unnecessary operational burden for no benefit.

### Provision synchronously inside better-auth's updateUser hook

Add a `user.update.after` database hook that provisions when `emailVerified` flips to `true`. This would catch the OTP verify flow at the database level.

**Rejected**: better-auth's `databaseHooks` don't expose `user.update.after` — only `create.before`, `create.after`, `update.before`. And even if they did, it would still require the internal secret.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Race condition: frontend and eager provisioning both hit exchange simultaneously | Low | `provisionFromJwt` uses `upsert` — idempotent by design |
| JWT signing in auth route interceptor adds latency to verify-email response | Low | Signing is fast (~1ms for ES256). Exchange call is fire-and-forget with error swallowed |
| Unverified user somehow obtains a valid JWT and triggers provisioning | Very low | Exchange checks `email_verified === false` explicitly and rejects with 403 |

## Rollout

1. Deploy server with exchange fallback first — immediately fixes stuck users
2. Deploy auth with JWT-based eager provisioning — eliminates future stuck users
3. `SERVER_INTERNAL_SECRET` can be removed from auth env at convenience (not urgent, other internal endpoints may still use it)

No migration needed. Change is additive.
