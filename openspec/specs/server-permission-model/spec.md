# server-permission-model Specification

## Purpose

Defines the main server permission transport shape and its relationship to session-token claims.
## Requirements
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

`rezicsSessionClaimsSchema` SHALL contain a `permission` field of type `permissionSchema`. The full claims shape SHALL be `{ sub, userId, permission: { role }, iss, exp, iat }`. The schema SHALL NOT contain a top-level `role` claim (only `permission.role`) and SHALL NOT contain a `unitId` claim.

#### Scenario: Session token includes permission object

- **WHEN** the server issues a `rezics-session-token`
- **THEN** the JWT payload contains `permission: { role: "MEMBER" }` (or the user's actual role), not a top-level `role` field
- **AND** the JWT payload SHALL contain `userId`, not `unitId`

### Requirement: AuthIdentity type is removed

The `AuthIdentity` type SHALL be deleted from `@rezics/contract`. All permission helpers SHALL accept `Permission` for permission checks. Resource-specific helpers that require ownership verification SHALL accept `actorUserId: string` as a separate parameter.

#### Scenario: Permission helper uses Permission type

- **WHEN** calling `isAdmin(permission)`
- **THEN** the function accepts `Permission` (not `AuthIdentity`) and checks `permission.role === "ADMIN"`

#### Scenario: Resource permission helper separates identity from permission

- **WHEN** calling `hasPermissionToUpdateBook(permission, actorUserId, unit)`
- **THEN** the function accepts `Permission` for role checks and `actorUserId: string` for ownership checks as separate parameters

### Requirement: Exchange flow derives permission exclusively from server database

The cookie-boundary refresh endpoint (`POST /auth/session/refresh`) SHALL derive `userId` from the validated auth session, query `User.permission` from the server database, and write the result into the issued `rezics-session-token`'s `permission` field. The endpoint SHALL NOT read role information from any auth-issued JWT and SHALL NOT trust any header-supplied role hint.

#### Scenario: Refresh reads permission from server DB

- **WHEN** a client refreshes its session via `POST /auth/session/refresh`
- **THEN** the server reads `User.permission` from the database using `userId` derived from the auth session, constructs `{ role: permission.role[0] ?? "MEMBER" }`, and embeds it as the `permission` claim in the issued token

#### Scenario: External role hint is ignored

- **WHEN** auth's internal session representation reports a role distinct from `User.permission` in the main DB
- **THEN** the issued `rezics-session-token` SHALL reflect `User.permission`, not the external hint

### Requirement: Permission remains canonical but policy owns authorization

`Permission` SHALL remain the canonical global role representation, but privileged server authorization SHALL be expressed as policy actions that use `Permission` as one input rather than as the complete authorization model.

#### Scenario: Admin role alone is not sufficient

- **WHEN** an admin attempts an action blocked by a higher-priority account enforcement or resource invariant
- **THEN** the policy SHALL deny the action even though `permission.role` is `ADMIN`

### Requirement: Blocked status derives from enforcement, not a role literal

A user's blocked status SHALL be determined by the account-safety enforcement layer rather than by a distinct `BLOCKED` role literal carrying independent authority. Policy decisions SHALL read active enforcement as the source of truth for whether an account is blocked, so there is a single source of truth for that state. The role enum MAY retain a blocked-derived projection for transport compatibility, but it SHALL NOT be a second authority that can disagree with enforcement.

#### Scenario: Enforcement is the source of truth for blocked status

- **GIVEN** a user has an active ban enforcement record
- **WHEN** the policy evaluates whether the account is blocked
- **THEN** the decision SHALL be derived from the active enforcement
- **AND** SHALL NOT depend on a separate `BLOCKED` role literal disagreeing with enforcement

