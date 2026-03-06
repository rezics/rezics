## MODIFIED Requirements

### Requirement: Independent auth service boundary
The system SHALL provide a standalone authentication service in `package/auth` implemented with Elysia, Better Auth, and Prisma, and SHALL keep auth modules organized directly under `/src/<module>` names instead of a nested `feature/` directory. The auth service SHALL additionally integrate the `admin` and `organization` plugins from better-auth, extending the API surface with user management and organization management endpoints.

#### Scenario: Auth service starts with independent routing surface
- **WHEN** the auth service boots in development or production
- **THEN** authentication endpoints SHALL be served by `package/auth` without relying on `package/server` auth route handlers

#### Scenario: Auth service exposes admin and organization endpoints
- **WHEN** the auth service boots
- **THEN** `/api/auth/admin/*` and `/api/auth/organization/*` endpoints SHALL be routable alongside existing auth endpoints

### Requirement: Auth database identity schema
The auth service SHALL use Prisma against database `rezics_auth` and SHALL define user identity with exactly one primary key field `id` using DB-generated UUIDv7 and a unique `slug` field. The `User` model SHALL additionally include `role` (String, default `"user"`), `banned` (Boolean, default `false`), `banReason` (String, nullable), and `banExpires` (DateTime, nullable) fields required by the admin plugin.

#### Scenario: Create user record in auth DB
- **WHEN** a new user is created through auth flows
- **THEN** Prisma SHALL persist a user with `id` generated as UUIDv7 by database default, SHALL enforce `slug` uniqueness, and SHALL set `role` to `"user"` and `banned` to `false` by default

#### Scenario: Auth DB includes organization tables
- **WHEN** the auth database schema is fully migrated
- **THEN** the database SHALL contain `Organization`, `Member`, and `Invitation` tables with proper foreign key relationships
