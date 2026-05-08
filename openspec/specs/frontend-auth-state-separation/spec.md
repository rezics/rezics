# frontend-auth-state-separation Specification

## Purpose

Defines how the frontend separates auth-service identity from main member capability across `authSessionStore`, `userProfileStore`, and the `useAuth()` hook. State is hydrated from server APIs rather than parsed JWT claims, and the frontend distinguishes anonymous, pending registration, and member-ready states so UI never confuses an auth-only registrant for a fully registered Rezics member.

## Requirements

### Requirement: Authentication state and profile state are managed by separate stores
Frontend SHALL maintain `authSessionStore` as the client-side representation of server-hydrated auth/account state, and `userProfileStore` as the client-side representation of the main product profile. `authSessionStore` SHALL separate auth-service identity from main member capability:

- `hasAuthIdentity` SHALL mean a valid auth-service session exists.
- `hasProfileSetupSession` SHALL mean main has materialized a minimal user and issued a valid profile setup token.
- `hasMemberSession` SHALL mean main has accepted the user as a Rezics member and attached server permission.
- `registrationStage` SHALL be derived from authoritative server state as `anonymous`, `registration-verify`, `profile-required`, or `complete`.

Readable auth-presence and account-stage cookies SHALL be treated as passive hydration/routing hints, not as authoritative sources for `/complete-registration`.

#### Scenario: Member capability derived from server session state
- **WHEN** the browser has a valid `rezics-session-token` httpOnly cookie and session hydration succeeds
- **THEN** `authSessionStore.capabilityLevel` SHALL be `"member"`
- **AND** `authSessionStore.hasAuthIdentity` SHALL be `true`
- **AND** `authSessionStore.hasMemberSession` SHALL be `true`
- **AND** user profile queries SHALL be enabled

#### Scenario: Registration verification identity is not a member session
- **WHEN** session hydration reports a valid auth session but required registration verification is incomplete
- **THEN** `authSessionStore.hasAuthIdentity` SHALL be `true`
- **AND** `authSessionStore.hasProfileSetupSession` SHALL be `false`
- **AND** `authSessionStore.hasMemberSession` SHALL be `false`
- **AND** `authSessionStore.registrationStage` SHALL be `"registration-verify"`
- **AND** user profile queries SHALL NOT be enabled

#### Scenario: Profile setup session is not a member session
- **WHEN** authoritative state reports a valid profile setup token but no member token
- **THEN** `authSessionStore.hasProfileSetupSession` SHALL be `true`
- **AND** `authSessionStore.hasMemberSession` SHALL be `false`
- **AND** `authSessionStore.registrationStage` SHALL be `"profile-required"`
- **AND** normal member profile queries SHALL NOT be enabled outside profile setup

#### Scenario: Anonymous state when no auth identity is valid
- **WHEN** authoritative session hydration confirms there is no valid auth session
- **THEN** `authSessionStore.hasAuthIdentity` SHALL be `false`
- **AND** `authSessionStore.hasMemberSession` SHALL be `false`
- **AND** `authSessionStore.registrationStage` SHALL be `"anonymous"`

### Requirement: Account-stage cookie is a routing hint only
Frontend MAY read a public account-stage cookie for initial routing, but SHALL verify the stage through server APIs before enabling protected UI or issuing member-only requests.

#### Scenario: Account-stage cookie claims member state
- **WHEN** the readable account-stage cookie says `"member"` but server hydration does not confirm a member session
- **THEN** the frontend SHALL treat the user according to authoritative server state
- **AND** it SHALL NOT enable member-only routes based only on the cookie

#### Scenario: Account-stage cookie claims profile setup state
- **WHEN** the readable account-stage cookie says `"profile-required"`
- **THEN** the frontend MAY route to profile setup immediately
- **AND** it SHALL confirm the setup token or server state before submitting profile setup mutations

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

### Requirement: Frontend auth URLs target main auth boundary

Browser frontend packages SHALL use main-relative `/auth/*` routes for auth, OAuth, callback, session, and admin flows. Browser code SHALL NOT require a direct auth host environment variable for normal web auth flows.

#### Scenario: Frontend starts social login

- **WHEN** the app starts a social sign-in flow
- **THEN** it SHALL navigate to or call a main `/auth/*` URL
- **AND** it SHALL NOT call `auth.rezics.com` directly
