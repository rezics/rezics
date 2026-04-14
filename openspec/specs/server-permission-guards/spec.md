## MODIFIED Requirements

### Requirement: requireLogin guard plugin

Server SHALL provide `requireLogin` as Elysia macro within auth macro plugin. The macro SHALL verify the `Authorization: Bearer` token as a `rezics-session-token` against the server's own JWKS. It SHALL resolve `identity` object with `{ unitId: string, permission: Permission }` from the token claims, where `Permission` is `{ role: TokenPermissionRole }`. No database lookup is performed. Only `unitId` is trusted for identity; `permission.role` is a rejection-only hint.

#### Scenario: Valid rezics-session-token resolves identity

- **WHEN** a request includes `Authorization: Bearer <valid-rezics-session-token>` and the route has `requireLogin: true`
- **THEN** the macro resolves `identity` with `unitId` and `permission` (containing `role`) from the JWT claims

#### Scenario: Invalid token returns 401

- **WHEN** a request includes an invalid or expired bearer token
- **THEN** the macro returns status 401

### Requirement: Route files use macro flags instead of global plugin guards

Route files SHALL use per-route macro flags (`requireLogin: true`) in route options. Role checks SHALL use `identity.permission.role` for early rejection and database verification for granting access. Ownership checks use the trusted `unitId` claim.

#### Scenario: Admin route uses permission.role for rejection and DB for grant

- **WHEN** a route requires admin access
- **THEN** the route uses `requireLogin: true`, first checks `identity.permission.role` to reject non-admin tokens (fast path, no DB), then queries the database to verify the role before granting access

#### Scenario: Ownership check uses trusted unitId

- **WHEN** a route requires resource ownership verification
- **THEN** the route uses `requireLogin: true` and checks `identity.unitId === resource.unitId` in the handler body (unitId is trusted, no DB lookup needed for identity)
