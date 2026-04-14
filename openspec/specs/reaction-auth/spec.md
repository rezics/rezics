## MODIFIED Requirements

### Requirement: JWT verification for read endpoints

Reaction service SHALL verify `rezics-session-token` (issued by server) on authenticated read endpoints (`GET /reactions/my`) using `createJwtVerifier()` and `createRemoteJWKSet()` from `@rezics/jwt` against the server's JWKS endpoint. The token is received via `Authorization: Bearer`.

#### Scenario: Valid rezics-session-token grants access to user reactions

- **WHEN** `GET /reactions/my` receives a request with `Authorization: Bearer <valid-rezics-session-token>`
- **THEN** the JWT is verified against the server's JWKS, `sub` is extracted as user identity, and the user's reactions are returned

#### Scenario: auth-identity-token is rejected

- **WHEN** a request includes an `auth-identity-token` in `Authorization: Bearer`
- **THEN** verification fails (issuer mismatch) and the endpoint returns 401

### Requirement: Shared secret for internal endpoints

Reaction service SHALL verify `x-internal-secret` header on internal endpoints. Secret SHALL match `REACTION_INTERNAL_SECRET` environment variable. Unchanged by this change.

#### Scenario: Internal write uses shared secret

- **WHEN** the server proxies a write operation to the reaction service
- **THEN** it authenticates via `x-internal-secret` header

### Requirement: Unauthenticated summary endpoint

`GET /reactions/summary` endpoint SHALL NOT require authentication. Reaction counts are public data. Unchanged.

#### Scenario: Summary endpoint is public

- **WHEN** `GET /reactions/summary` is called without any authorization header
- **THEN** the endpoint returns reaction counts normally

### Requirement: Main server proxies writes with JWT auth

Main server's `POST /reactions` and `DELETE /reactions` endpoints SHALL verify user identity via `rezics-session-token` using `requireLogin` macro, then call reaction service's internal endpoints with shared secret.

#### Scenario: Server verifies rezics-session-token before proxying

- **WHEN** a user calls `POST /reactions` on the main server
- **THEN** the server verifies the `rezics-session-token` via `requireLogin`, extracts the user identity, and proxies the request to the reaction service with `x-internal-secret`
