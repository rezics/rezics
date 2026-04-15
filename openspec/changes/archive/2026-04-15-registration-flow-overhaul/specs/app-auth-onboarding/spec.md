## MODIFIED Requirements

### Requirement: Email registration uses a dedicated verification-first flow

The main app SHALL provide an email/password registration flow that requires only email and password, creates an auth account through the auth service, and then redirects the user to `/complete-registration` where they complete both identity setup and email verification.

#### Scenario: Successful email registration redirects to complete-registration

- **WHEN** an unauthenticated user submits a valid email and password on the main app registration page
- **THEN** the app SHALL call the auth service email sign-up flow
- **AND** the app SHALL hydrate auth-session state for the new user
- **AND** the app SHALL redirect the user to `/complete-registration`

#### Scenario: Registration does not require slug

- **WHEN** the main app renders the primary registration flow
- **THEN** it SHALL NOT require `slug` as an input needed to create the auth account
- **AND** validation, copy, and submission payloads SHALL reflect email-and-password registration only

#### Scenario: Registration errors are shown accessibly

- **WHEN** the auth service rejects an email registration attempt
- **THEN** the registration page SHALL present the error in visible text
- **AND** the submit control SHALL recover from the loading state

### Requirement: Main app auth entry supports OAuth providers alongside email/password

The main app login and registration entry points SHALL expose third-party OAuth sign-in options for supported providers.

#### Scenario: OAuth provider options are shown on auth entry surfaces

- **WHEN** the main app renders the login page or registration page
- **THEN** it SHALL display OAuth sign-in actions for supported providers

#### Scenario: OAuth initiation failures are surfaced

- **WHEN** the app fails to start an OAuth sign-in flow for a selected provider
- **THEN** the auth surface SHALL present a visible error message

### Requirement: OAuth sign-ins redirect to complete-registration for new users

The main app SHALL route newly authenticated OAuth users to `/complete-registration` where they confirm their identity (username + slug, pre-filled from provider) and see their email verification status. The separate `/onboarding` page is removed.

#### Scenario: New OAuth user lands on complete-registration

- **WHEN** an OAuth sign-in completes for a new user (no existing account)
- **THEN** the user SHALL be redirected to `/complete-registration`
- **AND** the identity fields SHALL be pre-filled from the OAuth provider data
- **AND** the email SHALL show as verified (from trusted provider)

#### Scenario: Existing OAuth user logs in normally

- **WHEN** an OAuth sign-in completes for an existing user with complete registration
- **THEN** the user SHALL be redirected to the app (or callback URL) without visiting `/complete-registration`

## REMOVED Requirements

### Requirement: OAuth sign-ins continue through a required onboarding page

**Reason:** The `/onboarding` page is replaced by `/complete-registration`. Identity confirmation (username + slug) is handled in Step 1 of the unified registration page. Email confirmation and optional password setting from the old onboarding flow are either handled in the new page or deferred.
**Migration:** All references to `/onboarding` route and `OAuthOnboardingPage` component are replaced with `/complete-registration` and the new `CompleteRegistrationPage`.
