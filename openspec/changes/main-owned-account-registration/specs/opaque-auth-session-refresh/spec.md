## MODIFIED Requirements

### Requirement: Main owns session refresh endpoint

Main SHALL expose `POST /auth/session/refresh` as the public endpoint for issuing or refreshing the browser `rezics-session-token`. The endpoint SHALL validate auth session state through auth, require that a corresponding main `User` already exists, and set the refreshed main session token as an httpOnly cookie. It SHALL NOT create a main `User` from auth-only fallback data.

#### Scenario: Refresh succeeds
- **WHEN** auth validates the auth session and main finds an existing main `User`
- **THEN** main SHALL set or refresh the `rezics-session-token` httpOnly cookie
- **AND** the response SHALL NOT require the browser to store a returned JWT in localStorage

#### Scenario: Main user is not created yet
- **WHEN** auth validates the auth session but no corresponding main `User` exists
- **THEN** main SHALL return an explicit registration-incomplete response
- **AND** it SHALL NOT set a `rezics-session-token` cookie
- **AND** it SHALL NOT create a fallback main user

#### Scenario: Main user was deleted
- **WHEN** auth validates the auth session but the corresponding main `User` has been removed
- **THEN** main SHALL reject the refresh
- **AND** frontend auth state SHALL route according to account recovery or sign-out policy
