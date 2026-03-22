## MODIFIED Requirements

### Requirement: Verification inputs remain explicit and trusted
Services that verify JWTs SHALL continue to validate trusted issuer and audience values
explicitly. Verifier inputs SHALL be sourced from `getJwtService(serviceKey)` — the
DB-backed cached repository — rather than from environment variables or module-level
constants.

#### Scenario: Server verifies auth-issued token with DB-backed metadata
- **WHEN** `package/server` handles an auth-issued bearer token
- **THEN** it SHALL call `getJwtService('auth-upstream')` to obtain the trusted issuer,
  audience, and canonical JWKS URL, and SHALL validate all three during verification

#### Scenario: Metadata change takes effect without restart
- **WHEN** the trusted auth issuer is updated via the admin API
- **THEN** subsequent verification calls SHALL use the updated issuer from the cache
  (repopulated from DB) without requiring a process restart

### Requirement: Resource-service offline verification contract
Services that verify JWTs offline SHALL use shared JWT verification contracts, SHALL
validate `alg`, `kid`, `iss`, `aud`, `exp`, and `nbf` with configurable clock tolerance,
and SHALL resolve the JWKS URL from `getJwtService(serviceKey)` rather than from the
`AUTH_JWKS_URL` environment variable.

#### Scenario: Server verifies auth-issued token through cached metadata
- **WHEN** `package/server` receives an auth-issued bearer token
- **THEN** it SHALL verify that token through shared JWT contracts using the `jwksUrl`
  resolved from `getJwtService('auth-upstream')` rather than reading `AUTH_JWKS_URL`
  from the environment

### Requirement: JWKS publication uses DB-backed keys
The JWKS endpoint SHALL return public keys sourced from the `JwtService` cache entry
rather than from the rotation engine's in-memory state alone.

#### Scenario: JWKS endpoint returns DB-sourced keys
- **WHEN** a verifier requests `GET /session/jwks`
- **THEN** the endpoint SHALL call `getJwtService('server-local')` and return all
  non-expired `publicJwk` values from the cached entry's `jwks` array
