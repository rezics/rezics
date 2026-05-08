# app-auth-onboarding Specification

## Purpose
TBD - created by archiving change app-auth-onboarding-rework. Update Purpose after archive.
## Requirements
### Requirement: Email registration uses a dedicated verification-first flow
The main app SHALL provide an email/password registration flow that requires only email and password, creates an auth account through the auth service, and then locks the user into registration verification before any main `User` is created. After registration verification succeeds, the app SHALL request main account materialization, then route the user to profile setup where slug and optional profile fields are submitted before member activation.

#### Scenario: Successful email registration redirects to locked verification
- **WHEN** an unauthenticated user submits a valid email and password on the main app registration page
- **THEN** the app SHALL call the auth service email sign-up flow through the main public auth boundary
- **AND** the app SHALL hydrate auth-session state for the new temporary auth user
- **AND** the app SHALL render the locked registration verification step
- **AND** the app SHALL NOT try to acquire a main member session yet

#### Scenario: Registration does not require slug
- **WHEN** the main app renders the primary registration flow
- **THEN** it SHALL NOT require `slug` as an input needed to create the auth account
- **AND** validation, copy, and submission payloads SHALL reflect email-and-password registration only

#### Scenario: Verified registration proceeds to materialization and profile setup
- **WHEN** the user completes registration verification
- **THEN** the app SHALL request main user materialization
- **AND** the app SHALL route to profile setup after main issues `rezics-profile-setup-token`
- **AND** the user SHALL choose a Rezics slug before member activation

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
The main app SHALL route newly authenticated OAuth users to `/complete-registration` where they complete registration verification when needed, request main materialization when auth has trusted registration facts, and complete profile setup before member activation. The separate `/onboarding` page remains removed.

#### Scenario: Trusted provider email enters materialization and profile setup
- **WHEN** an OAuth sign-in completes for a new user and auth reports trusted verified registration facts
- **THEN** the user SHALL be redirected to `/complete-registration`
- **AND** the app SHALL request main user materialization
- **AND** the user SHALL choose a Rezics slug during profile setup before member activation

#### Scenario: Untrusted provider email enters verification first
- **WHEN** an OAuth sign-in completes without a trusted verified email
- **THEN** the user SHALL be routed to registration verification before main materialization
- **AND** main SHALL NOT create a `User` until registration verification is trusted

#### Scenario: Existing OAuth user logs in normally
- **WHEN** an OAuth sign-in completes for an existing member-ready user
- **THEN** the user SHALL be redirected to the app or callback URL without visiting `/complete-registration`

### Requirement: Third-party registration does not edit email inline
The registration flow SHALL NOT offer email editing during third-party registration. If the provider email is trusted, it SHALL be used for initial account setup. If the user wants a different email, they SHALL change it later from account settings after main user creation.

#### Scenario: Provider email is trusted
- **WHEN** a new OAuth user returns with a trusted verified provider email
- **THEN** the registration UI SHALL display that email as the account email
- **AND** it SHALL NOT provide an inline edit-email step before slug setup

#### Scenario: User needs a different email
- **WHEN** a user wants to change the provider email used during registration
- **THEN** they SHALL complete registration first
- **AND** they SHALL use account settings to change email through a separate verified email-change flow

### Requirement: Auth-only pending users are not guest-auth hybrids
The app SHALL not treat auth-only pending registrants as guest-capable logged-in users. They SHALL remain inside the registration flow until verification, pause/sign-out, or temporary account cleanup.

#### Scenario: Pending user attempts to navigate away
- **WHEN** an auth-only pending registrant tries to access normal app routes
- **THEN** the app SHALL redirect or return them to `/complete-registration`
- **AND** member profile/header data SHALL NOT be requested as if a main user exists

#### Scenario: Pending user attempts member API
- **WHEN** an auth-only pending registrant triggers a member-only action
- **THEN** the app SHALL route them back to registration verification
- **AND** it SHALL NOT call the member-only main product API as a logged-in member

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

### Requirement: Unverified registered users remain limited to guest-level capabilities
Unverified auth-only registrants SHALL remain limited to the locked registration verification flow. They SHALL NOT be treated as member-ready and SHALL NOT receive main product API capability until registration verification and profile setup are complete.

#### Scenario: Unverified account stays in registration verification
- **WHEN** a registered but unverified auth-only user navigates to a normal app route
- **THEN** the app SHALL redirect to the registration verification flow
- **AND** it SHALL NOT load member profile, shelves, realm membership, or normal app chrome

#### Scenario: Unverified account cannot use member-only APIs
- **WHEN** a registered but unverified user attempts to access member-only service endpoints
- **THEN** the app SHALL behave as if no member session is available
- **AND** downstream services SHALL continue to deny member-only access

#### Scenario: Profile completion unlocks member capability
- **WHEN** a registered user completes registration verification and profile setup
- **THEN** the app SHALL proceed to the member-ready flow
- **AND** it SHALL be able to obtain the `rezics-session-token` required for member APIs
