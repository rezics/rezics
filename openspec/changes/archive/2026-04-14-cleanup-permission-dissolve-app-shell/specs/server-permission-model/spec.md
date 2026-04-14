## ADDED Requirements

### Requirement: Permission type is the canonical server permission representation

`@rezics/contract` SHALL export a `Permission` type and `permissionSchema` (Typebox) representing the main server's permission model. The shape SHALL be `{ role: TokenPermissionRole }`. This type represents permissions stored in the server database (`User.permission`) and embedded in `rezics-session-token` claims.

#### Scenario: Permission schema matches DB shape

- **WHEN** a developer imports `Permission` from `@rezics/contract`
- **THEN** the type is `{ role: TokenPermissionRole }` matching the `User.permission` JSON structure in the server database

### Requirement: TokenPermissionRole includes MEMBER

`tokenPermissionRoleSchema` SHALL include `MEMBER` as a valid value alongside `ROOT`, `ADMIN`, `USER`, and `BLOCKED`. `MEMBER` is the default role assigned when `User.permission` is null or has no role array.

#### Scenario: Default permission resolves to MEMBER

- **WHEN** a user has `permission: null` in the database
- **THEN** the session exchange produces `permission: { role: "MEMBER" }`

### Requirement: Session token carries permission object

`rezicsSessionClaimsSchema` SHALL contain a `permission` field of type `permissionSchema` instead of the current `role: string` field. The full claims shape SHALL be `{ sub, unitId, permission: { role }, iss, exp, iat }`.

#### Scenario: Session token includes permission object

- **WHEN** the server issues a `rezics-session-token`
- **THEN** the JWT payload contains `permission: { role: "MEMBER" }` (or the user's actual role), not a top-level `role` field

### Requirement: AuthIdentity type is removed

The `AuthIdentity` type (`{ unitId: string; role: string }`) SHALL be deleted from `@rezics/contract`. All permission helpers SHALL accept `Permission` for permission checks. Resource-specific helpers that require ownership verification SHALL accept `actorUnitId: string` as a separate parameter.

#### Scenario: Permission helper uses Permission type

- **WHEN** calling `isAdmin(permission)`
- **THEN** the function accepts `Permission` (not `AuthIdentity`) and checks `permission.role === "ADMIN"`

#### Scenario: Resource permission helper separates identity from permission

- **WHEN** calling `hasPermissionToUpdateBook(permission, actorUnitId, unit)`
- **THEN** the function accepts `Permission` for role checks and `actorUnitId: string` for ownership checks as separate parameters

### Requirement: Exchange flow derives permission exclusively from server database

The `POST /session/exchange` endpoint SHALL extract `unitId` from the `auth-identity-token`, query `User.permission` from the server database, and write the result into the session token's `permission` field. The endpoint SHALL NOT read or use the `auth-identity-token`'s `role` field.

#### Scenario: Exchange reads permission from server DB

- **WHEN** a client exchanges an `auth-identity-token` for a `rezics-session-token`
- **THEN** the server reads `User.permission` from the database using the token's `unitId`, constructs `{ role: permission.role[0] ?? "MEMBER" }`, and embeds it as the `permission` claim in the session token

#### Scenario: Auth token role is ignored during exchange

- **WHEN** an `auth-identity-token` has `role: "admin"` but the server database has `User.permission: null`
- **THEN** the issued session token contains `permission: { role: "MEMBER" }` — the auth token's role has no effect
