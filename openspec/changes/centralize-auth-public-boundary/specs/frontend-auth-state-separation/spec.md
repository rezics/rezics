## MODIFIED Requirements

### Requirement: Authentication state and profile state are managed by separate stores

Frontend SHALL maintain `authSessionStore` as the client-side representation of authentication state, but browser auth state SHALL be hydrated from cookie-backed session APIs rather than local JWT parsing. `authSessionStore` SHALL derive `capabilityLevel` from server-reported main session state: `anonymous` when no valid main session exists, or `member` when a valid `rezics-session-token` cookie is accepted by main. Verification state SHALL be derived from server session state returned by auth/main APIs, not from browser-parsed `auth-session-token` claims.

#### Scenario: Member capability derived from server session state

- **WHEN** the browser has a valid `rezics-session-token` httpOnly cookie and session hydration succeeds
- **THEN** `authSessionStore.capabilityLevel` SHALL be `"member"` and `hasAuthSession` SHALL be `true`

#### Scenario: Anonymous state when no main session cookie is valid

- **WHEN** no valid main session exists or session hydration fails with an unauthenticated response
- **THEN** `authSessionStore.capabilityLevel` SHALL be `"anonymous"` regardless of any auth session cookie presence

#### Scenario: Needs verification derived from session API

- **WHEN** the session state API reports that the auth email is not verified
- **THEN** `authSessionStore.needsVerification` SHALL be `true`

### Requirement: useAuth hook reads from separated stores

`useAuth()` hook SHALL read authentication state from `authSessionStore`. User identity SHALL come from server-hydrated session state or profile APIs, and profile data SHALL come from `userProfileStore` or API queries. Frontend code SHALL NOT parse browser-stored `rezics-session-token` or `auth-session-token` JWT claims for identity, role, unit, or verification state.

#### Scenario: useAuth returns identity from hydrated state

- **WHEN** `useAuth()` is called after session hydration succeeds
- **THEN** the returned identity SHALL include actor `userId` and relevant session flags from server-provided state
- **AND** it SHALL NOT depend on localStorage JWT claims

## ADDED Requirements

### Requirement: Frontend auth URLs target main auth boundary

Browser frontend packages SHALL use main-relative `/auth/*` routes for auth, OAuth, callback, session, and admin flows. Browser code SHALL NOT require a direct auth host environment variable for normal web auth flows.

#### Scenario: Frontend starts social login

- **WHEN** the app starts a social sign-in flow
- **THEN** it SHALL navigate to or call a main `/auth/*` URL
- **AND** it SHALL NOT call `auth.rezics.com` directly
