## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: AUTH_CONTEXT token type is removed

**Reason**: Already removed in `pure-oauth-auth` change.
**Migration**: N/A — already completed. Restated here only for completeness; unchanged by this change.

### Requirement: REZICS_SESSION token type is removed

**Reason**: Restated for completeness; the active definition lives in `server-access-token`. This change does not reintroduce or further redefine the legacy token name.
**Migration**: Refer to `server-access-token` for the canonical `rezics-session-token` definition.

### Requirement: Conditional email_verified claim semantics

**Reason**: With the JWT-in-header pathway deleted, the browser never receives an `auth-session-token` JWT and never reads `email_verified` from it. Verification gating happens at the cookie boundary, which consults auth's validated session state directly.
**Migration**: Verification checks live in `materializeMainAccountFromAuth` / `refreshMainSessionFromAuth`, which read auth's current session state via internal call.
