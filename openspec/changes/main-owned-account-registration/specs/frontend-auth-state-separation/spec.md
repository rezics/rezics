## MODIFIED Requirements

### Requirement: Authentication state and profile state are managed by separate stores

Frontend SHALL maintain `authSessionStore` as the client-side representation of
server-hydrated auth state, and `userProfileStore` as the client-side
representation of the main product profile. `authSessionStore` SHALL separate
auth-service identity from main member capability:

- `hasAuthIdentity` SHALL mean a valid auth-service session exists.
- `hasMemberSession` SHALL mean main has accepted the user as a Rezics member
  and attached server permission.
- `registrationStage` SHALL be derived from main-aware auth session state as
  `anonymous`, `verify-email`, `setup-account`, or `complete`.

The readable auth-presence cookie SHALL be treated as a passive hydration hint,
not as the authoritative source for `/complete-registration`.

#### Scenario: Member capability derived from server session state

- **WHEN** the browser has a valid `rezics-session-token` httpOnly cookie and
  session hydration succeeds
- **THEN** `authSessionStore.capabilityLevel` SHALL be `"member"`
- **AND** `authSessionStore.hasAuthIdentity` SHALL be `true`
- **AND** `authSessionStore.hasMemberSession` SHALL be `true`
- **AND** user profile queries SHALL be enabled

#### Scenario: Pending auth identity is not a member session

- **WHEN** session hydration reports a valid auth session but
  `registrationComplete` is `false`
- **THEN** `authSessionStore.hasAuthIdentity` SHALL be `true`
- **AND** `authSessionStore.hasMemberSession` SHALL be `false`
- **AND** `authSessionStore.registrationStage` SHALL be either
  `"verify-email"` or `"setup-account"`
- **AND** user profile queries SHALL NOT be enabled

#### Scenario: Anonymous state when no auth identity is valid

- **WHEN** authoritative session hydration confirms there is no valid auth
  session
- **THEN** `authSessionStore.hasAuthIdentity` SHALL be `false`
- **AND** `authSessionStore.hasMemberSession` SHALL be `false`
- **AND** `authSessionStore.registrationStage` SHALL be `"anonymous"`

### Requirement: useAuth hook reads from separated stores

`useAuth()` hook SHALL read auth-session state from `authSessionStore` and
profile state from `userProfileStore`. It SHALL expose auth identity and member
readiness as distinct values so UI code does not infer login state from
`permission !== null`.

#### Scenario: Pending registration is authenticated but not app-ready

- **WHEN** `useAuth()` reads a pending registration state
- **THEN** `hasAuthIdentity` and `authenticated` SHALL be `true`
- **AND** `hasMemberSession` and `readyForApp` SHALL be `false`
- **AND** normal app chrome that requires a main user SHALL redirect to
  `/complete-registration`
