# unified-jwt-audience Specification

## Purpose

Defines `rezics` as the shared default JWT audience for all core
services (auth and main server), the env-variable override mechanism
for non-default configurations, and the rule that token purpose
(identity vs session vs context) is distinguished by transport
header and `NormalizedTokenName` rather than by audience
differentiation. `bootstrapJwtServiceRecord` updates existing rows
on restart so deployments converge on the unified audience.

## Requirements

### Requirement: Default audience is `rezics` for all core services

All core Rezics services SHALL use `rezics` as the default audience (`aud`) claim for JWT tokens. This applies to both token issuance and verification. Environment variable overrides SHALL remain available for non-default configurations.

#### Scenario: Auth service issues tokens with `rezics` audience
- **WHEN** the auth service issues an identity or context token without explicit audience override
- **THEN** the token's `aud` claim SHALL be `rezics`

#### Scenario: Server issues session tokens with `rezics` audience
- **WHEN** the main server issues a session token without explicit audience override
- **THEN** the token's `aud` claim SHALL be `rezics`

#### Scenario: Server verifies auth tokens expecting `rezics` audience
- **WHEN** the main server verifies an identity token from the auth service
- **THEN** the verifier SHALL expect audience `rezics`

#### Scenario: Environment variable overrides audience
- **WHEN** `AUTH_JWT_AUDIENCE` or `MAIN_SESSION_JWT_AUDIENCE` is set to a custom value
- **THEN** that service SHALL use the custom audience instead of `rezics`

### Requirement: Bootstrap updates existing audience records

The `bootstrapJwtServiceRecord` upsert SHALL update the `audience` field of existing `JwtService` records to match the current default. This ensures existing deployments transition to the new audience on the next service restart.

#### Scenario: Existing service record audience is updated on restart
- **WHEN** a service restarts with the new default audience `rezics`
- **AND** an existing `JwtService` record has audience `rezics-api`
- **THEN** the bootstrap upsert SHALL update the record's audience to `rezics`

### Requirement: Token purpose distinguished by transport, not audience

Within core Rezics services, token purpose (identity vs session vs context) SHALL be distinguished by HTTP transport headers and `NormalizedTokenName`, not by audience claim differentiation. All core tokens share the same audience.

#### Scenario: Identity and session tokens share audience but differ by header
- **WHEN** the server receives a request with both `Authorization` and `x-rezics-session-token` headers
- **THEN** the identity token (from `Authorization`) and session token (from `x-rezics-session-token`) SHALL both have audience `rezics`
- **AND** they SHALL be distinguished by their respective transport headers and verifier configurations
