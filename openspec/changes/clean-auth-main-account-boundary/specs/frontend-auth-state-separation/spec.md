## MODIFIED Requirements

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

## ADDED Requirements

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

