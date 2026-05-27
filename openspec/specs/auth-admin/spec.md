# auth-admin Specification

## Purpose

Defines auth-service administrative user management, role, ban, session, impersonation, and JWT identity behavior.
## Requirements
### Requirement: Admin plugin integration
The auth service SHALL integrate the better-auth `admin` plugin in `src/auth/instance.ts`, enabling administrative user management endpoints under `/api/auth/admin/*`.

#### Scenario: Admin plugin is loaded at boot
- **WHEN** the auth service starts
- **THEN** the admin plugin SHALL be active and all `/api/auth/admin/*` endpoints SHALL be routable

### Requirement: Global role system
The auth service SHALL define three global roles: `owner`, `admin`, `user`. The default role for new users SHALL be `user`. Roles SHALL be stored in the `role` field on the `User` model.

#### Scenario: New user gets default role
- **WHEN** a new user registers through any auth flow (email/password, OAuth)
- **THEN** the user record SHALL have `role` set to `"user"`

#### Scenario: Admin sets a user's role
- **WHEN** an authenticated admin calls `POST /api/auth/admin/set-role` with a valid `userId` and `role`
- **THEN** the target user's `role` SHALL be updated to the specified value

### Requirement: Access control model

The auth service SHALL define a GitHub-inspired access control model using better-auth's `ac` (access control) with the following resource permissions:

- `user`: `list`, `get`, `create`, `update`, `delete`, `ban`, `set-role`, `impersonate`
- `organization`: `create`, `update`, `delete`
- `member`: `invite`, `remove`, `update-role`
- `invitation`: `cancel`
- `jwt-service`: `list`, `get`, `create`, `update`, `activate`, `deactivate`

The `owner` role SHALL have all permissions including all `jwt-service` permissions. The `admin` role SHALL have all permissions except `impersonate` on other admin/owner users and SHALL NOT have any `jwt-service` permissions. The `user` role SHALL only have `organization:create`.

#### Scenario: Owner lists JWT services
- **WHEN** an authenticated user with role `owner` calls `GET /api/auth/admin/jwt-services`
- **THEN** the system SHALL allow the request

#### Scenario: Admin cannot access JWT services
- **WHEN** an authenticated user with role `admin` calls `GET /api/auth/admin/jwt-services`
- **THEN** the system SHALL deny the request with a 403 Forbidden response

#### Scenario: Admin lists all users
- **WHEN** an authenticated user with role `admin` or `owner` calls `GET /api/auth/admin/list-users`
- **THEN** the system SHALL return a paginated list of all users

#### Scenario: Regular user cannot list users
- **WHEN** an authenticated user with role `user` calls `GET /api/auth/admin/list-users`
- **THEN** the system SHALL deny the request with a 403 Forbidden response

### Requirement: User CRUD via admin API
The admin plugin SHALL expose endpoints for creating, reading, updating, and removing users. Only users with `admin` or `owner` role SHALL be authorized to call these endpoints.

#### Scenario: Admin creates a new user
- **WHEN** an admin calls `POST /api/auth/admin/create-user` with email, password, and name
- **THEN** a new user SHALL be created with the specified details and default role `user`

#### Scenario: Admin updates a user
- **WHEN** an admin calls `POST /api/auth/admin/update-user` with a userId and data
- **THEN** the specified user's fields SHALL be updated

#### Scenario: Admin removes a user
- **WHEN** an admin calls `POST /api/auth/admin/remove-user` with a userId
- **THEN** the user SHALL be hard-deleted from the database

### Requirement: Ban and unban users
The admin plugin SHALL allow admins to ban users (preventing sign-in and revoking sessions) and unban them.

#### Scenario: Admin bans a user
- **WHEN** an admin calls `POST /api/auth/admin/ban-user` with a userId
- **THEN** the user's `banned` field SHALL be set to `true`, all active sessions SHALL be revoked, and subsequent sign-in attempts SHALL be denied

#### Scenario: Admin unbans a user
- **WHEN** an admin calls `POST /api/auth/admin/unban-user` with a userId
- **THEN** the user's `banned` field SHALL be set to `false` and the user SHALL be able to sign in again

#### Scenario: Ban with expiration
- **WHEN** an admin bans a user with a `banExpiresIn` value (seconds)
- **THEN** the ban SHALL automatically expire after the specified duration

### Requirement: Session management via admin API
The admin plugin SHALL allow admins to list, revoke individual, and revoke all sessions for any user.

#### Scenario: Admin lists a user's sessions
- **WHEN** an admin calls `POST /api/auth/admin/list-user-sessions` with a userId
- **THEN** the system SHALL return all active sessions for that user

#### Scenario: Admin revokes all sessions for a user
- **WHEN** an admin calls `POST /api/auth/admin/revoke-user-sessions` with a userId
- **THEN** all sessions for that user SHALL be invalidated

### Requirement: User impersonation
The admin plugin SHALL allow admins to impersonate users for debugging purposes. Admins SHALL NOT be able to impersonate other admin or owner users by default.

#### Scenario: Admin impersonates a regular user
- **WHEN** an admin calls `POST /api/auth/admin/impersonate-user` with the userId of a `user`-role account
- **THEN** a new session SHALL be created that acts as the target user

#### Scenario: Admin cannot impersonate another admin
- **WHEN** an admin calls `POST /api/auth/admin/impersonate-user` with the userId of an `admin`-role account
- **THEN** the request SHALL be denied

### Requirement: Admin schema fields on User model
The `User` model in `prisma/schema.prisma` SHALL include the following fields: `role` (String, default `"user"`), `banned` (Boolean, default `false`), `banReason` (String, nullable), `banExpires` (DateTime, nullable).

#### Scenario: Existing users gain default role after migration
- **WHEN** the Prisma migration is applied to a database with existing user records
- **THEN** all existing users SHALL have `role` set to `"user"` and `banned` set to `false`

### Requirement: First admin bootstrapping
The first admin user SHALL be created by registering through the normal sign-up flow and then manually setting `role = 'admin'` via a direct SQL update. This process SHALL be documented in `package/auth/README.md`.

#### Scenario: Bootstrap first admin
- **WHEN** a platform operator follows the README instructions
- **THEN** they SHALL be able to promote a registered user to admin via SQL and subsequently use the admin API

### Requirement: JWT payload exposes frontend auth identity
The JWT plugin configuration in `src/auth/instance.ts` SHALL include `id`, optional `slug`, and optional `role` in `definePayload()` so frontend auth state can be derived directly from the token.

#### Scenario: JWT contains role-aware identity claims
- **WHEN** a JWT is issued for a user with any role (user, admin, owner)
- **THEN** the JWT payload SHALL contain `id`
- **AND** it SHALL include `slug` when the user profile has one
- **AND** it SHALL include `role` when the user record has one

### Requirement: Auth admin enforcement integrates with main-server governance

Auth admin ban, unban, session revocation, role change, and impersonation flows SHALL emit or be wrapped by main-server governance audit events when initiated from Rezics staff workflows.

#### Scenario: Session revocation from case decision is linked

- **WHEN** a moderation decision revokes a user's sessions
- **THEN** the auth operation SHALL complete through the auth boundary
- **AND** the moderation case and staff audit log SHALL link to the auth-side action result

