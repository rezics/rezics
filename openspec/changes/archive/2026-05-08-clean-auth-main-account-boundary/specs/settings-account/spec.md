## MODIFIED Requirements

### Requirement: Display current email and verification status
The Account or Profile section SHALL display the user's current Rezics product email and whether the corresponding main email verification contract is verified. This email is `server.User.email`; it is not the auth login email.

#### Scenario: Verified Rezics email display
- **WHEN** the user's main product email has a verified `user.email` contract
- **THEN** the Rezics email is shown with a "Verified" badge
- **AND** the UI copy SHALL distinguish it from login email

#### Scenario: Missing or unverified Rezics email
- **WHEN** the user has no verified main product email
- **THEN** the Account/Profile section SHALL show a recoverable empty or pending state
- **AND** it SHALL NOT imply that auth login email is unverified

#### Scenario: Resend main email verification
- **WHEN** the user clicks "Resend verification" for Rezics email
- **THEN** the app SHALL call the main email verification contract API
- **AND** a success or typed failure message SHALL be shown

### Requirement: Change email
The Account or Profile section SHALL provide a flow to change the Rezics product email through main email verification contracts. It SHALL NOT call auth login email change APIs.

#### Scenario: Change Rezics product email
- **WHEN** the user enters a new Rezics email and confirms
- **THEN** the app SHALL create or update a `user.email` verification contract through main APIs
- **AND** `server.User.email` SHALL remain unchanged until verification succeeds

#### Scenario: User expects login email change
- **WHEN** the user needs to change login email
- **THEN** the Account/Profile section SHALL direct them to Security settings
- **AND** it SHALL NOT perform an auth login email mutation

### Requirement: Delete account
The Account section SHALL include a danger zone with a "Delete account" button. Clicking it SHALL open a confirmation dialog that requires the user to type their slug or Rezics email to confirm. The deletion SHALL be performed via `userApi.deleteMe()`.

#### Scenario: Delete account with confirmation
- **WHEN** the user clicks "Delete account" and types their slug correctly in the confirmation dialog
- **THEN** the account is deleted, the user is signed out, and redirected to the homepage

#### Scenario: Confirmation mismatch prevents deletion
- **WHEN** the user types an incorrect confirmation string
- **THEN** the delete button remains disabled

