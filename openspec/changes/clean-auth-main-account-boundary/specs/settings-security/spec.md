## MODIFIED Requirements

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

## ADDED Requirements

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

