# macro-permission-guards Specification

## Purpose

Defines the `macro/auth` Elysia plugin in
`package/server/src/middleware/permission.ts`. Owns the single
`requireLogin` macro that verifies the `Authorization` bearer
`rezics-session-token` against the server JWKS and resolves
`identity = { unitId, role }` (role used only as a rejection
hint), returns 401 on missing or invalid tokens, and replaces the
removed `requireOwner` / `requireAdmin` macros with inline route
checks.

## Requirements

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

