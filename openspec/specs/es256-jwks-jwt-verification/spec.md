## ADDED Requirements

### Requirement: ES256 token signing model
The auth service SHALL sign JWTs using ES256 with a single active private signing key and SHALL include `kid` in token headers.

#### Scenario: Access token is issued
- **WHEN** the auth service issues a JWT for resource access
- **THEN** the token header SHALL declare `alg` as `ES256` and SHALL include a key identifier `kid`

### Requirement: JWKS publication and compatibility endpoint
The auth service SHALL expose JWKS at `/api/auth/jwks` and SHALL expose a compatibility endpoint at `/.well-known/jwks.json` that returns equivalent JWKS content.

#### Scenario: Resource service fetches compatibility JWKS endpoint
- **WHEN** a resource service requests `/.well-known/jwks.json`
- **THEN** the response SHALL contain the same active and retained public keys as `/api/auth/jwks`

### Requirement: Resource-service offline verification contract
Resource services SHALL verify JWTs offline using JWKS and SHALL validate `alg`, `kid`, `iss`, `aud`, `exp`, and `nbf` with configurable clock tolerance.

#### Scenario: Token has mismatched audience
- **WHEN** a resource service verifies a token whose `aud` is not `rezics-api`
- **THEN** the verifier SHALL reject the token as unauthorized

### Requirement: Unknown key refresh behavior
Resource services SHALL cache JWKS for normal verification and SHALL trigger a JWKS refresh when receiving a token with an unknown `kid`.

#### Scenario: Token references unseen key id
- **WHEN** verification encounters an unknown `kid`
- **THEN** the verifier SHALL refresh JWKS once and SHALL retry verification before returning failure

### Requirement: Key rotation safety window
The auth service SHALL support key rotation by publishing multiple JWKS keys and SHALL retain old public keys for at least longest token TTL plus a configured safety buffer.

#### Scenario: Token signed before rotation remains valid
- **WHEN** a token signed by the previous key is still within validity window
- **THEN** resource services SHALL continue to verify it successfully using retained JWKS public keys

### Requirement: Server direct migration to auth-issued JWT
`package/server` SHALL stop local JWT issuance and SHALL use shared JWT verification utilities/hooks to validate same-origin tokens issued by `package/auth` using claims `{ "aud": "rezics-api", "scope": "user" }`.

#### Scenario: Server receives auth-issued bearer token
- **WHEN** a protected `package/server` endpoint receives `Authorization: Bearer <token>`
- **THEN** the server SHALL authorize the request only after offline verification against auth JWKS and required claim validation
