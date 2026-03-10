# app-auth-onboarding Specification

## Purpose
TBD - created by archiving change app-auth-onboarding-rework. Update Purpose after archive.
## Requirements
### Requirement: Email registration uses a dedicated verification-first flow
The main app SHALL provide an email/password registration flow that requires only email and password, creates an auth account through the auth service, and then redirects the user to a dedicated verification page instead of treating registration as immediately complete.

#### Scenario: Successful email registration redirects to verification
- **WHEN** an unauthenticated user submits a valid email and password on the main app registration page
- **THEN** the app SHALL call the auth service email sign-up flow
- **AND** the app SHALL hydrate auth-session state for the new user
- **AND** the app SHALL keep the user at guest-level app capability until verification and readiness checks complete
- **AND** the app SHALL redirect the user to the dedicated email verification page

#### Scenario: Registration no longer requires slug
- **WHEN** the main app renders the primary registration flow
- **THEN** it SHALL NOT require `slug` as an input needed to create the auth account
- **AND** validation, copy, and submission payloads SHALL reflect email-and-password registration only

#### Scenario: Registration errors are shown accessibly
- **WHEN** the auth service rejects an email registration attempt
- **THEN** the registration page SHALL present the error in visible text
- **AND** the submit control SHALL recover from the loading state
- **AND** the form SHALL remain keyboard accessible

### Requirement: Main app auth entry supports OAuth providers alongside email/password
The main app login and registration entry points SHALL expose third-party OAuth sign-in options for supported providers, including the providers already enabled in auth and Telegram when backend support is configured.

#### Scenario: OAuth provider options are shown on auth entry surfaces
- **WHEN** the main app renders the login page or registration page
- **THEN** it SHALL display OAuth sign-in actions for supported providers
- **AND** those actions SHALL be labeled in a localized and accessible manner

#### Scenario: Unsupported providers are not rendered
- **WHEN** a provider is not configured or not reported as supported by the auth layer
- **THEN** the app SHALL NOT render that provider action
- **AND** it SHALL continue to render the remaining supported providers

#### Scenario: OAuth initiation failures are surfaced
- **WHEN** the app fails to start an OAuth sign-in flow for a selected provider
- **THEN** the auth surface SHALL present a visible error message
- **AND** the user SHALL remain able to retry or choose another sign-in method

### Requirement: OAuth sign-ins continue through a required onboarding page
The main app SHALL route newly authenticated OAuth users through a dedicated onboarding page where email is required and password is optional before the user is considered fully ready.

#### Scenario: Provider with trusted email pre-fills locked email field
- **WHEN** an OAuth sign-in completes and the auth backend reports an email that is already trusted and verified
- **THEN** the onboarding page SHALL prefill that email
- **AND** the email field SHALL be non-editable by default
- **AND** the page SHALL explain that editing the email will require re-verification

#### Scenario: User edits a prefilled trusted email
- **WHEN** the user chooses to edit a locked prefilled email on the onboarding page
- **THEN** the email field SHALL become editable
- **AND** the UI SHALL clearly indicate that the edited email must be verified again

#### Scenario: Provider without email requires manual email entry
- **WHEN** an OAuth sign-in completes without a usable email from the provider
- **THEN** the onboarding page SHALL require the user to enter an email before completion
- **AND** password entry SHALL remain optional

#### Scenario: Password remains optional during OAuth onboarding
- **WHEN** an OAuth user completes the onboarding page without entering a password
- **THEN** the app SHALL allow onboarding completion as long as all required email steps succeed

#### Scenario: OAuth onboarding does not imply immediate member access
- **WHEN** an OAuth user still requires onboarding or verification
- **THEN** the app SHALL keep that user at guest-level capability
- **AND** it SHALL NOT assume member-level API access is available yet

### Requirement: Email verification uses a dedicated protected page
The main app SHALL provide a dedicated verification page for authenticated users that supports email verification guidance, resend actions, and anti-abuse protection through Turnstile.

#### Scenario: Verification page includes Turnstile for abuse-sensitive actions
- **WHEN** the app renders the verification page
- **THEN** it SHALL include the shared Turnstile component for abuse-sensitive verification actions
- **AND** it SHALL show a visible loading or error state if the widget cannot initialize

#### Scenario: Unverified user can trigger resend from verification page
- **WHEN** an authenticated but unverified user completes the verification page requirements and requests a resend
- **THEN** the app SHALL call the auth verification action
- **AND** it SHALL show a success or failure message without leaving the page

#### Scenario: Verified user is not trapped on verification page
- **WHEN** the auth session indicates the user email is already verified
- **THEN** the verification page SHALL redirect the user to the requested target or a safe default page

### Requirement: Unverified registered users see a global verification banner
The main app SHALL display a persistent verification reminder banner on app pages for registered users whose auth session indicates that email verification is still required and who still remain limited to guest-level capabilities.

#### Scenario: Banner appears for unverified user
- **WHEN** a registered user with `emailVerified = false` navigates through guest-accessible app pages
- **THEN** the app SHALL show a persistent banner reminding them to verify their email
- **AND** the banner SHALL include a clear action to open the verification page

#### Scenario: Banner disappears after verification
- **WHEN** the auth session is refreshed and the user is now verified
- **THEN** the app SHALL stop rendering the verification banner

#### Scenario: Banner respects localization and accessibility
- **WHEN** the verification banner is rendered
- **THEN** its message and action text SHALL use the active locale
- **AND** its action SHALL be keyboard reachable and screen-reader understandable

### Requirement: Unverified registered users remain limited to guest-level capabilities
The main app SHALL treat registered users who have not completed required verification or onboarding as guest-capable users rather than as member-ready users.

#### Scenario: Unverified account can browse guest-visible surfaces
- **WHEN** a registered but unverified user navigates to a page or API that is already available to guests
- **THEN** the app SHALL allow the same guest-level access

#### Scenario: Unverified account cannot use member-only APIs
- **WHEN** a registered but unverified user attempts to access member-only service endpoints
- **THEN** the app SHALL behave as if no member JWT is available
- **AND** downstream services SHALL continue to deny member-only access

#### Scenario: Verification completion unlocks member capability
- **WHEN** a registered user completes verification and any required onboarding
- **THEN** the app SHALL proceed to the member-ready flow
- **AND** it SHALL be able to obtain the business JWT required for member APIs

