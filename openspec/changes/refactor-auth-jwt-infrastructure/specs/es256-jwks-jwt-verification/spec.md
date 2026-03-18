## MODIFIED Requirements

### Requirement: ES256 token signing model
Each issuing service SHALL sign JWTs using ES256 with exactly one active private signing key per server, SHALL include `kid` in token headers, and SHALL use the same active key for every JWT token type that server issues.

#### Scenario: Server issues multiple token types
- **WHEN** a server issues more than one JWT token type
- **THEN** all issued JWTs SHALL be signed by the same active server-private key and SHALL identify that key with `kid`

### Requirement: JWKS publication and compatibility endpoint
Each issuing service SHALL expose one canonical JWKS endpoint per server, and any compatibility endpoint such as `/.well-known/jwks.json` SHALL return equivalent public-key material for that same server.

#### Scenario: Client fetches canonical and compatibility JWKS routes
- **WHEN** a verifier requests both the canonical JWKS endpoint and a compatibility JWKS endpoint for the same server
- **THEN** both responses SHALL publish the same active and retained public keys for that server

### Requirement: Resource-service offline verification contract
Services that verify JWTs offline SHALL use shared JWT verification contracts, SHALL validate `alg`, `kid`, `iss`, `aud`, `exp`, and `nbf` with configurable clock tolerance, and SHALL NOT depend on `@package/auth` verification helpers.

#### Scenario: Server verifies auth-issued token through shared verifier
- **WHEN** `package/server` receives an auth-issued bearer token
- **THEN** it SHALL verify that token through shared JWT contracts using `AUTH_JWKS_URL` rather than importing auth-owned verification code

### Requirement: Unknown key refresh behavior
Services that verify JWTs from remote JWKS SHALL cache JWKS for normal verification and SHALL trigger one JWKS refresh when verification encounters an unknown `kid` before returning failure.

#### Scenario: Token references unseen key id
- **WHEN** verification encounters a token whose `kid` is not present in the cached JWKS
- **THEN** the verifier SHALL refresh the JWKS once and SHALL retry verification before rejecting the token

### Requirement: Key rotation safety window
Each issuing service SHALL support key rotation by publishing active and retained public keys in JWKS and SHALL retain old public keys for at least `token_ttl * 2` after rotation unless a longer service-specific grace period is configured.

#### Scenario: Token signed before rotation remains valid
- **WHEN** a token signed by the previous key remains within its validity window and the grace period has not expired
- **THEN** verifiers SHALL continue to validate that token successfully using the retained JWKS public key

### Requirement: Server direct migration to auth-issued JWT
`package/server` SHALL stop relying on auth-owned verification wrappers, SHALL maintain its own issuing and verification flow through shared package abstractions, and SHALL retain only `AUTH_JWKS_URL` as the auth-specific runtime dependency needed to verify auth-issued tokens.

#### Scenario: Server verifies auth-issued bearer token after decoupling
- **WHEN** a protected `package/server` endpoint receives `Authorization: Bearer <token>`
- **THEN** the server SHALL authorize the request only after offline verification against `AUTH_JWKS_URL` through shared verifier contracts and required claim validation

### Requirement: Verification inputs remain explicit and trusted
Services that verify JWTs SHALL continue to validate trusted issuer and audience values explicitly, and those verifier inputs SHALL be sourced from persisted service metadata records once the migration is complete.

#### Scenario: Server verifies auth-issued token with persisted verifier metadata
- **WHEN** `package/server` handles an auth-issued bearer token after the metadata migration
- **THEN** it SHALL read the trusted auth issuer, audience, and canonical JWKS location from its local JWT service metadata record and SHALL validate all three during verification
