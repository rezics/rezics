## MODIFIED Requirements

### Requirement: Session token carries permission object

`rezicsSessionClaimsSchema` SHALL contain a `permission` field of type `permissionSchema`. The full claims shape SHALL be `{ sub, userId, permission: { role }, iss, exp, iat }`. The schema SHALL NOT contain a top-level `role` claim (only `permission.role`) and SHALL NOT contain a `unitId` claim.

#### Scenario: Session token includes permission object

- **WHEN** the server issues a `rezics-session-token`
- **THEN** the JWT payload contains `permission: { role: "MEMBER" }` (or the user's actual role), not a top-level `role` field
- **AND** the JWT payload SHALL contain `userId`, not `unitId`

### Requirement: Exchange flow derives permission exclusively from server database

The cookie-boundary refresh endpoint (`POST /auth/session/refresh`) SHALL derive `userId` from the validated auth session, query `User.permission` from the server database, and write the result into the issued `rezics-session-token`'s `permission` field. The endpoint SHALL NOT read role information from any auth-issued JWT and SHALL NOT trust any header-supplied role hint.

#### Scenario: Refresh reads permission from server DB

- **WHEN** a client refreshes its session via `POST /auth/session/refresh`
- **THEN** the server reads `User.permission` from the database using `userId` derived from the auth session, constructs `{ role: permission.role[0] ?? "MEMBER" }`, and embeds it as the `permission` claim in the issued token

#### Scenario: External role hint is ignored

- **WHEN** auth's internal session representation reports a role distinct from `User.permission` in the main DB
- **THEN** the issued `rezics-session-token` SHALL reflect `User.permission`, not the external hint

### Requirement: AuthIdentity type is removed

The `AuthIdentity` type SHALL be deleted from `@rezics/contract`. All permission helpers SHALL accept `Permission` for permission checks. Resource-specific helpers that require ownership verification SHALL accept `actorUserId: string` as a separate parameter.

#### Scenario: Permission helper uses Permission type

- **WHEN** calling `isAdmin(permission)`
- **THEN** the function accepts `Permission` (not `AuthIdentity`) and checks `permission.role === "ADMIN"`

#### Scenario: Resource permission helper separates identity from permission

- **WHEN** calling `hasPermissionToUpdateBook(permission, actorUserId, unit)`
- **THEN** the function accepts `Permission` for role checks and `actorUserId: string` for ownership checks as separate parameters
