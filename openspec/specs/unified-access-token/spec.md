# unified-access-token Specification

## Purpose

Defines `rezics-session-token` as the single bearer credential
verified by Server, Notify, Search, and Reaction against the
server JWKS. Owns the cookie-boundary rule that the browser only
obtains and refreshes the token via `POST /auth/session/refresh`,
forbids any `x-auth-session-token` header (including in CORS
`allowedHeaders`), and routes auth identity facts to the boundary
through internal service-to-service calls rather than a
browser-readable JWT.

## Requirements

### Requirement: Single access token replaces all service tokens

System SHALL use a single JWT access token — `rezics-session-token` — issued by the server as the sole bearer credential for all resource services (Server, Notify, Search, Reaction). The browser obtains and refreshes this token exclusively through the cookie-boundary endpoint `POST /auth/session/refresh`, which validates the auth session httpOnly cookie via internal call to auth. The auth-owned `auth-session-token` JWT SHALL NOT be used as a header-based exchange or refresh credential at any boundary; it is no longer issued for browser flows. Auth session authority is conveyed by the opaque auth session cookie only. Header-based session credentials (`x-auth-session-token`) SHALL NOT be defined, sent, accepted, or listed in CORS `allowedHeaders`.

#### Scenario: All services validate rezics-session-token

- **WHEN** any service (server, notify, search, reaction) receives an API request
- **THEN** it validates the `Authorization: Bearer` token (or cookie) as a `rezics-session-token` against the server's JWKS endpoint

#### Scenario: rezics-session-token is obtained via cookie boundary

- **WHEN** the frontend needs to obtain or refresh a `rezics-session-token`
- **THEN** it calls `POST /auth/session/refresh` with credentials-included so the auth session httpOnly cookie is forwarded
- **AND** it SHALL NOT send any `x-auth-session-token` header

#### Scenario: Header-based session credential is rejected everywhere

- **WHEN** any consumer sends an `x-auth-session-token` header to any service
- **THEN** the header SHALL be ignored and SHALL NOT appear in any service's CORS `allowedHeaders`

### Requirement: Access token carries enriched claims for provisioning and gating

Auth service produces an internal session representation that, when consulted by the cookie-boundary refresh endpoint, supplies `userId`, `email`, `email_verified`, and any provider/identity facts the boundary needs to materialize or refresh a main user. These facts SHALL flow through internal service-to-service calls (not through a JWT presented by the browser). The browser SHALL NOT depend on, decode, or read claims from any `auth-session-token` JWT.

#### Scenario: Cookie boundary reads auth identity through internal call

- **WHEN** main needs auth identity facts during `/auth/session/refresh`
- **THEN** main SHALL call auth internally (through the configured private channel) to obtain the validated session and identity
- **AND** the browser SHALL NOT receive or decode an `auth-session-token` JWT

