## MODIFIED Requirements

### Requirement: Auth macro plugin

Server SHALL provide Elysia plugin in `package/server/src/middleware/permission.ts` defining a single `requireLogin` macro using `.macro()`. The plugin SHALL be named `macro/auth`.

#### Scenario: Plugin is registered on the server instance

- **WHEN** the server starts
- **THEN** the `macro/auth` plugin is available and provides `requireLogin` as a route-level macro option

### Requirement: requireLogin macro

Macro SHALL accept boolean. When enabled, it SHALL read the `Authorization` header, verify the token as a `rezics-session-token` against the server's own JWKS, and resolve `identity` with `{ unitId, role }` from the token claims. Only `unitId` is trusted as identity. The `role` is a rejection-only hint — it SHALL NOT be used to grant elevated access. SHALL return 401 if the token is missing, invalid, or expired.

#### Scenario: Valid rezics-session-token resolves identity

- **WHEN** a request includes a valid `rezics-session-token` in `Authorization: Bearer`
- **THEN** `requireLogin` resolves `identity` as `{ unitId: string, role: UserRole }` from the JWT claims

#### Scenario: Missing or invalid token returns 401

- **WHEN** a request is missing the `Authorization` header or contains an invalid/expired token
- **THEN** `requireLogin` returns status 401

## REMOVED Requirements

### Requirement: requireOwner macro

**Reason**: `requireOwner` conflated identity verification, user DB lookup, caching, and lazy provisioning into a single middleware. With `rezics-session-token` carrying role in claims and provisioning guaranteed at registration, none of these are needed. Ownership checks are done inline at the route level.
**Migration**: Routes using `requireOwner` switch to `requireLogin: true` and add inline `identity.unitId === resource.unitId` checks where needed.

### Requirement: requireAdmin macro

**Reason**: Admin role checks are trivial inline checks (`identity.role === "ADMIN" || identity.role === "ROOT"`) and do not warrant a separate macro. The macro obscured the check and added a full UserDTO resolution as a hidden cost.
**Migration**: Routes using `requireAdmin` switch to `requireLogin: true` with inline role check.

### Requirement: tokenContext type-cast hack removed

**Reason**: Already removed in previous change. No further action.
**Migration**: N/A.

### Requirement: requireAdminSession function removed

**Reason**: Already removed in previous change. No further action.
**Migration**: N/A.
