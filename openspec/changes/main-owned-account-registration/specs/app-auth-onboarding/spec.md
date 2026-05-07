## MODIFIED Requirements

### Requirement: Email registration uses a dedicated verification-first flow

The main app SHALL provide an email/password registration flow that requires only email and password, creates an auth account through the auth service, and then locks the user into email verification before any main `User` is created. After email verification succeeds, the app SHALL route the user to main-owned account setup where display name and slug are submitted to create the Rezics user.

#### Scenario: Successful email registration redirects to locked verification

- **WHEN** an unauthenticated user submits a valid email and password on the main app registration page
- **THEN** the app SHALL call the auth service email sign-up flow through the main public auth boundary
- **AND** the app SHALL hydrate auth-session state for the new temporary auth user
- **AND** the app SHALL render the locked email verification step
- **AND** the app SHALL NOT try to acquire a main member session yet

#### Scenario: Registration does not require slug

- **WHEN** the main app renders the primary registration flow
- **THEN** it SHALL NOT require `slug` as an input needed to create the auth account
- **AND** validation, copy, and submission payloads SHALL reflect email-and-password registration only

#### Scenario: Verified email proceeds to main account setup

- **WHEN** the user completes email verification
- **THEN** the app SHALL route to the main account setup step
- **AND** the user SHALL choose display name and slug before the main `User` is created

#### Scenario: Registration errors are shown accessibly

- **WHEN** the auth service rejects an email registration attempt
- **THEN** the registration page SHALL present the error in visible text
- **AND** the submit control SHALL recover from the loading state

### Requirement: OAuth sign-ins redirect to complete-registration for new users

The main app SHALL route newly authenticated OAuth users to `/complete-registration` where they confirm display name and slug after auth has established whether provider email is trusted. The separate `/onboarding` page remains removed.

#### Scenario: Trusted provider email enters account setup

- **WHEN** an OAuth sign-in completes for a new user and auth reports `emailVerified = true`
- **THEN** the user SHALL be redirected to `/complete-registration`
- **AND** the account setup fields SHALL be pre-filled from provider data where available
- **AND** the user SHALL choose a Rezics slug before main creates the `User`

#### Scenario: Untrusted provider email enters verification first

- **WHEN** an OAuth sign-in completes without a trusted verified email
- **THEN** the user SHALL be routed to email verification before main account setup
- **AND** main SHALL NOT create a `User` until email is trusted

#### Scenario: Existing OAuth user logs in normally

- **WHEN** an OAuth sign-in completes for an existing user with a main `User`
- **THEN** the user SHALL be redirected to the app or callback URL without visiting `/complete-registration`

## ADDED Requirements

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
The app SHALL not treat auth-only pending registrants as guest-capable logged-in users. They SHALL remain inside the registration flow until completion, pause/sign-out, or temporary account cleanup.

#### Scenario: Pending user attempts to navigate away
- **WHEN** an auth-only pending registrant tries to access normal app routes
- **THEN** the app SHALL redirect or return them to `/complete-registration`
- **AND** member profile/header data SHALL NOT be requested as if a main user exists
