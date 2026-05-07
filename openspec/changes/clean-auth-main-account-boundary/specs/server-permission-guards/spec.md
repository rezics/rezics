## MODIFIED Requirements

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

## ADDED Requirements

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

