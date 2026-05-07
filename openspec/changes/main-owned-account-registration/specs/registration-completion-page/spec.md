## MODIFIED Requirements

### Requirement: Single registration completion page at /complete-registration

The app SHALL provide a single page at `/complete-registration` that handles locked pending registration. The page SHALL render the next required step based on auth-session state: email verification first for unverified email/password users, then main account setup for verified auth users without a main `User`.

#### Scenario: Email unverified

- **WHEN** an auth-only registrant with `emailVerified: false` visits the page
- **THEN** the email verification section SHALL be displayed
- **AND** main account setup fields SHALL NOT be submittable yet

#### Scenario: Email verified but main user missing

- **WHEN** an auth-only registrant with trusted verified email visits the page
- **THEN** the main account setup form SHALL be displayed
- **AND** the form SHALL collect display name and slug

#### Scenario: Main user exists

- **WHEN** a fully registered user visits `/complete-registration`
- **THEN** the page SHALL redirect to `/` or the requested safe target

#### Scenario: User navigates away and returns

- **WHEN** a pending registrant reloads or returns to `/complete-registration`
- **THEN** the page SHALL resume the correct verification or setup step from auth/main state

#### Scenario: Auth presence cookie is missing or delayed

- **WHEN** the browser reaches `/complete-registration` with a valid opaque auth session but the readable auth-presence cookie is absent, stale, or not yet readable
- **THEN** the page SHALL perform an authoritative main-aware auth session probe without requiring the readable presence cookie
- **AND** it SHALL render the correct pending verification or setup step when auth confirms a valid pending session
- **AND** it SHALL show the sign-in prompt only after the probe confirms there is no valid auth session

### Requirement: Step 1 UI -- identity form

The account setup step SHALL display a form with display name and slug fields. The slug field SHALL provide real-time availability feedback against main server slug availability, and final uniqueness SHALL be enforced by main `User.slug` during submission.

#### Scenario: User fills and submits identity form

- **WHEN** a user enters a valid display name and available slug, then submits
- **THEN** the form SHALL submit to the main account setup endpoint
- **AND** on success the main `User` SHALL be created
- **AND** the app SHALL transition to member-ready state

#### Scenario: Slug conflict on submit

- **WHEN** a user submits a slug that was available during typing but was taken before submit
- **THEN** the form SHALL display the conflict error from main
- **AND** the user SHALL be able to pick a different slug

#### Scenario: Real-time slug validation feedback

- **WHEN** a user types in the slug field
- **THEN** the UI SHALL show format validation errors immediately
- **AND** the UI SHALL check availability with a debounced main-server call after format is valid
- **AND** availability status SHALL be displayed inline

### Requirement: Step 2 UI -- email verification

The email verification step SHALL display the pending account email and provide OTP verification controls. It SHALL be the locked first step for email/password registration until email verification succeeds.

#### Scenario: Email/password user verifies email

- **WHEN** an email/password registrant interacts with Step 2
- **THEN** the Turnstile challenge SHALL be presented for abuse-sensitive send or resend actions
- **AND** after passing Turnstile, the user SHALL be able to request an OTP code
- **AND** after entering the correct code, the page SHALL transition to account setup

#### Scenario: Verification delivery fails

- **WHEN** verification email or OTP delivery fails
- **THEN** the UI SHALL show a visible recoverable error
- **AND** the user SHALL be able to retry after the configured cooldown or cancel registration

## ADDED Requirements

### Requirement: Registration page provides cancel action
The completion page SHALL expose a cancel-registration action while the user is auth-only and no main `User` exists.

#### Scenario: User cancels from verification page
- **WHEN** a pending registrant clicks cancel registration and confirms
- **THEN** the app SHALL call the cancel-registration API
- **AND** the app SHALL clear auth state and return to anonymous navigation

#### Scenario: Cancel is accessible and localized
- **WHEN** the cancel control is rendered
- **THEN** it SHALL be keyboard reachable
- **AND** its label, confirmation, and error messages SHALL use the active locale
