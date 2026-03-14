## ADDED Requirements

### Requirement: Pending verification users render authenticated-but-not-ready header chrome

The main app SHALL render a dedicated `PendingVerificationSection` in the main layout header when the browser session has authenticated auth identity but the user still requires verification or has not yet received a ready `rezics_session_token`.

#### Scenario: Newly registered user sees pending verification header state

- **WHEN** a user completes registration, has an active auth session, and has not yet completed email verification
- **THEN** `MainLayoutHeader` SHALL render `PendingVerificationSection`
- **AND** it SHALL NOT render `AuthenticatedSection`
- **AND** the section SHALL expose clear verification guidance or actions using the available auth-session data

#### Scenario: Verified member-ready user sees authenticated header state

- **WHEN** the auth session is verified and the frontend has obtained a valid `rezics_session_token`
- **THEN** `MainLayoutHeader` SHALL render `AuthenticatedSection`
- **AND** it SHALL stop rendering `PendingVerificationSection`

#### Scenario: Pending verification header tolerates partial business profile data

- **WHEN** the user has auth identity but the main-server user has not yet been loaded or some business fields are unavailable
- **THEN** `PendingVerificationSection` SHALL still render without crashing
- **AND** it SHALL rely on auth-session data or optional fallbacks for any account summary it shows

#### Scenario: Pending verification header avoids authenticated avatar dropdown

- **WHEN** `PendingVerificationSection` is rendered
- **THEN** it SHALL show basic auth-owned user information without the authenticated avatar-triggered dropdown
- **AND** it SHALL render a verify-email button together with `MoreHorizMenu` on the right side of the header
