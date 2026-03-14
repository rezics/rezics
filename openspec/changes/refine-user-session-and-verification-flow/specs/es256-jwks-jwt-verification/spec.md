## MODIFIED Requirements

### Requirement: Server direct migration to auth-issued JWT
`package/server` SHALL verify issuer-scoped asymmetric JWTs through shared utilities in `package/auth/src/jwt/verify.ts`. The shared verifier SHALL support auth-issued identity tokens and server-issued session tokens by validating `alg`, `kid`, `iss`, `aud`, `exp`, and `nbf` against issuer-specific key configuration supplied by the caller, including explicit verification secrets for main-server tokens rather than env-only resolution.

#### Scenario: Server receives auth-issued bearer token
- **WHEN** a protected `package/server` endpoint receives `Authorization: Bearer <auth_identity_token>`
- **THEN** the server SHALL authorize identity-dependent behavior only after offline verification against the auth issuer JWKS and required claim validation

#### Scenario: Server receives main-server session token
- **WHEN** a protected `package/server` endpoint receives `x-rezics_session_token: <rezics_session_token>`
- **THEN** the shared verifier SHALL validate that token against the main-server issuer configuration using an asymmetric key and normalized token-type rules

#### Scenario: Caller provides verifier secret configuration explicitly
- **WHEN** a service uses the shared verifier for a non-auth issuer such as the main server
- **THEN** it SHALL be able to pass the verification secret or key configuration directly to the verifier
- **AND** the verifier SHALL NOT require package-local env access to resolve that configuration

#### Scenario: Shared verifier rejects mismatched transport and issuer assumptions
- **WHEN** a token is presented under the wrong normalized header contract or fails issuer-specific validation
- **THEN** the shared verifier SHALL reject the token as unauthorized
- **AND** downstream business logic SHALL NOT treat the token as valid
