# settings-security Specification

## Purpose

Defines the Security settings surface that owns auth login email, password, active session management, and provider/security controls. Rezics product email lives in Account/Profile settings; this section never mutates `server.User.email`.

## Requirements

### Requirement: Change password
The Security section SHALL provide inputs for new password and password confirmation. If the user already has a password from auth session state, a current password field SHALL also be shown. The password change SHALL be performed via auth APIs.

#### Scenario: Change existing password
- **WHEN** the user has a password, enters current password and new password, and submits
- **THEN** the password is updated through auth
- **AND** a success message is shown

#### Scenario: Set password for OAuth-only user
- **WHEN** the user has no password and sets a new password
- **THEN** the password is set through auth
- **AND** the user can now sign in with email/password

#### Scenario: Password mismatch
- **WHEN** the new password and confirmation do not match
- **THEN** the submit button is disabled and a validation message is shown

### Requirement: Security settings owns login email
The Security section SHALL display and manage the auth login email. Login email settings SHALL be grouped with password, sessions, and provider/security controls.

#### Scenario: Login email is displayed
- **WHEN** the Security section loads
- **THEN** it SHALL display the auth login email from auth session state
- **AND** the UI copy SHALL distinguish it from Rezics product email

#### Scenario: Login email is changed
- **WHEN** the user changes login email from Security settings
- **THEN** the app SHALL call the auth login email change flow
- **AND** main `server.User.email` SHALL NOT be automatically changed

#### Scenario: User expects product email change
- **WHEN** the user needs to change Rezics product email
- **THEN** the Security section SHALL direct them to Account/Profile settings
- **AND** it SHALL NOT perform a main product email mutation

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
