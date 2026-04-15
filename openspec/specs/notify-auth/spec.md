## MODIFIED Requirements

### Requirement: JWT verification for read endpoints

All user-facing read endpoints SHALL verify caller's identity by validating `rezics-session-token` (issued by server) via the server's JWKS endpoint. Extract `sub` claim as `userId`, scope queries to that user's data. The token is received via `Authorization: Bearer`.

#### Scenario: Valid rezics-session-token grants access

- **WHEN** a user-facing read endpoint receives a request with `Authorization: Bearer <valid-rezics-session-token>`
- **THEN** the JWT is verified against the server's JWKS, `sub` is extracted as `userId`, and the request proceeds

#### Scenario: auth-session-token is rejected

- **WHEN** a request includes an `auth-session-token` (issuer "rezics-auth") in `Authorization: Bearer`
- **THEN** verification fails (issuer mismatch) and the endpoint returns 401

### Requirement: Reuse @rezics/jwt verification

Notify SHALL use `createJwtVerifier()` and `createRemoteJWKSet()` from `@rezics/jwt` to verify server-issued tokens. The JWKS URL SHALL point to the server's `/.well-known/jwks.json` endpoint instead of the auth service's JWKS endpoint.

#### Scenario: JWKS URL points to server

- **WHEN** the notify service initializes its JWT verifier
- **THEN** the remote JWKS URL is configured to the main server's JWKS endpoint

### Requirement: Elysia requireUser macro

Notify SHALL define `requireUser` Elysia macro performing `rezics-session-token` verification, populating `userId` in request context, applied to all user-facing endpoints.

#### Scenario: requireUser extracts userId from rezics-session-token

- **WHEN** a user-facing endpoint processes a request with `requireUser: true`
- **THEN** the `userId` in request context is the `sub`/`unitId` claim from the `rezics-session-token`

### Requirement: WebSocket authentication via query parameter

WebSocket endpoint `WS /dm` SHALL accept `rezics-session-token` as `token` query parameter. Validate on connection open against server JWKS. Invalid tokens cause immediate close with code 4001.

#### Scenario: WebSocket accepts rezics-session-token

- **WHEN** a WebSocket connection is opened with `?token=<valid-rezics-session-token>`
- **THEN** the token is verified against server JWKS and the connection is established

### Requirement: Internal secret verification

Internal write endpoints SHALL use `x-internal-secret` header verification against `NOTIFY_INTERNAL_SECRET` environment variable. This is separate from JWT verification and unchanged by this change.

#### Scenario: Internal endpoints use shared secret

- **WHEN** the server calls a notify internal endpoint
- **THEN** it authenticates via `x-internal-secret` header, not via JWT
