## MODIFIED Requirements

### Requirement: Authentication state and profile state are managed by separate stores

The frontend SHALL maintain independent auth concerns for:
- `authSessionStore`: the sole source of truth for authentication state, hydrated from `get-session-state`. Holds session data, user identity, readiness metadata (`capabilityLevel`, `needsVerification`, `needsOnboarding`, `hasAuthSession`, `hasBusinessToken`).
- `userProfileStore`: user profile data (`PartialUserDTO`) for display and business-domain features.

`authStore` (the token-mirroring Zustand store) SHALL be eliminated. Token presence SHALL NOT be mirrored into reactive state. Tokens exist only in localStorage as transport credentials.

The low-level token read/write, JWT parsing, and token refresh helpers SHALL remain in `package/api/src/react-query/jwt.ts`. `package/api/src/react-query/http.ts` SHALL continue to consume those helpers instead of implementing token persistence itself.

The frontend SHALL NOT use `UserDTO` alone as the source of truth for auth lifecycle decisions such as onboarding redirects, email-verification reminders, or guest-vs-member capability decisions.

#### Scenario: Verified login populates session state and profile state

- **WHEN** the user successfully signs in via the auth service and is eligible for member access
- **THEN** `authSessionStore` SHALL contain session data with `capabilityLevel: 'member'` and `hasAuthSession: true`
- **AND** the frontend SHALL hydrate auth-session state from the auth service session
- **AND** `userProfileStore` SHALL contain the user's profile data fetched from `GET /users/me`

#### Scenario: Unverified login restores auth-session state without member token

- **GIVEN** a registered but unverified user
- **WHEN** the user signs in via the auth service
- **THEN** the frontend SHALL hydrate auth-session state from the auth service session
- **AND** it SHALL record that the user remains at guest capability level
- **AND** REZICS_SESSION SHALL NOT exist in localStorage

#### Scenario: Logout clears all auth-related frontend state

- **GIVEN** an authenticated or registered guest-capable user
- **WHEN** the user logs out
- **THEN** `authSessionStore` SHALL be cleared
- **AND** `userProfileStore` SHALL be cleared (`user = null`)
- **AND** all token localStorage entries SHALL be removed

#### Scenario: Token refresh does not affect auth-session state

- **GIVEN** an authenticated user whose access token has expired
- **WHEN** AuthProvider refreshes the token
- **THEN** `jwt.ts` SHALL persist the new token and dispatch a token storage event
- **AND** `authSessionStore` SHALL remain independently managed (not updated by token refresh alone)
- **AND** `userProfileStore` SHALL NOT be implicitly overwritten by token refresh alone

### Requirement: useAuth hook reads from separated stores

The `useAuth()` hook SHALL read authentication state from `authSessionStore` and user data from `userProfileStore`. It SHALL NOT read from `authStore` or derive state from token presence.

#### Scenario: Authentication check without profile

- **GIVEN** a user who has an active auth session but whose profile has not yet been fetched
- **WHEN** `useAuth()` is called
- **THEN** `isAuthenticated` SHALL be `true` (derived from `authSessionStore.hasAuthSession`)
- **AND** `user` SHALL be `null`
- **AND** `loading` SHALL be `true` (profile fetch in progress)

#### Scenario: Fully loaded authenticated user

- **GIVEN** a user with an active auth session and a fetched profile
- **WHEN** `useAuth()` is called
- **THEN** `isAuthenticated` SHALL be `true`
- **AND** `user` SHALL contain the `UserDTO` data
- **AND** `loading` SHALL be `false`

#### Scenario: Anonymous user

- **GIVEN** no auth session exists
- **WHEN** `useAuth()` is called
- **THEN** `isAuthenticated` SHALL be `false`
- **AND** `capabilityLevel` SHALL be `'anonymous'`
- **AND** `user` SHALL be `null`

## REMOVED Requirements

### Requirement: authStore mirrors token claims

**Reason**: `authStore` is eliminated. Token claims (isAuthenticated, id, slug, role) are no longer mirrored into Zustand state. `authSessionStore` (hydrated from `get-session-state`) is the sole source of truth for authentication state.

**Migration**: All consumers of `authStore` SHALL migrate to `useAuth()` or `authSessionStore`. The re-export files in `package/app/src/user/state/authStore.ts` SHALL be removed.
