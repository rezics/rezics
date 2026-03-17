## MODIFIED Requirements

### Requirement: Independent auth service boundary
The system SHALL provide a standalone authentication service in `package/auth` where Better Auth owns session handling, JWT and JWKS concerns are modularized under session ownership, and downstream services depend on published contracts and public endpoints rather than auth-internal verification helpers.

#### Scenario: Auth service boots with session-owned JWT modules
- **WHEN** the auth service boots in development or production
- **THEN** session handling SHALL be owned by Better Auth while JWT/JWKS route ownership and adapter composition remain isolated inside `package/auth`

### Requirement: Internal token surface isolation
The auth service SHALL keep internal or same-origin session token surfaces isolated from external/public OAuth surfaces, SHALL make JWKS verification endpoints publicly reachable where required, and SHALL avoid exposing legacy verify-only compatibility paths.

#### Scenario: Public verifier requests JWKS while internal session routes stay protected
- **WHEN** a public verifier fetches JWKS and an unrelated caller requests a protected session-only route
- **THEN** the JWKS request SHALL succeed without session credentials and the protected route SHALL continue enforcing its intended auth boundary

## ADDED Requirements

### Requirement: Auth service exposes one auth-owned signing surface
The auth service SHALL issue all of its JWT token types from one active private signing key and SHALL publish one auth-owned JWKS surface that covers all retained public keys needed to verify auth-issued tokens.

#### Scenario: Auth issues identity and context tokens
- **WHEN** the auth service issues both identity and context JWTs
- **THEN** both JWTs SHALL be signed by the same active auth-private key and SHALL be verifiable from the same auth JWKS document
