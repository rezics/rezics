### Requirement: Auth service uses emailOTP plugin for verification

The auth service SHALL enable better-auth's `emailOTP` plugin with `overrideDefaultEmailVerification: true`. Configuration SHALL use: 6-digit codes, 5-minute expiry, 3 allowed attempts, hashed storage, rotate on resend.

#### Scenario: OTP plugin is active

- **WHEN** the auth service starts
- **THEN** the `/email-otp/send-verification-otp` and `/email-otp/verify-email` endpoints are available

#### Scenario: Code characteristics

- **WHEN** a verification OTP is generated
- **THEN** it is 6 digits, expires after 300 seconds, and is stored as a hash (not plaintext)

### Requirement: Verification email is not auto-sent on signup

The auth service SHALL set `sendVerificationOnSignUp: false` on the emailOTP plugin. The existing `emailVerification.sendOnSignUp` SHALL also be set to `false`. Email sending is frontend-triggered.

#### Scenario: Signup does not send email

- **WHEN** a user registers via email/password
- **THEN** no verification email is sent automatically; the user must request one explicitly from the frontend

### Requirement: Server-side Turnstile validation before sending OTP

The auth service SHALL validate a Turnstile token with Cloudflare's `siteverify` API before sending any verification OTP. If validation fails, the send request SHALL be rejected with an appropriate error.

#### Scenario: Valid Turnstile token allows OTP send

- **WHEN** the frontend requests an OTP send with a valid Turnstile token
- **THEN** the auth service validates the token with Cloudflare, receives `success: true`, and proceeds to send the OTP email

#### Scenario: Invalid Turnstile token blocks OTP send

- **WHEN** the frontend requests an OTP send with an invalid or missing Turnstile token
- **THEN** the auth service rejects the request without sending any email

#### Scenario: Missing Turnstile token blocks OTP send

- **WHEN** the frontend requests an OTP send without a `turnstileToken` field
- **THEN** the auth service rejects the request with an error indicating Turnstile verification is required

### Requirement: TURNSTILE_SECRET environment variable in auth service

The auth service env schema SHALL include an optional `TURNSTILE_SECRET` string variable. The Turnstile validation utility SHALL use this secret when calling Cloudflare's `siteverify` endpoint.

#### Scenario: Auth env includes Turnstile secret

- **WHEN** the auth service env is validated
- **THEN** `TURNSTILE_SECRET` is accepted as an optional string

### Requirement: OTP emails use branded react-email templates

The `sendVerificationOTP` callback SHALL use `@rezics/email`'s `VerificationCode` template and `render()` function to produce branded HTML and plain-text email content.

#### Scenario: OTP email uses branded template

- **WHEN** the emailOTP plugin triggers `sendVerificationOTP`
- **THEN** the notification service renders the `VerificationCode` template from `@rezics/email` and sends the branded email via SMTP

### Requirement: Post-verification provisioning works with OTP flow

After a successful OTP verification via `/email-otp/verify-email`, the auth service SHALL trigger user provisioning on the main server, maintaining the same behavior as the previous URL-based flow.

#### Scenario: Provisioning after OTP verification

- **WHEN** a user successfully verifies their email via OTP
- **THEN** the auth service calls the main server's provisioning endpoint with the user's `unitId`, `slug`, and `name`

#### Scenario: Provisioning failure does not block verification response

- **WHEN** provisioning fails after OTP verification
- **THEN** the verification response is still returned successfully; the provisioning error is logged

### Requirement: Frontend verify-email page uses code input

The `/verify-email` page SHALL display a 6-digit code input field. The user enters the code received via email and submits it. The page SHALL call the `/email-otp/verify-email` endpoint with `{ email, otp }`.

#### Scenario: User enters correct code

- **WHEN** the user enters the correct 6-digit code and submits
- **THEN** the frontend calls `/email-otp/verify-email`, receives success, exchanges for a session token, and navigates to the app

#### Scenario: User enters incorrect code

- **WHEN** the user enters an incorrect code
- **THEN** the frontend displays an error message indicating the code is invalid

#### Scenario: Code expires

- **WHEN** the user enters a code after the 5-minute expiry
- **THEN** the frontend displays an error indicating the code has expired and prompts to resend

### Requirement: Frontend Turnstile-gates OTP send requests

The `/verify-email` page SHALL require Turnstile completion before allowing the user to request a verification code. The Turnstile token SHALL be sent alongside the OTP request for server-side validation.

#### Scenario: Two-step verification flow

- **WHEN** the user lands on `/verify-email`
- **THEN** they must first complete the Turnstile challenge, then click "Send verification code" to trigger the OTP email

#### Scenario: Resend also requires Turnstile

- **WHEN** the user wants to resend the verification code
- **THEN** they must complete a new Turnstile challenge before the resend is allowed
