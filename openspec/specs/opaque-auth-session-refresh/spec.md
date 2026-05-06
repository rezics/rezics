# opaque-auth-session-refresh Specification

## Purpose

Defines the relationship between the auth-owned browser session cookie and the main-owned `rezics-session-token` cookie. The auth session cookie is treated as an opaque refresh authority validated only through internal calls to auth, and main owns `POST /auth/session/refresh` as the public endpoint for issuing or refreshing the main session cookie. This spec also covers the cookie security attributes, CSRF posture for cookie refresh and mutation, optionality of a separate main refresh token, and logout coordination across auth and main.

## Requirements

### Requirement: Auth session cookie is opaque refresh authority

The auth session cookie SHALL be the browser refresh authority for main web sessions. Main SHALL treat the auth session cookie as opaque and SHALL validate it only by calling auth internally.

#### Scenario: Main refreshes with opaque auth session
- **WHEN** a browser calls `/auth/session/refresh` with a valid auth session cookie
- **THEN** main SHALL forward the cookie to auth internally to validate session state
- **AND** main SHALL NOT parse the cookie value as a JWT

### Requirement: Main owns session refresh endpoint

Main SHALL expose `POST /auth/session/refresh` as the public endpoint for issuing or refreshing the browser `rezics-session-token`. The endpoint SHALL validate auth session state through auth, provision or verify main user readiness, and set the refreshed main session token as an httpOnly cookie.

#### Scenario: Refresh succeeds
- **WHEN** auth validates the auth session and main user readiness is satisfied
- **THEN** main SHALL set or refresh the `rezics-session-token` httpOnly cookie
- **AND** the response SHALL NOT require the browser to store a returned JWT in localStorage

#### Scenario: Main user is not provisioned
- **WHEN** auth validates the auth session but no corresponding main user can be provisioned or found
- **THEN** main SHALL return an explicit failure status
- **AND** it SHALL NOT set a `rezics-session-token` cookie

### Requirement: Browser session cookies use secure attributes

Auth session and `rezics-session-token` cookies used by browser web flows SHALL be httpOnly. In production they SHALL be `Secure`, SHALL use `SameSite=Lax` unless a route has a documented OAuth compatibility exception, and SHALL use the narrowest public path that supports the flow.

#### Scenario: Production refresh response sets cookies
- **WHEN** `/auth/session/refresh` succeeds in production
- **THEN** the `Set-Cookie` header for `rezics-session-token` SHALL include `HttpOnly`, `Secure`, and `SameSite=Lax`

### Requirement: Refresh and mutating cookie routes protect against CSRF

Cookie-authenticated refresh, sign-out, and mutating auth or main routes SHALL enforce origin and/or CSRF protections appropriate to browser requests.

#### Scenario: Cross-site refresh is attempted
- **WHEN** a cross-site request calls `/auth/session/refresh` without an accepted origin or CSRF signal
- **THEN** main SHALL reject the request
- **AND** it SHALL NOT refresh the main session cookie

### Requirement: Separate main refresh token is optional

The initial design SHALL NOT require a separate main refresh token cookie. A separate main refresh token MAY be introduced later only if independent main refresh revocation, audit, or lifetime policy becomes a concrete requirement.

#### Scenario: Refresh authority is evaluated
- **WHEN** the browser main session expires but the auth session remains valid
- **THEN** `/auth/session/refresh` SHALL be able to issue a new main session using the auth session authority
- **AND** no additional main refresh cookie SHALL be required

### Requirement: Logout clears browser session cookies through main

Public sign-out flows through main SHALL clear the main session cookie and SHALL delegate auth session invalidation to auth for auth-owned session state.

#### Scenario: User signs out
- **WHEN** the browser completes sign-out through `/auth/sign-out`
- **THEN** the auth session SHALL be invalidated by auth
- **AND** main SHALL clear the `rezics-session-token` cookie for the browser
