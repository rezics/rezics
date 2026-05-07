## ADDED Requirements

### Requirement: Verification delivery is reliable and observable
The auth service SHALL make verification email and OTP delivery outcomes visible to callers. Delivery failures SHALL be surfaced as typed API errors and logged with enough context for diagnosis.

#### Scenario: SMTP send fails
- **WHEN** SMTP rejects or fails a verification message
- **THEN** auth SHALL return a typed delivery failure response
- **AND** the frontend SHALL display a recoverable error on the verification screen

#### Scenario: SMTP send succeeds
- **WHEN** auth successfully queues or sends the verification message
- **THEN** auth SHALL return a typed success response
- **AND** the frontend SHALL show resend cooldown and next-step guidance

### Requirement: OTP resend supports locked registration
The OTP resend flow SHALL support users locked on the registration verification screen.

#### Scenario: Pending user resends OTP
- **WHEN** a pending registrant completes Turnstile and requests a resend
- **THEN** auth SHALL issue a new OTP according to resend policy
- **AND** the frontend SHALL show success and cooldown state without leaving the page

#### Scenario: Cooldown prevents resend
- **WHEN** a pending registrant requests a resend during cooldown
- **THEN** auth SHALL reject or throttle the request with a typed cooldown response
- **AND** the frontend SHALL show the remaining cooldown or retry guidance

### Requirement: OTP verification transitions pending accounts
Successful OTP verification SHALL update auth session state so the frontend can advance from email verification to main account setup without losing the auth session.

#### Scenario: OTP verification succeeds
- **WHEN** a pending registrant submits the correct OTP
- **THEN** auth SHALL mark the email as verified
- **AND** the auth session or auth presence state SHALL remain valid for the browser
- **AND** the frontend SHALL advance to main account setup

#### Scenario: OTP verification fails
- **WHEN** a pending registrant submits an invalid or expired OTP
- **THEN** auth SHALL return a typed verification error
- **AND** the frontend SHALL keep the user on verification with a visible error
