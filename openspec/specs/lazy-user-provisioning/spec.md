# lazy-user-provisioning Specification

## Purpose

Defines the rule that main `User` rows are materialized only via
the cookie-boundary `materializeMainAccountFromAuth` flow during
account setup, or via the registration-side
`auth-user-provisioning-hook` from auth's `afterSignUp` /
verify-email path. Owns the prohibition on middleware-resident
lazy provisioning, the 401 response on missing main users, and
the rejection of any `x-auth-session-token` header as a
provisioning trigger.

## Requirements

### Requirement: Provisioning is exclusively cookie-boundary or registration-hook

After this change, the only paths that materialize a main `User` SHALL be: (1) the cookie-boundary `materializeMainAccountFromAuth` flow, invoked when the browser starts main-orchestrated account setup with a verified auth session; and (2) the registration-side `auth-user-provisioning-hook` flow (when configured), invoked from auth's `afterSignUp`/verify-email path via an internal call to main. No JWT-in-header exchange path SHALL exist for provisioning. No middleware-resident "lazy provisioning" SHALL be triggered on first authenticated request.

#### Scenario: First authenticated request encounters missing main user

- **WHEN** a request reaches a member-only endpoint with a valid `rezics-session-token` but the main `User` row has been removed
- **THEN** the endpoint SHALL return 401 (the user must re-authenticate)
- **AND** the middleware SHALL NOT auto-create or auto-restore the user

#### Scenario: Cookie boundary materializes main user during account setup

- **WHEN** an authenticated browser with a verified auth session initiates `materializeMainAccountFromAuth`
- **THEN** main SHALL create a profile-setup-stage `User` (with `slug === null`) and issue a `rezics-profile-setup-token` cookie
- **AND** no JWT-in-header pathway SHALL be used

#### Scenario: Header-based provisioning JWT is rejected

- **WHEN** any caller sends an `x-auth-session-token` to any provisioning-eligible endpoint
- **THEN** the header SHALL be ignored and SHALL NOT trigger provisioning
