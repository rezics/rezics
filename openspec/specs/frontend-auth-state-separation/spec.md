# frontend-auth-state-separation Specification

## Purpose
TBD - created by archiving change decouple-user-domain-from-auth. Update Purpose after archive.
## Requirements
### Requirement: Authentication state and profile state are managed by separate stores

The frontend SHALL maintain independent auth concerns for:
- `authStore`: persisted access token, authentication status, and JWT-derived identity fields (`id`, `slug`, `role`).
- `authSessionStore` or an equivalent dedicated auth-session cache: browser-session identity and readiness metadata such as `email`, `emailVerified`, provider-linked onboarding context, capability-level selectors, and whether a member/business JWT is currently available.
- `userProfileStore`: user profile data (`PartialUserDTO`) for display and business-domain features.

The low-level token read/write, JWT parsing, and token refresh helpers SHALL remain in `package/api/src/react-query/jwt.ts`. `package/api/src/react-query/http.ts` SHALL continue to consume those helpers instead of implementing token persistence itself.

The frontend SHALL NOT use `UserDTO` alone as the source of truth for auth lifecycle decisions such as onboarding redirects, email-verification reminders, or guest-vs-member capability decisions.

#### Scenario: Verified login populates token state, auth-session state, and profile state

- GIVEN an unauthenticated user
- WHEN the user successfully signs in via the auth service and is eligible for member access
- THEN `authStore` SHALL contain the access token, `isAuthenticated = true`, and JWT-derived `id`/`slug`/`role`
- AND the frontend SHALL hydrate auth-session state from the auth service session
- AND `userProfileStore` SHALL contain the user's profile data fetched from `GET /users/me`

#### Scenario: Unverified login restores auth-session state without member token

- GIVEN a registered but unverified user
- WHEN the user signs in via the auth service
- THEN the frontend SHALL hydrate auth-session state from the auth service session
- AND it SHALL record that the user remains at guest capability level
- AND `authStore` SHALL NOT be treated as containing a member-ready business JWT

#### Scenario: Logout clears all auth-related frontend state

- GIVEN an authenticated or registered guest-capable user
- WHEN the user logs out
- THEN `authStore` SHALL be cleared (`accessToken = null`, `isAuthenticated = false`)
- AND auth-session state SHALL be cleared
- AND `userProfileStore` SHALL be cleared (`user = null`)
- AND the persisted `auth-store` localStorage entry SHALL be removed

#### Scenario: Token refresh does not overwrite auth-session lifecycle flags

- GIVEN an authenticated user whose access token has expired
- WHEN `queryAccessToken()` is triggered by `http.ts` retry logic or `AuthProvider`
- THEN `jwt.ts` SHALL fetch `GET /api/auth/token`, persist the new token, and dispatch a token storage event
- AND `authStore` SHALL be re-synced from the persisted token with updated JWT-derived fields
- AND auth-session lifecycle state SHALL remain independently managed
- AND `userProfileStore` SHALL NOT be implicitly overwritten by token refresh alone

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

### Requirement: App bootstrap hydrates auth readiness from the auth service session
The frontend SHALL read the current auth service session after authentication changes so layouts, route guards, and auth flows can determine whether the user is member-ready, needs onboarding, still requires email verification, or only has guest-level capability.

#### Scenario: Existing browser session restores readiness state
- **WHEN** the app boots with a valid auth cookie and either a persisted member token or a guest-capable registered session
- **THEN** the frontend SHALL fetch or restore the current auth session state
- **AND** it SHALL derive readiness flags needed for redirect and banner decisions before treating the session as fully ready

#### Scenario: Session indicates onboarding is still required
- **WHEN** the auth session shows that the authenticated user still needs onboarding
- **THEN** the frontend SHALL redirect the user to the onboarding route instead of the normal post-login destination
- **AND** it SHALL continue to treat the user as guest-capable until onboarding is complete

#### Scenario: Session indicates email verification is still required
- **WHEN** the auth session shows that the authenticated user is not yet verified but is otherwise onboarded
- **THEN** the frontend SHALL allow the auth session to remain active
- **AND** it SHALL expose a verification-required flag for global banner rendering and verification-page navigation
- **AND** it SHALL continue to treat the user as lacking the member JWT required for member APIs

### Requirement: Frontend auth API wrappers cover self-service auth actions
The frontend auth API layer SHALL expose typed actions for self-service auth flows needed by the main app, including OAuth initiation, auth-session retrieval, email verification actions, and post-auth email/password completion.

#### Scenario: App onboarding uses authApi rather than ad hoc fetch calls
- **WHEN** the app onboarding or verification flow needs an auth self-service action
- **THEN** it SHALL invoke a dedicated auth API wrapper from `package/api`
- **AND** page components SHALL NOT construct raw auth URLs or request payloads inline unless a wrapper contract has not yet been established

#### Scenario: OAuth start action is encapsulated in auth API layer
- **WHEN** a login or registration surface starts OAuth sign-in for a provider
- **THEN** the frontend SHALL use an auth API helper or equivalent shared abstraction to construct the flow
- **AND** provider-specific URL details SHALL remain outside page-local business logic

