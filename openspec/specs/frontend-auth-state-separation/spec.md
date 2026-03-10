# frontend-auth-state-separation Specification

## Purpose
TBD - created by archiving change decouple-user-domain-from-auth. Update Purpose after archive.
## Requirements
### Requirement: Authentication state and profile state are managed by separate stores

The frontend SHALL maintain two independent Zustand stores:
- `authStore`: owns the persisted access token, authentication status, and JWT-derived identity fields (`id`, `slug`, `role`).
- `userProfileStore`: owns user profile data (`PartialUserDTO`) for display purposes.

The low-level token read/write, JWT parsing, and token refresh helpers SHALL live in `package/api/src/react-query/jwt.ts`. `package/api/src/react-query/http.ts` SHALL consume those helpers instead of implementing token persistence itself.

#### Scenario: Login populates both stores

- GIVEN an unauthenticated user
- WHEN the user successfully signs in via the auth service
- THEN `useSignInMutation()` SHALL obtain a fresh access token via `queryAccessToken()`
- AND `authStore` SHALL contain the access token, `isAuthenticated = true`, and JWT-derived `id`/`slug`/`role`
- AND `userProfileStore` SHALL contain the user's profile data fetched from `GET /users/me`

#### Scenario: Logout clears both stores

- GIVEN an authenticated user
- WHEN the user logs out
- THEN `authStore` SHALL be cleared (`accessToken = null`, `isAuthenticated = false`)
- AND `userProfileStore` SHALL be cleared (`user = null`)
- AND the persisted `auth-store` localStorage entry SHALL be removed

#### Scenario: Token refresh updates only authStore

- GIVEN an authenticated user whose access token has expired
- WHEN `queryAccessToken()` is triggered by `http.ts` retry logic or `AuthProvider`
- THEN `jwt.ts` SHALL fetch `GET /api/auth/token`, persist the new token, and dispatch a token storage event
- AND `authStore` SHALL be re-synced from the persisted token with updated JWT-derived fields
- AND `userProfileStore` SHALL NOT be affected

### Requirement: Frontend auth flows target the auth service directly

All authentication operations (sign-in, sign-up, sign-out, token refresh, password reset) SHALL be performed by calling `package/auth` endpoints, not `package/server` endpoints.

#### Scenario: Sign-in calls auth service

- GIVEN the user submits credentials on the login page
- WHEN the sign-in mutation is invoked
- THEN it SHALL call the auth service's sign-in endpoint (e.g., `POST /api/auth/sign-in/email`)
- AND it SHALL NOT call `POST /users/login` on the server

#### Scenario: Sign-up calls auth service

- GIVEN the user submits registration data
- WHEN the sign-up handler is invoked
- THEN it SHALL call the auth service's sign-up endpoint (e.g., `POST /api/auth/sign-up/email`)
- AND it SHALL NOT call `POST /users/register` on the server

#### Scenario: Token refresh calls auth service

- GIVEN an API call returns `401` due to expired token
- WHEN `queryAccessToken()` is invoked from `jwt.ts`
- THEN it SHALL call the auth service's `GET /api/auth/token` endpoint
- AND it SHALL NOT call `POST /users/refresh-token` on the server

### Requirement: userApi no longer exposes auth operations

`package/api/src/user/user.api.ts` SHALL NOT expose `login()`, `register()`, or `sendVerificationCode()` methods. These operations SHALL be handled by a separate `authApi` module.

#### Scenario: userApi methods removed

- GIVEN the `userApi` object in `package/api`
- WHEN inspecting its methods
- THEN it SHALL NOT include `login`, `register`, or `sendVerificationCode`
- AND it SHALL retain `me`, `updateMe`, `get`, `update`, `follow`, `unfollow`, `getFollowStatus`, `getFollowSummary`, `getFollowers`, `getFollowings`, `adminList`, `adminGet`, `adminCreate`, `adminUpdate`, `delete`, `deleteMe`

### Requirement: useAuth hook reads from separated stores

The `useAuth()` hook SHALL read `isAuthenticated` from `authStore` and `user` data from `userProfileStore`.

#### Scenario: Authentication check without profile

- GIVEN a user who has a valid token in `authStore` but whose profile has not yet been fetched
- WHEN `useAuth()` is called
- THEN `isAuthenticated` SHALL be `true`
- AND `user` SHALL be `null`
- AND `loading` SHALL be `true` (profile fetch in progress)

#### Scenario: Fully loaded authenticated user

- GIVEN a user with both a valid token and a fetched profile
- WHEN `useAuth()` is called
- THEN `isAuthenticated` SHALL be `true`
- AND `user` SHALL contain the `UserDTO` data
- AND `loading` SHALL be `false`
