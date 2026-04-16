## ADDED Requirements

### Requirement: Change password
The Security section SHALL provide inputs for new password and password confirmation. If the user already has a password (from `authSessionState.hasPassword`), a current password field SHALL also be shown. The password change SHALL be performed via `authApi.setPassword()`.

#### Scenario: Change existing password
- **WHEN** the user has a password, enters current password and new password, and submits
- **THEN** the password is updated and a success message is shown

#### Scenario: Set password for OAuth-only user
- **WHEN** the user has no password (`hasPassword` is false) and sets a new password
- **THEN** the password is set via `authApi.setPassword()` and the user can now sign in with email/password

#### Scenario: Password mismatch
- **WHEN** the new password and confirmation do not match
- **THEN** the submit button is disabled and a validation message is shown

### Requirement: Active sessions list
The Security section SHALL display a list of active sessions from `authApi.listSessions()`. Each session entry SHALL show: user agent (parsed into browser/OS), IP address, creation date, and last active time.

#### Scenario: Sessions list renders
- **WHEN** the Security section loads
- **THEN** all active sessions are listed with their details

### Requirement: Current session identification
The current session SHALL be identified and marked with a "Current session" badge. The current session SHALL NOT have a revoke button.

#### Scenario: Current session is marked
- **WHEN** the sessions list renders
- **THEN** the current session shows a "Current session" badge and no revoke option

### Requirement: Revoke other sessions
Each non-current session SHALL have a "Revoke" button. Clicking it SHALL call `authApi.revokeSession()` and remove the session from the list.

#### Scenario: Revoke a session
- **WHEN** the user clicks "Revoke" on a non-current session
- **THEN** the session is revoked via the API and removed from the displayed list
