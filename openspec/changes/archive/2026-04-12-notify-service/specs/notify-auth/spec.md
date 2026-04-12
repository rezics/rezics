## ADDED Requirements

### Requirement: JWT verification for read endpoints
All user-facing read endpoints SHALL verify the caller's identity by validating a JWT issued by the auth service. The `sub` claim SHALL be extracted as `userId` and used to scope all queries to that user's data.

#### Scenario: Valid JWT grants access
- **WHEN** a request to `GET /notifications` includes a valid auth-issued JWT
- **THEN** the `sub` claim is extracted as `userId`
- **AND** only notifications with `recipientId=userId` are returned

#### Scenario: Invalid JWT rejected
- **WHEN** a request to `GET /notifications` includes an expired or malformed JWT
- **THEN** the request is rejected with 401

### Requirement: Reuse @rezics/jwt verification
Notify SHALL use `createJwtVerifier()` and `createRemoteJWKSet()` from `@rezics/jwt` to verify auth-issued tokens. Notify SHALL NOT implement custom JWKS fetching or caching logic.

#### Scenario: JWKS fetched from auth
- **WHEN** Notify starts and receives its first authenticated request
- **THEN** it fetches public keys from `AUTH_JWKS_URL` via `createRemoteJWKSet()`
- **AND** subsequent requests use cached keys with automatic refresh

### Requirement: Elysia requireUser macro
Notify SHALL define a `requireUser` Elysia macro that performs JWT verification and populates `userId` in the request context. This macro SHALL be applied to all user-facing endpoints.

#### Scenario: Macro populates userId
- **WHEN** a request passes through the `requireUser` macro with a valid JWT
- **THEN** `context.userId` is set to the JWT's `sub` claim
- **AND** route handlers can access `userId` without repeated verification logic

### Requirement: WebSocket authentication via query parameter
The WebSocket endpoint `WS /dm` SHALL accept the JWT as a `token` query parameter since browsers cannot set custom headers during WebSocket handshake. The token SHALL be validated on connection open; invalid tokens SHALL cause immediate close with code 4001.

#### Scenario: WebSocket authenticated successfully
- **WHEN** a client connects to `WS /dm?token=<valid-jwt>`
- **THEN** the connection is established and `userId` is extracted from the token

#### Scenario: WebSocket authentication failure
- **WHEN** a client connects to `WS /dm?token=<invalid-jwt>`
- **THEN** the connection is closed with code 4001 before any messages are processed

### Requirement: Internal secret verification
Internal write endpoints SHALL use `x-internal-secret` header verification against `NOTIFY_INTERNAL_SECRET` environment variable. This is separate from JWT verification — internal endpoints do not require JWTs.

#### Scenario: Internal and user auth are independent paths
- **WHEN** a request arrives at `POST /internal/event` with a valid `x-internal-secret`
- **THEN** no JWT verification is performed — the shared secret is sufficient
