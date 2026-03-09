## Why

The `build-independent-auth-server` change successfully established `package/auth` as a dedicated Identity Provider with ES256 JWKS issuance, OAuth 2.1/OIDC, and standardized verification utilities. However, `package/server` and `package/app` still retain legacy authentication logic that duplicates or conflicts with the auth service. The user domain must be fully refactored to treat `package/auth` as the **sole** identity authority and reduce `package/server` to a pure business-data service.

### Problem

- `package/server/src/user/user.core.api.ts` still contains `POST /register`, `POST /login`, `POST /change-password`, `POST /reset-password` routes. Although the top-level `user.api.ts` returns 410 for some of these, the dead code and its dependencies remain.
- `package/server/src/user/user.service.ts` contains `authenticate()`, `verifyPassword()`, `resetPassword()`, `sendVerificationCode()`, and `verifyVerificationCode()` — all identity lifecycle operations that belong exclusively to `package/auth`.
- `package/server/src/user/user.session.service.ts` manages a parallel `AuthSession` model in the server DB, duplicating the session management already handled by better-auth in `package/auth`.
- `package/server/src/core.ts` still instantiates two `@elysiajs/jwt` plugins (HMAC-based `jwt` and `refreshToken`), even though all verification now uses JWKS-based `verifyBearerToken()` from `@package/auth/jwt`.
- `package/server/src/user/user.verify.api.ts` contains `POST /refresh-token`, `POST /send-verification-code`, and `POST /verify-verification-code` — all auth concerns.
- `package/server/src/user/utils.ts` retains `hashPassword()` and `verifyPassword()` — credential operations that belong to the auth boundary.
- `package/api/src/user/user.api.ts` exposes `login()` and `register()` that call server endpoints, rather than the auth service.
- `package/api/src/react-query/http.ts` refreshes tokens via `POST /users/refresh-token` on the server, rather than via the auth service's `/api/auth/token`.
- `package/app/src/user/state/userStore.ts` conflates authentication state (token lifecycle) with user profile data in a single Zustand store.
- `package/app/src/user/model/handler.ts` calls `userApi.login()` / `userApi.register()` which route through the server instead of the auth service.
- The server Prisma schema retains `AuthSession` and `VerificationCode` models that duplicate auth-owned data.
- The server `User` model retains `passwordHash` field, which should be owned exclusively by the auth DB's `Account` model.

### Goals

- Remove all identity lifecycle operations (login, register, password management, email verification, session management) from `package/server`.
- Remove legacy `@elysiajs/jwt` HMAC plugins from server's `core.ts`, keeping only JWKS-based verification via `@package/auth/jwt`.
- Remove `AuthSession` and `VerificationCode` models from the server Prisma schema.
- Remove `passwordHash` from the server's `User` model (credentials are owned by auth DB `Account`).
- Redirect frontend auth flows (`package/api`, `package/app`) to call `package/auth` directly for sign-in, sign-up, token refresh, and sign-out.
- Split the frontend user state into two distinct stores: an auth store (token/session lifecycle) and a user profile store (business profile data).
- Establish a user provisioning strategy to sync identity records from auth DB to server DB on first authenticated access (lazy provisioning).

### Non-goals

- No redesign of the frontend login/register UI layout or UX flow beyond changing the API target.
- No changes to `package/auth` internals — the auth service is complete and stable.
- No RBAC or permission model redesign (the existing `permission` JSON field on server's `User` model stays as-is for now).
- No migration of existing user data between databases in this change (data migration is a separate operational task).

## What Changes

### package/server

- Remove `POST /register`, `POST /login`, `POST /create`, `POST /change-password`, `POST /reset-password` from `user.core.api.ts`.
- Remove `POST /refresh-token`, `POST /send-verification-code`, `POST /verify-verification-code` from `user.verify.api.ts`. If no routes remain, delete the file.
- Remove the 410-guard `onBeforeHandle` in `user.api.ts` (the routes it guards will no longer exist).
- Remove `authenticate()`, `verifyPassword()`, `resetPassword()`, `sendVerificationCode()`, `verifyVerificationCode()`, `resendVerificationCode()` from `user.service.ts`. Remove `nodemailer` transport setup and `SALT_ROUNDS` constant.
- Delete `user.session.service.ts` entirely.
- Delete `allowEmailDomains.ts` (email domain validation is auth's concern or can be moved to auth if needed).
- Remove `hashPassword()` and `verifyPassword()` from `utils.ts`. Keep only `verifyAuth()`.
- Remove the two `@elysiajs/jwt` plugin registrations and `@elysiajs/bearer` import from `core.ts`. The `coreInstance` function should only set up CORS and common middleware.
- Remove `passwordHash` column from `User` model in `prisma/schema.prisma`.
- Remove `AuthSession` model from `prisma/schema.prisma`.
- Remove `VerificationCode` model from `prisma/schema.prisma`.
- Add a lazy-provisioning guard: when `verifyAuth()` succeeds but `userService.getByUnitId(unitId)` returns null, auto-create a minimal business `User` record from the JWT claims (`unitId`, `slug`, email from a `/users/me` context or omitted).
- Update `user.core.api.ts` routes to remove `jwt` and `refreshToken` from destructured Elysia context (they will no longer be provided by `coreInstance`).
- Remove `@elysiajs/jwt` and `bcrypt` from `package/server/package.json` dependencies.

### package/api

- Remove `login()` and `register()` from `user.api.ts`.
- Add `auth.api.ts` wrapping better-auth client SDK calls (`signIn`, `signUp`, `signOut`, `getSession`).
- Update `refreshAuthToken()` in `http.ts` to call the auth service's token endpoint (`/api/auth/token`) instead of `/users/refresh-token`.

### package/app

- Split `userStore.ts` into:
  - `authStore.ts`: owns `accessToken`, `sessionId`, `isAuthenticated`, token refresh lifecycle.
  - `userProfileStore.ts` (renamed from `userStore.ts`): owns `user: PartialUserDTO` profile data only, populated by fetching `/users/me` after auth.
- Update `handler.ts` to call `authApi.signIn()` / `authApi.signUp()` / `authApi.signOut()` instead of `userApi.login()` / `userApi.register()`.
- Update `LoginPage.tsx` and `RegisterPage.tsx` to use the new auth flow.
- Update `useAuth.ts` to read from `authStore` for authentication state and `userProfileStore` for user data.

### package/server Prisma migration

- Generate a Prisma migration to:
  - Drop `AuthSession` table.
  - Drop `VerificationCode` table.
  - Drop `passwordHash` column from `User` table.

## Capabilities

### New Capabilities

- `user-domain-decoupling`: Complete separation of identity lifecycle from business user management, with `package/auth` as sole IdP and `package/server` as pure resource API.
- `lazy-user-provisioning`: Auto-creation of business `User` records on first authenticated access when no matching record exists in the server DB.
- `frontend-auth-state-separation`: Distinct auth and profile state management in the frontend for clean separation of concerns.

### Modified Capabilities

- `es256-jwks-jwt-verification` (from `build-independent-auth-server`): Server's `coreInstance` no longer carries legacy HMAC JWT plugins; JWKS verification is the sole authentication path.

## Impact

### Scope

Affected packages:
- `package/server` (major: route removal, service cleanup, schema migration, dependency removal)
- `package/api` (moderate: auth API client addition, token refresh redirect, login/register removal)
- `package/app` (moderate: state store split, handler rewrite, page updates)
- `package/auth` (none: no changes needed)

### API and behavior impact

- **BREAKING**: `POST /users/register`, `POST /users/login`, `POST /users/create`, `POST /users/change-password`, `POST /users/reset-password`, `POST /users/refresh-token`, `POST /users/send-verification-code`, `POST /users/verify-verification-code` are permanently removed from `package/server`.
- **BREAKING**: `passwordHash` column dropped from server `User` table.
- **BREAKING**: `AuthSession` and `VerificationCode` tables dropped from server DB.
- Frontend auth flows redirect to `package/auth` endpoints.
- Token refresh changes from server cookie-based flow to auth service session-based flow.

### Dependencies and infra

- `@elysiajs/jwt`, `bcrypt`, `nodemailer` removed from `package/server` dependencies.
- Better-auth client SDK added to `package/api` or `package/app` dependencies.
- Prisma migration required for server DB schema changes.

### Backward compatibility and migration

- No backward compatibility window — this is a clean break following the same strategy as `build-independent-auth-server`.
- Existing server-local sessions (`AuthSession` records) become orphaned and should be dropped.
- Users must re-authenticate via the auth service after deployment.
- Server `User` records for existing users must have corresponding records in auth DB (operational data migration prerequisite).
