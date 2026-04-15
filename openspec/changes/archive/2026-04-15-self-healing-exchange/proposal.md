## Why

After a user registers via email and completes OTP verification, the auth service attempts to provision a corresponding user record on the main server via an HTTP call to `/internal/users/provision`. This call depends on `SERVER_INTERNAL_SECRET` being configured and the server being reachable — if either condition fails, provisioning silently skips with no retry or feedback. The user receives a successful verification response but has no record on the main server. When the frontend subsequently exchanges the auth-session-token for a rezics-session-token, the server returns 404 "User not found" and the user is stuck.

This is a critical-path reliability problem: a single point of failure (an env var or network blip) permanently blocks newly registered users from accessing the platform.

## Background

### Current provisioning flow

```
Auth Service                              Main Server
────────────────                          ────────────
OTP verify-email
  ├── better-auth: updateUser(emailVerified=true)
  ├── route interceptor (routes.ts:110-126):
  │     POST /internal/users/provision     ──────▶  upsert user record
  │     (requires SERVER_INTERNAL_SECRET)           (may fail silently)
  └── return { status, token, user }

Frontend
────────
  GET /api/auth/token                     ──────▶  auth-session JWT
  POST /session/exchange                  ──────▶  404 "User not found" ❌
    (x-auth-session-token header)
```

### Two separate provisioning triggers exist

1. **Database hook** (`instance.ts:46-59`): `user.create.after` — only fires when `emailVerified=true` at creation time. Designed for OAuth flows where email is pre-verified. Does not fire for email registration (emailVerified is false at creation, and OTP verify calls `updateUser`, not `createUser`).

2. **Route interceptor** (`routes.ts:110-126`): intercepts verify-email responses, extracts user from body, calls `provisionUserOnServer()`. This is the intended path for email-registered users but fails silently if `SERVER_INTERNAL_SECRET` is unset or the server is unreachable.

### Additional issues discovered

- **Missing auth-presence cookie**: `isSessionEstablishingPath()` does not include the OTP verify path, so the auth-presence cookie is not set even though `autoSignInAfterVerification` creates a session.
- **No slug at registration**: The auth User model has no `slug` field (it's on the separate `UserProfile` table). New users are provisioned with a UUID as their slug placeholder. Users need an onboarding step to claim a real slug (one-time claim, not freely changeable).

## What Changes

- **Self-healing exchange endpoint**: `/session/exchange` gains a fallback — when user lookup returns null and the JWT indicates `email_verified` (absence of `email_verified: false` claim), auto-provision the user via `UserService.provisionFromJwt()` before issuing the session token.
- **Simplify auth-side provisioning**: Replace the `SERVER_INTERNAL_SECRET`-based HTTP call in `routes.ts` with a JWT-based call to `/session/exchange`. The auth service already has signing infrastructure; no extra shared secret needed. This becomes a best-effort optimization (eager provisioning), not a critical path.
- **Fix auth-presence cookie**: Add OTP verify path to `isSessionEstablishingPath()` so the auth-presence cookie is set after OTP verification with auto-sign-in.
- **Add JSDoc to database hook**: Clarify that the `user.create.after` hook is intentionally for OAuth-only provisioning.
- **Add JSDoc to exchange endpoint**: Document that `sub` claim maps to `unitId` for provisioning.

## Non-goals

- Slug onboarding UI or slug-change policy enforcement — those are separate concerns for a future change.
- Removing `/internal/users/provision` endpoint — it remains available for admin/tooling use.
- Changing the JWT payload structure — `sub` remains the primary user identifier, no new `unitId` field added.

## Capabilities

### New Capabilities

- `exchange-auto-provision`: Server-side fallback that auto-provisions users during token exchange when they exist in auth but not yet on the main server. Covers the exchange endpoint logic, email verification guard, and provisioning-from-JWT flow.

### Modified Capabilities

_(none — no existing spec-level requirements are changing)_

## Impact

### Affected packages

| Package | Changes |
|---------|---------|
| `package/server` | `session.api.ts` — add provisioning fallback to exchange endpoint |
| `package/auth` | `routes.ts` — replace internal-secret provisioning with JWT-based exchange call; `instance.ts` — add JSDoc to DB hook |
| `package/auth` | `routes.ts` — add OTP verify to `isSessionEstablishingPath()` |

### Backward compatibility

- `/internal/users/provision` endpoint remains unchanged — no breaking changes for existing internal callers.
- `/session/exchange` returns the same response shape on success. The only behavioral change: requests that previously returned 404 for unprovisioned-but-verified users now succeed with auto-provisioning.
- `SERVER_INTERNAL_SECRET` is no longer required for the registration critical path, but remains used by other internal endpoints.

### Migration

None required. The change is additive — existing provisioned users are unaffected, and unprovisioned users gain a self-healing path.
