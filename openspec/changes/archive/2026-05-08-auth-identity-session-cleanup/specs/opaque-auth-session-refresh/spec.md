## ADDED Requirements

### Requirement: Cookie-boundary refresh is the sole browser path to rezics-session-token

`POST /auth/session/refresh` SHALL be the sole browser-facing path that issues or refreshes a `rezics-session-token` cookie. No alternative JWT-in-header exchange (`POST /session/exchange`, `x-auth-session-token`, or any equivalent) SHALL exist or be exposed to browsers. Non-browser callers obtain `rezics-session-token` via `POST /token/session` using an API token; that path is governed by the `dispatch-token-session` capability and is independent of the browser refresh flow.

#### Scenario: Browser obtains session via cookie boundary only

- **WHEN** a browser needs a fresh `rezics-session-token`
- **THEN** it calls `POST /auth/session/refresh` with credentials-included
- **AND** it SHALL NOT send any `x-auth-session-token` header
- **AND** no other browser-facing endpoint SHALL produce a `rezics-session-token`

#### Scenario: No JWT-header alternative exists

- **WHEN** any browser-facing route is enumerated for issuing `rezics-session-token`
- **THEN** only `POST /auth/session/refresh` SHALL appear
- **AND** the legacy `POST /session/exchange` SHALL return 404

## MODIFIED Requirements

### Requirement: Main owns session refresh endpoint

Main SHALL expose `POST /auth/session/refresh` as the sole public endpoint for issuing or refreshing the browser `rezics-session-token`. The endpoint SHALL validate auth session state through auth, require that a corresponding main `User` already exists with `slug !== null`, and set the refreshed main session token as an httpOnly cookie. It SHALL NOT create a main `User` from auth-only fallback data, and it SHALL NOT issue `rezics-session-token` for a profile-setup-stage user (one whose `slug` is `null`).

#### Scenario: Refresh succeeds for member-ready user
- **WHEN** auth validates the auth session and main finds an existing main `User` with `slug !== null`
- **THEN** main SHALL set or refresh the `rezics-session-token` httpOnly cookie
- **AND** the response SHALL NOT require the browser to store a returned JWT in localStorage

#### Scenario: Profile-setup-stage user is not refreshed to member session
- **WHEN** auth validates the auth session and main finds a `User` with `slug === null`
- **THEN** main SHALL return a profile-setup-required response
- **AND** main SHALL NOT issue a `rezics-session-token`
- **AND** main MAY refresh `rezics-profile-setup-token` instead via the dedicated endpoint

#### Scenario: Main user is not created yet
- **WHEN** auth validates the auth session but no corresponding main `User` exists
- **THEN** main SHALL return an explicit registration-incomplete response
- **AND** it SHALL NOT set a `rezics-session-token` cookie
- **AND** it SHALL NOT create a fallback main user

#### Scenario: Main user was deleted
- **WHEN** auth validates the auth session but the corresponding main `User` has been removed
- **THEN** main SHALL reject the refresh
- **AND** frontend auth state SHALL route according to account recovery or sign-out policy
