## 1. Shared provisioning utility (`@rezics/auth`)

- [x] 1.1 Extract the provisioning fetch from `instance.ts` into a shared function `provisionUserOnServer({ unitId, slug, name })` in a new module (e.g., `package/auth/src/provisioning/provision.ts`)
- [x] 1.2 Update the `user.create.after` hook in `instance.ts` to call the shared `provisionUserOnServer` function instead of inlining the fetch

## 2. Conditional provisioning hook (`@rezics/auth`)

- [x] 2.1 Add `if (!user.emailVerified) return;` guard at the top of the `user.create.after` hook in `instance.ts`, before the provisioning call

## 3. Verify-email middleware (`@rezics/auth`)

- [x] 3.1 Add a `isVerifyEmailPath(pathname)` helper in `routes.ts` (checks for `/verify-email`)
- [x] 3.2 In `handleAuthRequest`, after `auth.handler(request)` returns, add post-response logic: if `response.ok && isVerifyEmailPath(pathname)`, clone the response, read the JSON body, and call `provisionUserOnServer` with the user's `id`, `name`, and slug
- [x] 3.3 Wrap the provisioning call in a try/catch — log errors but do not block the verification response

## 4. Exchange guard (`@rezics/api`)

- [x] 4.1 In `exchangeForSessionToken()` (`package/api/src/react-query/jwt.ts`), after reading the auth token, parse its claims and return `null` early if `email_verified === false`

## 5. localStorage snapshot (`@rezics/api`)

- [x] 5.1 In `writeAuthSnapshot()` (`package/api/src/react-query/jwt.ts`), add `email_verified` to the persisted state object — set to `false` when the claim is explicitly false, omit otherwise

## 6. Login/register tolerance (`@rezics/app`)

- [x] 6.1 In `login()` (`package/app/src/user/model/handler.ts`), after acquiring the identity token, parse claims — if `email_verified === false`, skip the exchange, hydrate auth state, and return without throwing
- [x] 6.2 In `register()` (`package/app/src/user/model/handler.ts`), apply the same pattern — skip exchange and return without throwing when unverified

## 7. Verify-email page refresh fix (`@rezics/app`)

- [x] 7.1 In `handleRefresh` (`package/app/src/user/page/VerifyEmailPage.tsx`), call `queryAccessToken()` before `hydrateAuthSessionState()` to force-fetch a fresh identity token from the auth service
- [x] 7.2 After hydration, if the new state shows verified, call `exchangeForSessionToken()` to acquire the session token before redirecting

## 8. Validation

- [x] 8.1 Verify `@rezics/auth` builds without errors
- [x] 8.2 Verify `@rezics/api` builds without errors
- [x] 8.3 Verify `@rezics/app` builds without errors
