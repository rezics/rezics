## 1. Server auth route removal

- [ ] 1.1 Remove `POST /register` route from `user.core.api.ts` (lines 43–138).
- [ ] 1.2 Remove `POST /login` route from `user.core.api.ts` (lines 202–260).
- [ ] 1.3 Remove `POST /create` route from `user.core.api.ts` (lines 140–196) — admin creation moves to `user.admin.api.ts` `POST /admin` which already exists.
- [ ] 1.4 Remove `POST /change-password` route from `user.core.api.ts` (lines 261–282).
- [ ] 1.5 Remove `POST /reset-password` route from `user.core.api.ts` (lines 284–305).
- [ ] 1.6 Remove `POST /refresh-token` route from `user.verify.api.ts` (lines 23–96).
- [ ] 1.7 Remove `POST /send-verification-code` route from `user.verify.api.ts` (lines 101–140).
- [ ] 1.8 Remove `POST /verify-verification-code` route from `user.verify.api.ts` (lines 146–168).
- [ ] 1.9 If `user.verify.api.ts` has no remaining routes, delete the file and remove `.use(verifyRoute)` from `user.api.ts`.
- [ ] 1.10 Remove the `onBeforeHandle` 410-guard block from `user.api.ts` (lines 12–29).
- [ ] 1.11 Remove unused imports across all modified route files (`sessionService`, `setCookie`, `v7 as uuidv7`, `hashPassword`, `loginSchema`, `createUserSchema` where no longer referenced, `allowEmailDomains`, `verifyTurnstileToken`).

## 2. Server service and utility cleanup

- [ ] 2.1 Remove `authenticate()` method from `user.service.ts` (lines 220–235).
- [ ] 2.2 Remove `verifyPassword()` method from `user.service.ts` (lines 208–215).
- [ ] 2.3 Remove `resetPassword()` method from `user.service.ts` (lines 237–260).
- [ ] 2.4 Remove `sendVerificationCode()` method from `user.service.ts` (lines 262–297).
- [ ] 2.5 Remove `verifyVerificationCode()` method from `user.service.ts` (lines 302–323).
- [ ] 2.6 Remove `resendVerificationCode()` method from `user.service.ts` (lines 327–329).
- [ ] 2.7 Remove `nodemailer` import, `transporter` setup, and `SALT_ROUNDS` constant from `user.service.ts` (lines 11–31).
- [ ] 2.8 Remove `hashPassword` and `verifyPassword` imports from `user.service.ts`.
- [ ] 2.9 Delete `user.session.service.ts` entirely.
- [ ] 2.10 Delete `allowEmailDomains.ts`.
- [ ] 2.11 Remove `hashPassword()` and `verifyPassword()` functions from `utils.ts`. Remove `bcrypt` import. Keep only `verifyAuth()`.
- [ ] 2.12 Update `index.ts` exports to remove `JWTPayload` type export if no longer needed externally, and remove any re-exports of deleted modules.

## 3. Server core instance cleanup

- [ ] 3.1 Remove the two `jwt({...})` plugin registrations from `core.ts`.
- [ ] 3.2 Remove `@elysiajs/bearer` usage from `core.ts`.
- [ ] 3.3 Remove `jwt` and `bearer` imports from `core.ts`.
- [ ] 3.4 Update all route handlers in `user.core.api.ts`, `user.admin.api.ts`, `user.follow.api.ts` to remove `jwt`, `refreshToken`, `cookie: {refresh_token}` from destructured context parameters.
- [ ] 3.5 Verify `verifyAuth()` function signature — it already ignores `jwtInstance` (`void jwtInstance`); consider simplifying to accept only `authorization` string and `set` object.
- [ ] 3.6 Remove `@elysiajs/jwt`, `@elysiajs/bearer`, `bcrypt`, `@types/bcrypt`, `nodemailer`, `@types/nodemailer`, `uuid` from `package/server/package.json` dependencies (verify each is truly unused first with repo-wide grep).
- [ ] 3.7 Run `tsc` (or `bun run build`) for `package/server` to verify no type errors.

## 4. Server Prisma schema migration

- [ ] 4.1 Remove `passwordHash String` field from `User` model in `package/server/prisma/schema.prisma`.
- [ ] 4.2 Remove `AuthSession` model from `package/server/prisma/schema.prisma`.
- [ ] 4.3 Remove `VerificationCode` model from `package/server/prisma/schema.prisma`.
- [ ] 4.4 Run `bunx prisma migrate dev --name remove-auth-owned-models` to generate and apply migration.
- [ ] 4.5 Run `bun run prisma:generate` to regenerate Prisma client.
- [ ] 4.6 Fix any type errors in `user.service.ts` `create()` method that previously set `passwordHash`.
- [ ] 4.7 Verify `mapper.ts` does not reference `passwordHash` (it does not currently, but confirm).

## 5. Lazy user provisioning

- [ ] 5.1 Add a `provisionFromJwt(payload: {unitId: string; slug?: string; email?: string})` method to `user.service.ts` that creates a minimal `User` record with defaults.
- [ ] 5.2 Update `GET /users/me` handler in `user.core.api.ts`: after `verifyAuth()`, if `userService.getByUnitId(unitId)` throws (not found), call `provisionFromJwt()` and return the new record.
- [ ] 5.3 Add a test for lazy provisioning: valid JWT + no existing user → user is created and returned.
- [ ] 5.4 Decide and document whether `email` is provisioned from JWT claims or left null (see open question in design).

## 6. Frontend auth API client (package/api)

- [ ] 6.1 Create `package/api/src/auth/auth.api.ts` with methods wrapping auth service calls: `signIn(email, password)`, `signUp(email, password, slug)`, `signOut()`, `getSession()`.
- [ ] 6.2 Add auth service base URL configuration (e.g., `VITE_AUTH_URL` env var) to `package/api` or `package/app` env.
- [ ] 6.3 Update `refreshAuthToken()` in `http.ts` to call auth service token endpoint instead of `POST /users/refresh-token`.
- [ ] 6.4 Remove `login()` and `register()` from `package/api/src/user/user.api.ts`.
- [ ] 6.5 Remove `sendVerificationCode()` from `user.api.ts` if verification is fully handled by auth.
- [ ] 6.6 Remove `resetPassword()` from `user.api.ts` if password reset is fully handled by auth.

## 7. Frontend state store split (package/app)

- [ ] 7.1 Create `package/app/src/user/state/authStore.ts` with Zustand store: `accessToken`, `isAuthenticated`, `setToken()`, `clearAuth()`, `init()` (reads token from localStorage).
- [ ] 7.2 Rename `userStore.ts` to `userProfileStore.ts`. Remove token/auth logic. Keep only `user: PartialUserDTO`, `setUser()`, `clearProfile()`.
- [ ] 7.3 Update `package/app/src/user/state/index.ts` to export both stores.
- [ ] 7.4 Update `getToken()` in `package/api/src/react-query/http.ts` to read from `authStore` (or keep localStorage key aligned with `authStore` persistence key).
- [ ] 7.5 Update all `useUserStore` import sites across `package/app` to use either `useAuthStore` or `useUserProfileStore` as appropriate.
- [ ] 7.6 Run repo-wide grep for `useUserStore` and `user-store` localStorage key to find and update all references.

## 8. Frontend handler and page updates (package/app)

- [ ] 8.1 Update `handler.ts` `login()` to call `authApi.signIn()` → store token in `authStore` → fetch `/users/me` → store profile in `userProfileStore`.
- [ ] 8.2 Update `handler.ts` `register()` to call `authApi.signUp()` → same flow as login.
- [ ] 8.3 Update `handler.ts` `logout()` to call `authApi.signOut()` → clear `authStore` → clear `userProfileStore`.
- [ ] 8.4 Update `LoginPage.tsx` to use updated `login()` handler (no API change needed if handler interface stays the same).
- [ ] 8.5 Update `RegisterPage.tsx` to use updated `register()` handler.
- [ ] 8.6 Update `useAuth.ts` to read `isAuthenticated` from `authStore` and `user` from `userProfileStore`.
- [ ] 8.7 Update `ResetPasswordPage.tsx` to call auth service for password reset instead of server.

## 9. Validation and cleanup

- [ ] 9.1 Run `tsc` for `package/server`, `package/api`, `package/app` — fix all type errors.
- [ ] 9.2 Update `auth.e2e.test.ts` to remove tests for deleted routes and add tests for JWKS-only verification path.
- [ ] 9.3 Run full end-to-end test: auth sign-in → bearer call to server `/users/me` → profile returned.
- [ ] 9.4 Run end-to-end test for lazy provisioning: new auth user → `/users/me` → auto-provisioned profile.
- [ ] 9.5 Run end-to-end test for token refresh: expired JWT → auth refresh → retry succeeds.
- [ ] 9.6 Grep repo-wide for any remaining references to deleted functions/files (`sessionService`, `allowEmailDomains`, `hashPassword`, `verifyPassword`, `authenticate`, `user.session.service`, `refreshToken` in core.ts context).
- [ ] 9.7 Run `bun install` to verify dependency tree is clean after removing packages from `package.json`.
- [ ] 9.8 Verify `knip` (dead code detector) passes or update `knip.config.ts` if needed.
