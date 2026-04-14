## MODIFIED Requirements

### Requirement: requireLogin guard plugin

Server SHALL provide `requireLogin` as Elysia macro within auth macro plugin. The macro SHALL verify the `Authorization: Bearer` token as a `rezics-session-token` against the server's own JWKS. It SHALL resolve `identity` object with `{ unitId: string, role: UserRole }` from the token claims. No database lookup is performed. Only `unitId` is trusted for identity; `role` is a rejection-only hint.

#### Scenario: Valid rezics-session-token resolves identity

- **WHEN** a request includes `Authorization: Bearer <valid-rezics-session-token>` and the route has `requireLogin: true`
- **THEN** the macro resolves `identity` with `unitId` and `role` from the JWT claims

#### Scenario: Invalid token returns 401

- **WHEN** a request includes an invalid or expired bearer token
- **THEN** the macro returns status 401

### Requirement: Route files use macro flags instead of global plugin guards

Route files SHALL use per-route macro flags (`requireLogin: true`) in route options. Role checks SHALL use token role for early rejection and database verification for granting access. Ownership checks use the trusted `unitId` claim.

#### Scenario: Admin route uses token role for rejection and DB for grant

- **WHEN** a route requires admin access
- **THEN** the route uses `requireLogin: true`, first checks `identity.role` to reject non-admin tokens (fast path, no DB), then queries the database to verify the role before granting access

#### Scenario: Ownership check uses trusted unitId

- **WHEN** a route requires resource ownership verification
- **THEN** the route uses `requireLogin: true` and checks `identity.unitId === resource.unitId` in the handler body (unitId is trusted, no DB lookup needed for identity)

## REMOVED Requirements

### Requirement: Admin route handlers do not duplicate guard checks

**Reason**: With `requireAdmin` macro removed, admin checks are explicitly inline. There is no macro to duplicate. This requirement is superseded by the inline check pattern.
**Migration**: Routes that used `requireAdmin: true` now use `requireLogin: true` with an inline `identity.role` check.

### Requirement: Session token issuance verifies auth eligibility

**Reason**: The `POST /session/token` endpoint and its `getAuthSessionState()` callback to auth are removed entirely. The replacement is `POST /session/exchange`, which verifies the `auth-identity-token` JWT directly via JWKS — no auth service callback.
**Migration**: Delete `POST /session/token` endpoint and `session-state.ts`. The `POST /session/exchange` endpoint handles token issuance.
