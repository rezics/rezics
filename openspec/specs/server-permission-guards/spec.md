# server-permission-guards Specification

## Purpose

Defines the Elysia macro guards used by the main server to authenticate requests via JWT. `requireLogin` validates the member `rezics-session-token`; the profile setup guard validates `rezics-profile-setup-token`. Identity is resolved from JWT claims without database lookups, and only `unitId` is trusted for identity; `permission.role` is a rejection-only hint that must be re-verified against the database before granting access.

## Requirements

### Requirement: requireLogin guard plugin

Server SHALL provide `requireLogin` as Elysia macro within auth macro plugin. The macro SHALL verify the request's member `rezics-session-token` against the server's own JWKS and SHALL reject profile setup tokens. It SHALL resolve an `identity` object with `{ unitId: string, permission: Permission }` from member token claims, where `Permission` is `{ role: TokenPermissionRole }`. No database lookup is performed. Only `unitId` is trusted for identity; `permission.role` is a rejection-only hint.

#### Scenario: Valid rezics-session-token resolves identity

- **WHEN** a request includes a valid member `rezics-session-token` and the route has `requireLogin: true`
- **THEN** the macro resolves `identity` with `unitId` and `permission` (containing `role`) from the JWT claims

#### Scenario: Invalid token returns 401

- **WHEN** a request includes an invalid or expired member token
- **THEN** the macro returns status 401

#### Scenario: Profile setup token is rejected by requireLogin

- **WHEN** a request includes only `rezics-profile-setup-token` and the route has `requireLogin: true`
- **THEN** the macro returns status 401 or 403
- **AND** the route handler SHALL NOT run

### Requirement: Profile setup guard plugin

Server SHALL provide a profile setup guard macro for routes that are allowed during profile setup. This macro SHALL validate `rezics-profile-setup-token`, require a setup-specific token purpose, and resolve the minimal user identity for setup routes.

#### Scenario: Valid setup token resolves setup identity

- **WHEN** a profile setup route receives a valid `rezics-profile-setup-token`
- **THEN** the macro SHALL resolve the setup user identity
- **AND** the route SHALL be allowed to complete profile setup operations

#### Scenario: Setup token is not accepted by normal routes

- **WHEN** a normal product route uses `requireLogin: true`
- **THEN** it SHALL NOT accept the profile setup guard or setup token
- **AND** normal member APIs SHALL remain member-only

### Requirement: Route files use macro flags instead of global plugin guards

Route files SHALL use per-route macro flags (`requireLogin: true`) in route options. Role checks SHALL use `identity.permission.role` for early rejection and database verification for granting access. Ownership checks use the trusted `unitId` claim.

#### Scenario: Admin route uses permission.role for rejection and DB for grant

- **WHEN** a route requires admin access
- **THEN** the route uses `requireLogin: true`, first checks `identity.permission.role` to reject non-admin tokens (fast path, no DB), then queries the database to verify the role before granting access

#### Scenario: Ownership check uses trusted unitId

- **WHEN** a route requires resource ownership verification
- **THEN** the route uses `requireLogin: true` and checks `identity.unitId === resource.unitId` in the handler body (unitId is trusted, no DB lookup needed for identity)
