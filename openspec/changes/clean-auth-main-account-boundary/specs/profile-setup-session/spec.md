## ADDED Requirements

### Requirement: Profile setup uses a separate main token
Main SHALL issue a `rezics-profile-setup-token` for users who have completed registration verification and have a minimal main `User` but have not completed required profile setup. This token SHALL be distinct from `rezics-session-token`.

#### Scenario: Minimal user is materialized
- **WHEN** main creates a minimal user from verified registration facts
- **THEN** main SHALL issue `rezics-profile-setup-token`
- **AND** main SHALL NOT issue `rezics-session-token`

#### Scenario: Normal member API receives setup token
- **WHEN** a normal member API route protected by `requireLogin` receives only `rezics-profile-setup-token`
- **THEN** the request SHALL be rejected
- **AND** the route handler SHALL NOT need to perform a manual capability check

### Requirement: Profile setup routes use a dedicated guard
Server SHALL provide a dedicated profile setup guard that validates `rezics-profile-setup-token` and resolves the minimal main user identity only for profile setup endpoints.

#### Scenario: Profile setup route receives setup token
- **WHEN** a profile setup route receives a valid `rezics-profile-setup-token`
- **THEN** the route SHALL resolve the user identity for profile completion
- **AND** the route SHALL be allowed to update only the fields required for profile setup

#### Scenario: Profile setup route receives member token
- **WHEN** a profile setup route receives a normal member `rezics-session-token`
- **THEN** the route SHALL either reject the request or return an already-complete response
- **AND** it SHALL NOT downgrade a member session to setup state

### Requirement: Member activation replaces setup token with member token
When profile setup succeeds, main SHALL activate the user as member-ready, clear the setup token, and issue the normal `rezics-session-token`.

#### Scenario: User completes required profile fields
- **WHEN** the user submits a valid required slug and optional name/avatar during profile setup
- **THEN** main SHALL mark the user member-ready
- **AND** main SHALL clear `rezics-profile-setup-token`
- **AND** main SHALL issue `rezics-session-token`

#### Scenario: User omits display name
- **WHEN** the profile setup submission has a valid slug but no display name
- **THEN** main SHALL use the slug as the default product display name
- **AND** the user SHALL still be able to complete setup

### Requirement: Profile setup token has explicit purpose
Profile setup JWTs SHALL include an explicit purpose or token type that distinguishes them from member session JWTs.

#### Scenario: Setup verifier validates token purpose
- **WHEN** the server verifies `rezics-profile-setup-token`
- **THEN** the verifier SHALL require a setup-specific purpose or type claim
- **AND** it SHALL reject normal member tokens and unrelated JWTs

### Requirement: Profile setup token expires after fifteen minutes by default
`rezics-profile-setup-token` SHALL have a default lifetime of fifteen minutes. The server SHALL enforce expiration when verifying the token.

#### Scenario: Setup token is older than default lifetime
- **WHEN** a profile setup route receives an expired `rezics-profile-setup-token`
- **THEN** the server SHALL reject the token
- **AND** the frontend SHALL attempt profile setup token renewal if a valid auth session remains

### Requirement: Profile setup token is renewable from auth session
Main SHALL be able to reissue `rezics-profile-setup-token` while the caller has a valid auth session and the main user remains in profile setup state.

#### Scenario: Setup token expires but auth session remains valid
- **WHEN** the setup token expires before profile setup is submitted
- **THEN** the frontend SHALL call a setup-session renewal route
- **AND** main SHALL validate auth state through auth
- **AND** main SHALL issue a fresh `rezics-profile-setup-token` only if the user remains profile-setup-required

