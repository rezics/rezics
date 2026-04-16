## ADDED Requirements

### Requirement: Display current email and verification status
The Account section SHALL display the user's current email address and whether it is verified. If not verified, a "Resend verification" button SHALL be shown.

#### Scenario: Verified email display
- **WHEN** the user's email is verified
- **THEN** the email is shown with a "Verified" badge

#### Scenario: Unverified email with resend
- **WHEN** the user's email is not verified
- **THEN** the email is shown with an "Unverified" warning and a "Resend verification email" button

#### Scenario: Resend verification
- **WHEN** the user clicks "Resend verification email"
- **THEN** a verification email is sent via `authApi.sendVerificationEmail()` and a confirmation message is shown

### Requirement: Change email
The Account section SHALL provide a text input to enter a new email address and a button to initiate the email change via `authApi.changeEmail()`.

#### Scenario: Change email
- **WHEN** the user enters a new email and confirms
- **THEN** `authApi.changeEmail()` is called and a message informs the user to verify the new email

### Requirement: Delete account
The Account section SHALL include a danger zone with a "Delete account" button. Clicking it SHALL open a confirmation dialog that requires the user to type their slug or email to confirm. The deletion SHALL be performed via `userApi.deleteMe()`.

#### Scenario: Delete account with confirmation
- **WHEN** the user clicks "Delete account" and types their slug correctly in the confirmation dialog
- **THEN** the account is deleted, the user is signed out, and redirected to the homepage

#### Scenario: Confirmation mismatch prevents deletion
- **WHEN** the user types an incorrect confirmation string
- **THEN** the delete button remains disabled
