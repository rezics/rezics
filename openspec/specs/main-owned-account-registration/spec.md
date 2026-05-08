# main-owned-account-registration Specification

## Purpose

Defines main-owned Rezics account creation, slug claiming, temporary auth account lifecycle, non-destructive registration pause, and verified-email-to-main-user promotion. The main server owns the `User` record and slug authority. Auth holds credentials, sessions, verification, and provider linking, while main creates the product user only after a trusted verified email and a successful account setup submission.

## Requirements

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

### Requirement: Temporary auth accounts do not create product users
An auth user that has not completed email verification and main account setup SHALL remain an auth-only temporary account and SHALL NOT have a main `User`.

#### Scenario: Unverified registrant remains auth-only
- **WHEN** email/password sign-up succeeds but email verification has not completed
- **THEN** auth SHALL hold the temporary auth account and session
- **AND** main SHALL NOT create a `User`
- **AND** member-only product APIs SHALL remain unavailable

### Requirement: Pending registration can be paused without deleting auth identity
The system SHALL provide a pause-registration action for auth-only pending registrants. Pausing SHALL sign the browser out and clear local/main browser session state without deleting, disabling, or otherwise changing the temporary auth account.

#### Scenario: User pauses pending email registration
- **WHEN** an auth-only unverified registrant chooses to continue later
- **THEN** the app SHALL sign out through the normal auth boundary
- **AND** browser auth presence, main session cookies, and frontend auth/profile state SHALL be cleared
- **AND** the auth account and verification state SHALL remain recoverable

#### Scenario: Paused user signs in again
- **WHEN** a user whose temporary registration was paused signs in again
- **THEN** auth SHALL establish a normal auth session for the existing account
- **AND** the app SHALL resume the pending verification or setup step

### Requirement: Pending registration re-entry is deterministic
The system SHALL route users with existing unverified temporary auth accounts back to the verification step whenever they authenticate or attempt to register again before cleanup.

#### Scenario: Pending user logs in again
- **WHEN** a user signs in with credentials for an existing unverified temporary auth account
- **THEN** auth SHALL establish an auth session
- **AND** the frontend SHALL route to the locked email verification screen

#### Scenario: Pending email attempts register again
- **WHEN** a user submits registration for an email that already belongs to an unverified temporary auth account
- **THEN** the system SHALL return a recoverable pending-registration response or establish a pending auth session
- **AND** the frontend SHALL route to email verification instead of creating a duplicate account

### Requirement: Stale temporary auth accounts are cleanable
Auth SHALL support cleanup of temporary unverified accounts that never complete registration.

#### Scenario: Stale temporary account expires
- **WHEN** an unverified temporary auth account remains incomplete beyond the configured retention period
- **THEN** auth cleanup SHALL delete or disable the temporary account and related sessions/verifications
- **AND** no main `User` cleanup SHALL be required because no main user was created
