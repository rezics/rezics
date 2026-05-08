## MODIFIED Requirements

### Requirement: Main owns session refresh endpoint
Main SHALL expose `POST /auth/session/refresh` as the public endpoint for issuing or refreshing the browser `rezics-session-token`. The endpoint SHALL validate auth session state through auth, require that a corresponding main `User` already exists and is member-ready, and set the refreshed main session token as an httpOnly cookie. It SHALL NOT create a main `User` from auth-only fallback data and SHALL NOT convert profile setup state into member state.

#### Scenario: Refresh succeeds
- **WHEN** auth validates the auth session and main finds an existing member-ready main `User`
- **THEN** main SHALL set or refresh the `rezics-session-token` httpOnly cookie
- **AND** the response SHALL NOT require the browser to store a returned JWT in localStorage

#### Scenario: Main user is not created yet
- **WHEN** auth validates the auth session but no corresponding main `User` exists
- **THEN** main SHALL return an explicit registration-incomplete response
- **AND** it SHALL NOT set a `rezics-session-token` cookie
- **AND** it SHALL NOT create a fallback main user

#### Scenario: Main user is in profile setup state
- **WHEN** auth validates the auth session and main finds a minimal user that is not member-ready
- **THEN** main SHALL return an explicit profile-setup-required response
- **AND** it SHALL NOT set a `rezics-session-token` cookie
- **AND** frontend auth state SHALL route to profile setup

#### Scenario: Main user was deleted
- **WHEN** auth validates the auth session but the corresponding main `User` has been removed
- **THEN** main SHALL reject the refresh
- **AND** frontend auth state SHALL route according to account recovery or sign-out policy

### Requirement: Logout clears browser session cookies through main
Public sign-out flows through main SHALL clear the main member session cookie and profile setup cookie, and SHALL delegate auth session invalidation to auth for auth-owned session state.

#### Scenario: User signs out
- **WHEN** the browser completes sign-out through `/auth/sign-out`
- **THEN** the auth session SHALL be invalidated by auth
- **AND** main SHALL clear the `rezics-session-token` cookie for the browser
- **AND** main SHALL clear the `rezics-profile-setup-token` cookie for the browser

