## MODIFIED Requirements

### Requirement: Main owns Rezics account creation
The system SHALL create a main `User` only through a main-owned materialization operation after the caller has a valid auth session with verified registration facts. Main SHALL create a minimal user first, then require profile setup before issuing normal member capability.

#### Scenario: Email/password user materializes main account after verification
- **WHEN** an email/password registrant verifies their email and main receives trusted verified registration facts from auth
- **THEN** main SHALL create a minimal `User` record
- **AND** main SHALL initialize `server.User.email` from the verified auth login email as main-owned product email
- **AND** main SHALL issue `rezics-profile-setup-token`
- **AND** main SHALL NOT issue `rezics-session-token` yet

#### Scenario: Main account materialization rejects unverified auth session
- **WHEN** an auth-only registrant attempts main account materialization before registration verification is trusted
- **THEN** main SHALL reject the request
- **AND** main SHALL NOT create a `User`
- **AND** main SHALL NOT issue any main token

#### Scenario: Slug conflict is handled during profile setup
- **WHEN** the submitted slug during profile setup conflicts with an existing main `User.slug`
- **THEN** main SHALL return a conflict response
- **AND** the frontend SHALL keep the user on profile setup with a visible slug conflict message

### Requirement: Main user bootstrap occurs during account setup
When profile setup activates a minimal `User` as member-ready, main SHALL perform the product bootstrap that a normal member account requires.

#### Scenario: Profile setup bootstraps product records
- **WHEN** profile setup successfully activates the user as member-ready
- **THEN** system shelves SHALL be bootstrapped
- **AND** default realm membership SHALL be created when configured
- **AND** the user search document SHALL be synced or scheduled for sync
- **AND** main SHALL issue `rezics-session-token`

## ADDED Requirements

### Requirement: Registration verification state is auth-only
An auth user that has not completed required registration verification SHALL remain auth-only. Main SHALL NOT create a main `User`, issue a main token, or require product-domain communication for this state.

#### Scenario: Registration verification is incomplete
- **WHEN** a registrant has an auth session but has not completed required email or future registration-factor verification
- **THEN** auth SHALL hold the temporary registration state
- **AND** main SHALL NOT create a `User`
- **AND** main SHALL NOT issue `rezics-profile-setup-token` or `rezics-session-token`

### Requirement: Profile setup is separate from registration verification
After registration verification succeeds, main SHALL materialize the minimal product user before profile setup. Required profile fields SHALL be collected under the profile setup session, not during auth-only verification.

#### Scenario: Verified registrant enters profile setup
- **WHEN** auth reports verified registration facts and main materializes the minimal user
- **THEN** the frontend SHALL route the user to profile setup
- **AND** the user SHALL submit slug and optional name/avatar using the profile setup token
- **AND** normal member APIs SHALL remain unavailable until setup completes

