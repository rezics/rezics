## 1. Server: Self-healing exchange endpoint

- [ ] 1.1 In `package/server/src/session/session.api.ts`, modify the `POST /session/exchange` handler: when `prisma.user.findUnique` returns null, check `claims.email_verified`. If `email_verified === false`, return `status(403, "Email not verified")`. Otherwise, call `UserService.provisionFromJwt({ unitId, slug: claims.slug, name: claims.name })`, then continue to sign and return the rezics-session-token using the provisioned user's data.
- [ ] 1.2 Add a JSDoc comment above the `unitId` extraction line (`const unitId = claims.unitId || claims.sub`) explaining that `sub` from the auth JWT maps to `unitId` in the server's user model.
- [ ] 1.3 Update `package/server/src/session/session.api.test.ts`: add test case for auto-provisioning (verified user, no existing record → 200 with token). Add test case for unverified user rejection (email_verified: false, no existing record → 403). Verify existing "already provisioned" test still passes.

## 2. Auth: JWT-based eager provisioning

- [ ] 2.1 In `package/auth/src/provisioning/`, create an `eager-exchange.ts` module that exports an `eagerProvisionViaExchange(userId: string)` function. This function signs a minimal auth-session JWT (using the auth service's JWKS infrastructure in `package/auth/src/session/jwt/`) with claims `{ sub: userId, scope: "user" }`, then sends it as `POST ${SERVER_BASE_URL}/session/exchange` with the JWT in the `x-auth-session-token` header. Discard the response on success; log and swallow errors.
- [ ] 2.2 In `package/auth/src/auth/routes.ts` (lines 110-126), replace the `provisionUserOnServer()` call with `eagerProvisionViaExchange(body.user.id)`. The surrounding try-catch and error logging remain. The `provisionUserOnServer` import can be removed from this file.
- [ ] 2.3 Verify that `package/auth/src/provisioning/provision.ts` is no longer imported by `routes.ts`. It remains available for `instance.ts` (OAuth hook) and any other internal callers — do not delete it.

## 3. Auth: Fix auth-presence cookie for OTP verify

- [ ] 3.1 In `package/auth/src/auth/routes.ts`, update `isSessionEstablishingPath()` to include `/email-otp/verify-email`:
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

## 4. Auth: JSDoc for database hook

- [ ] 4.1 In `package/auth/src/auth/instance.ts` (lines 46-59), add a JSDoc comment to the `user.create.after` hook explaining it is designed for OAuth flows only. Email-registered users have `emailVerified=false` at creation time, so this hook does not fire for them. Email users are provisioned via the route interceptor and the server's exchange fallback.

## 5. Validation

- [ ] 5.1 Run `bun test` in `package/server` — all existing tests pass, new exchange tests pass.
- [ ] 5.2 Run `bun run build` in `package/server` and `package/auth` — both compile without errors.
- [ ] 5.3 Manual smoke test: register a new email user, verify via OTP, confirm the user record exists on the main server, confirm the frontend can exchange the auth-session-token for a rezics-session-token.
