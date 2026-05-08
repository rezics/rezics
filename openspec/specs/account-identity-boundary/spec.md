# account-identity-boundary Specification

## Purpose

Defines ownership and synchronization rules for auth login email, main email, canonical slug, auth slug login alias, auth technical name, and main display name. The auth service owns login credentials and login identifiers; the main server owns Rezics product identity (display name, canonical slug, product email). Auth-side slug/name fields exist only as one-way projections from main and SHALL NOT be treated as product authority.

## Requirements

### Requirement: Auth login email and main email have separate ownership
The system SHALL treat `auth.User.email` as the auth login email and `server.User.email` as the main-owned Rezics product email. The two fields MAY be initialized to the same value during account materialization, but they SHALL NOT be automatically synchronized after that point.

#### Scenario: Main email is initialized from verified auth login email
- **WHEN** auth returns verified registration facts for a new registrant
- **THEN** main MAY initialize `server.User.email` from the verified auth login email
- **AND** main SHALL record the email as main-owned product data

#### Scenario: Auth login email changes later
- **WHEN** the auth login email changes after a main user exists
- **THEN** main SHALL NOT automatically update `server.User.email`
- **AND** any main email change SHALL use the main email verification contract flow

#### Scenario: Main email changes later
- **WHEN** the user changes the Rezics product email in main settings
- **THEN** auth SHALL NOT automatically change the login email
- **AND** login, recovery, and provider linking SHALL continue using auth-owned email state

### Requirement: Main owns product display name
The system SHALL treat `server.User.name` as the Rezics product display name. Auth-side `User.name`, if required by better-auth, SHALL be a technical auth label and SHALL NOT be rendered as the product display name.

#### Scenario: Auth requires a user name
- **WHEN** auth must persist a `User.name` value for a Rezics user
- **THEN** the value SHALL be populated from the canonical main slug or another documented technical label
- **AND** product UI SHALL render `server.User.name`, not `auth.User.name`

#### Scenario: User changes display name
- **WHEN** a user changes their Rezics display name
- **THEN** main SHALL update `server.User.name`
- **AND** auth SHALL NOT treat that display name as an auth profile authority

### Requirement: Main slug is canonical and auth slug is a login alias projection
The system SHALL treat `server.User.slug` as the canonical Rezics slug. Auth MAY store the slug as a login alias or technical name, but that auth-side value SHALL be a one-way projection from main.

#### Scenario: User completes profile setup with slug
- **WHEN** main accepts a new canonical slug during profile setup
- **THEN** main SHALL persist `server.User.slug`
- **AND** main SHALL project the slug to auth only for login alias or technical label purposes

#### Scenario: Admin changes slug
- **WHEN** an admin changes a user's canonical slug through a main-owned operation
- **THEN** main SHALL update `server.User.slug`
- **AND** main SHALL notify auth to update the login alias or technical auth name
- **AND** auth SHALL NOT independently choose a new Rezics slug

#### Scenario: Auth slug projection fails
- **WHEN** main commits a canonical slug change but auth projection fails
- **THEN** main SHALL retain canonical slug authority
- **AND** the system SHALL expose or retry the projection failure without rolling back to auth as source of truth
