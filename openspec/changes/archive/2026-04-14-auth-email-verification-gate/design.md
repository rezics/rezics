## Context

The auth flow currently provisions a server-side user record synchronously during the `user.create.after` database hook and the frontend unconditionally exchanges the auth identity token for a session token after login/registration. The identity token already includes `email_verified: false` when unverified (and omits it when verified), but no component in the pipeline acts on this signal.

Current state:

```
Sign Up → auth DB user created → user.create.after → POST /internal/users/provision → server DB user created
       → identity token (email_verified: false) → exchangeForSessionToken() → POST /session/exchange → 404 (or succeeds if provisioning raced)
       → throw "token exchange failed"
```

The verify-email page's "Refresh" button re-parses the local JWT but never fetches a fresh token, so users get stuck even after clicking the verification link.

## Goals / Non-Goals

**Goals:**
- Defer server-side user provisioning to after email verification for email/password sign-ups
- Keep immediate provisioning for social/OAuth sign-ups (email is already verified)
- Prevent the frontend from attempting token exchange when email is unverified
- Make login/registration flows resilient to unverified email state
- Fix the verify-email page refresh to actually detect verification completion
- Persist `email_verified` in the localStorage token snapshot for consistency

**Non-Goals:**
- Changing the identity token claim schema (already correct in `@rezics/contract`)
- Adding server-side email verification checks to the exchange endpoint (the frontend guard is sufficient; the server provisioning endpoint already returns 404 for missing users)
- Cleaning up orphaned unverified user records from prior sign-ups
- Modifying better-auth's email verification logic itself

## Decisions

### 1. Conditional provisioning in `user.create.after` hook

**Decision**: Keep the existing hook but add a guard: `if (!user.emailVerified) return`.

**Rationale**: Simpler than removing the hook and re-adding logic elsewhere. Social/OAuth users (who have verified emails at creation time) continue to provision immediately. The hook remains the single provisioning site for "create-time" provisioning.

**Alternative considered**: Remove the hook entirely and provision all users via the verify-email middleware. Rejected because social sign-ups never hit the verify-email path.

### 2. Verify-email middleware in `handleAuthRequest`

**Decision**: Add post-response logic in `routes.ts` that detects successful `/verify-email` responses, reads the user from the response body, and calls a shared provisioning function.

**Rationale**: `handleAuthRequest` already does post-response processing (cookie setting for session-establishing/clearing paths). This follows the same pattern. The verify-email response body includes the full user object (`{ id, name, email, ... }`), so the middleware has all data needed for provisioning.

**Flow**:
```
handleAuthRequest(request)
    │
    ▼
response = auth.handler(request)
    │
    ▼
response.ok && isVerifyEmailPath(pathname)?
    │
    yes → clone response, read body
        → body.user?.id exists?
            → await provisionUserOnServer({ unitId: user.id, slug, name })
    │
    ▼
return response
```

The provisioning call is **awaited** (not fire-and-forget). If it fails, log the error but still return the verification response — the user's email is verified in the auth DB regardless, and the exchange can retry later.

### 3. Shared provisioning utility

**Decision**: Extract the provisioning fetch into a function like `provisionUserOnServer({ unitId, slug, name })` in a shared module within `@rezics/auth`. Both the hook and the middleware call this function.

**Rationale**: Avoids duplicating the fetch logic, URL construction, and secret header handling.

### 4. Exchange guard in `exchangeForSessionToken()`

**Decision**: At the top of `exchangeForSessionToken()`, parse the identity token claims and return `null` if `email_verified === false`.

**Rationale**: This is the narrowest guard — it protects all callers (login, register, AuthProvider refresh) from making a pointless server call. Placing the guard here rather than in `login()`/`register()` individually prevents future callers from bypassing it.

### 5. Login/register tolerance

**Decision**: `login()` and `register()` in `handler.ts` will check `email_verified` from the identity token claims after acquiring it. If unverified, skip exchange, hydrate auth state, and return without throwing. The caller (UI) relies on the auth store's `needsVerification` state to route to the verify page.

### 6. Force-refresh on verify page

**Decision**: `handleRefresh` in `VerifyEmailPage.tsx` will call `queryAccessToken()` (which fetches a new identity token from the auth service via the session cookie) before calling `hydrateAuthSessionState()`. After hydration, if verified, also trigger `exchangeForSessionToken()` to get the session token.

**Rationale**: The current flow only re-parses the stale local JWT. The session cookie is still valid, so `GET /api/auth/token` returns a fresh JWT with updated claims.

### 7. localStorage snapshot field addition

**Decision**: Add `email_verified` to the `writeAuthSnapshot` state object in `jwt.ts`. Store `false` explicitly when present, omit (or set `undefined`) when verified — mirroring the JWT claim semantics.

## Risks / Trade-offs

- **Race between verification and provisioning**: If the middleware's provisioning call fails but the verify response was already returned, the user is verified in auth DB but not provisioned in server DB. → Mitigation: The exchange will 404, and the user can retry. The provisioning upsert is idempotent, so a manual retry or re-verification is safe. A future improvement could add a retry mechanism.

- **Response body consumption**: Reading the verify-email response body in middleware requires cloning the response. → Mitigation: `response.clone()` before reading JSON. Negligible overhead for a single-user verification request.

- **Stale token in AuthProvider refresh cycle**: The AuthProvider refreshes tokens proactively. If a user verifies email while the app is open, the next AUTH_IDENTITY refresh will get a token without `email_verified: false`, which will unblock the exchange guard and trigger REZICS_SESSION exchange automatically. → This is actually desirable behavior, no mitigation needed.
