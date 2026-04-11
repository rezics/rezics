## ADDED Requirements

### Requirement: JWT verification for public endpoints
The reaction service SHALL verify auth-issued JWTs on endpoints that require authentication (`POST /reactions`, `DELETE /reactions`, `GET /reactions/my`). Verification SHALL use `createJwtVerifier()` and `createRemoteJWKSet()` from `@rezics/jwt` against the auth service's JWKS endpoint (`AUTH_JWKS_URL`).

#### Scenario: Valid JWT
- **WHEN** a client sends a request with a valid JWT in the `Authorization: Bearer <token>` header
- **THEN** the system extracts `userId` from the `sub` claim and proceeds with the request

#### Scenario: Expired JWT
- **WHEN** a client sends a request with an expired JWT
- **THEN** the system returns status 401

#### Scenario: Invalid signature
- **WHEN** a client sends a request with a JWT signed by an unknown key
- **THEN** the system returns status 401

#### Scenario: Missing authorization header
- **WHEN** a client sends a request to an authenticated endpoint without an `Authorization` header
- **THEN** the system returns status 401

### Requirement: Shared secret for internal endpoints
The reaction service SHALL verify the `x-internal-secret` header on internal endpoints (`/internal/*`). The secret SHALL match the `REACTION_INTERNAL_SECRET` environment variable.

#### Scenario: Valid internal secret
- **WHEN** a service sends a request with matching `x-internal-secret` header
- **THEN** the system proceeds with the request

#### Scenario: Invalid internal secret
- **WHEN** a client sends a request with a non-matching `x-internal-secret` header
- **THEN** the system returns status 401

### Requirement: Unauthenticated summary endpoint
The `GET /reactions/summary` endpoint SHALL NOT require authentication. Reaction counts are public data.

#### Scenario: Summary without auth
- **WHEN** an unauthenticated client sends `GET /reactions/summary?targetIds=abc`
- **THEN** the system returns the reaction summary with status 200
