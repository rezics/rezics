# unified-access-token Specification

## Purpose

Define the single JWT access token that replaces all previous service-specific tokens (AUTH_CONTEXT, REZICS_SESSION). The auth service issues one enriched access token used by all resource servers.

## Requirements

### Requirement: Access token carries enriched claims for provisioning and gating

The auth service's `definePayload` in `package/auth/src/auth/instance.ts` SHALL produce JWT claims that include `id`, `slug`, `name`, `scope`, and conditionally `email_verified`. The `name` claim SHALL be the user's display name from the auth database. The `role` claim from the auth admin plugin MAY continue to be included.

#### Scenario: Verified user token contains name but no email_verified

- **WHEN** a verified user requests an access token
- **THEN** the JWT payload SHALL contain `{ sub, id, slug, name, scope: "user" }`
- **AND** the `email_verified` claim SHALL NOT be present in the payload

#### Scenario: Unverified user token contains email_verified false

- **WHEN** an unverified user requests an access token
- **THEN** the JWT payload SHALL contain `{ sub, id, slug, name, scope: "user", email_verified: false }`

#### Scenario: Name claim reflects auth database

- **WHEN** a user updates their name in the auth service
- **THEN** the next access token issued SHALL contain the updated `name` claim

### Requirement: Single access token replaces all service tokens

The system SHALL use a single JWT access token (issued by the auth service) as the sole bearer credential for all resource servers (Server, Notify, Reaction). The token SHALL be transported via `Authorization: Bearer` header.

#### Scenario: Same token accepted by all services

- **WHEN** the browser sends the access token to Server, Notify, and Reaction
- **THEN** each service SHALL independently verify the token via the auth service's JWKS
- **AND** each service SHALL extract `userId` from the `sub` or `unitId` claim

#### Scenario: No second token required for server endpoints

- **WHEN** a user calls a server endpoint that previously required `x-rezics-session-token`
- **THEN** the server SHALL authenticate and authorize using only the `Authorization: Bearer` access token
- **AND** the `x-rezics-session-token` header SHALL NOT be required

### Requirement: AUTH_CONTEXT token type is removed

The `AUTH_CONTEXT` token name, transport header (`x-auth-context-token`), and claim schema SHALL be removed from `@rezics/contract`. The auth service endpoint that issues context tokens SHALL be removed or deprecated.

#### Scenario: Contract no longer exports AUTH_CONTEXT

- **WHEN** a consumer imports from `@rezics/contract`
- **THEN** `NormalizedTokenName.AUTH_CONTEXT` SHALL NOT be available
- **AND** `TokenTransportHeader.AUTH_CONTEXT` SHALL NOT be available
- **AND** `AuthContextTokenClaims` SHALL NOT be exported

### Requirement: REZICS_SESSION token type is removed

The `REZICS_SESSION` token name, transport header (`x-rezics-session-token`), claim schema, and all associated infrastructure SHALL be removed from `@rezics/contract` and `@rezics/server`.

#### Scenario: Contract no longer exports REZICS_SESSION

- **WHEN** a consumer imports from `@rezics/contract`
- **THEN** `NormalizedTokenName.REZICS_SESSION` SHALL NOT be available
- **AND** `TokenTransportHeader.REZICS_SESSION` SHALL NOT be available
- **AND** `RezicsSessionTokenClaims` SHALL NOT be exported
- **AND** `sessionPermissionSnapshotSchema` SHALL NOT be exported

#### Scenario: Server no longer issues session tokens

- **WHEN** the server starts
- **THEN** the `POST /session/token` endpoint SHALL NOT exist
- **AND** the server SHALL NOT bootstrap a `server-local` JWT service for signing tokens

### Requirement: Conditional email_verified claim semantics

Resource servers SHALL interpret the `email_verified` claim as follows: if the claim is present and `false`, the user is unverified. If the claim is absent (undefined), the user is verified. Resource servers SHALL NOT require the claim to be explicitly `true`.

#### Scenario: Endpoint requiring verification rejects unverified user

- **WHEN** a request carries an access token with `email_verified: false`
- **AND** the endpoint requires email verification
- **THEN** the server SHALL return `status(403)` with a message indicating email verification is required

#### Scenario: Endpoint requiring verification accepts verified user

- **WHEN** a request carries an access token without an `email_verified` claim
- **AND** the endpoint requires email verification
- **THEN** the server SHALL allow the request to proceed

#### Scenario: Public endpoint accepts unverified user

- **WHEN** a request carries an access token with `email_verified: false`
- **AND** the endpoint does not require email verification
- **THEN** the server SHALL allow the request to proceed
