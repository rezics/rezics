## ADDED Requirements

### Requirement: Member readiness predicate is `slug !== null`

The system SHALL use `User.slug !== null` as the sole predicate for "this main user is member-ready." A separate `accountStatus` column SHALL NOT exist on the `User` table. All readiness checks (cookie-boundary refresh gating, Meili sync skipping, server-side filters that avoid surfacing unfinished users) SHALL be expressed as slug-presence checks.

#### Scenario: Profile-setup-stage user has null slug

- **WHEN** a user has been materialized via the cookie boundary but has not completed profile setup
- **THEN** `User.slug` SHALL be `null`
- **AND** the user SHALL be granted a `rezics-profile-setup-token` only, never a `rezics-session-token`
- **AND** any code reading `accountStatus` SHALL fail to compile (the field does not exist)

#### Scenario: Member-ready user has non-null slug

- **WHEN** a user has completed profile setup
- **THEN** `User.slug` SHALL be a non-empty string and globally unique
- **AND** the user SHALL be eligible to receive a `rezics-session-token` via the cookie boundary
- **AND** Meili sync SHALL include the user

#### Scenario: Readiness check is consistent across services

- **WHEN** any service evaluates "is this user member-ready"
- **THEN** the predicate SHALL be `user.slug != null`
- **AND** no service SHALL read or rely on a `UserAccountStatus` enum value

## MODIFIED Requirements

### Requirement: Main owns Rezics account creation

The system SHALL create a main `User` only through a main-owned account setup operation after the caller has a valid auth session with a trusted verified email and has submitted the required Rezics account fields. Account-setup completion is signalled by setting `User.slug` to the canonical chosen slug; this transition is the single source of truth for member readiness.

#### Scenario: Email/password user creates main account after verification
- **WHEN** an email/password registrant verifies their email and submits a valid display name and available slug
- **THEN** main SHALL create or update the `User` record so that `slug` is set to the chosen value
- **AND** main SHALL use its own `User.slug` unique constraint as the final slug uniqueness authority
- **AND** main SHALL issue a browser `rezics-session-token` after the slug transition completes

#### Scenario: Main account setup rejects unverified auth session
- **WHEN** an auth-only registrant submits the account setup form before email verification is trusted
- **THEN** main SHALL reject the request
- **AND** main SHALL NOT set `User.slug`
- **AND** main SHALL NOT issue `rezics-session-token`

#### Scenario: Slug conflict is handled by main
- **WHEN** the submitted slug conflicts with an existing main `User.slug`
- **THEN** main SHALL return a conflict response
- **AND** the frontend SHALL keep the user on account setup with a visible slug conflict message

### Requirement: Temporary auth accounts do not create product users

An auth user that has not completed email verification SHALL remain an auth-only temporary account and SHALL NOT have a main `User`. A profile-setup-stage main user (created by `materializeMainAccountFromAuth` after email verification but before slug submission) is permitted; readiness is conveyed by `User.slug` being non-null, not by a separate flag.

#### Scenario: Unverified registrant remains auth-only
- **WHEN** email/password sign-up succeeds but email verification has not completed
- **THEN** auth SHALL hold the temporary auth account and session
- **AND** main SHALL NOT create a `User`
- **AND** member-only product APIs SHALL remain unavailable

#### Scenario: Verified registrant in profile-setup stage has slug=null
- **WHEN** a verified registrant has been materialized into main via `materializeMainAccountFromAuth` but has not completed profile setup
- **THEN** the main `User` SHALL exist with `slug === null`
- **AND** the user SHALL hold a `rezics-profile-setup-token` cookie, not a `rezics-session-token`
- **AND** member-only product APIs SHALL remain unavailable
