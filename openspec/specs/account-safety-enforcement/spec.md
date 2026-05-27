# account-safety-enforcement Specification

## Purpose
TBD - created by archiving change complete-platform-authorization. Update Purpose after archive.
## Requirements
### Requirement: Account enforcement states control community actions

The system SHALL support warning, silence, suspension, ban, and rate/trust restriction records with actor, reason, duration, target user, active state, and audit metadata.

#### Scenario: Silenced user cannot post

- **GIVEN** a user has an active silence enforcement
- **WHEN** the user attempts to create a post, reply, realm, DM, or tag vote
- **THEN** the server SHALL reject the action
- **AND** read-only actions SHALL remain available unless another enforcement blocks them

### Requirement: Ban coordinates with auth sessions

A ban SHALL record main-server enforcement and call the auth boundary to deny sign-in and revoke sessions when configured.

#### Scenario: Staff bans a user

- **WHEN** authorized staff bans a user for abuse
- **THEN** the main server SHALL persist the ban enforcement
- **AND** the auth service SHALL mark the account banned and revoke active sessions
- **AND** a staff audit entry SHALL link both operations

### Requirement: Expiring enforcement is automatically inactive after its end time

Duration-based enforcement SHALL stop affecting policy decisions after `expiresAt`.

#### Scenario: Suspension expires

- **GIVEN** a user has a suspension that expired one minute ago
- **WHEN** the user attempts to create content
- **THEN** policy SHALL not deny solely because of that expired suspension

