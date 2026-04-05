## MODIFIED Requirements

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
