## ADDED Requirements

### Requirement: Independent auth service boundary
The system SHALL provide a standalone authentication service in `package/auth` implemented with Elysia, Better Auth, and Prisma, and SHALL keep auth modules organized directly under `/src/<module>` names instead of a nested `feature/` directory. The auth service SHALL additionally integrate the `admin` and `organization` plugins from better-auth, extending the API surface with user management and organization management endpoints.

#### Scenario: Auth service starts with independent routing surface
- **WHEN** the auth service boots in development or production
- **THEN** authentication endpoints SHALL be served by `package/auth` without relying on `package/server` auth route handlers

#### Scenario: Auth service exposes admin and organization endpoints
- **WHEN** the auth service boots
- **THEN** `/api/auth/admin/*` and `/api/auth/organization/*` endpoints SHALL be routable alongside existing auth endpoints

### Requirement: Explicit runtime configuration
The auth service SHALL validate environment configuration through t3-env and SHALL explicitly configure Better Auth `baseURL`, `basePath` (`/api/auth`), and `BETTER_AUTH_SECRET`.

#### Scenario: Missing required auth env
- **WHEN** a required auth env value is absent or invalid at startup
- **THEN** the service SHALL fail fast with a validation error and SHALL NOT boot in a partially configured state

### Requirement: Auth database identity schema
The auth service SHALL use Prisma against database `rezics_auth` and SHALL define user identity with exactly one primary key field `id` using DB-generated UUIDv7. The `User` model SHALL additionally include `role` (String, default `"user"`), `banned` (Boolean, default `false`), `banReason` (String, nullable), and `banExpires` (DateTime, nullable) fields required by the admin plugin. The auth schema SHALL also define an optional one-to-one `UserProfile` model keyed by `userId`, with unique `slug` plus nullable `bio` and `avatar` fields for user-facing profile metadata.

#### Scenario: Create user record in auth DB
- **WHEN** a new user is created through auth flows
- **THEN** Prisma SHALL persist a user with `id` generated as UUIDv7 by database default and SHALL set `role` to `"user"` and `banned` to `false` by default

#### Scenario: Create profile record for a user
- **WHEN** a user profile is created or attached to an existing user
- **THEN** Prisma SHALL persist exactly one `UserProfile` row per user keyed by `userId`, SHALL enforce `slug` uniqueness at the profile level, and SHALL allow `bio` and `avatar` to remain null

#### Scenario: Auth DB includes organization tables
- **WHEN** the auth database schema is fully migrated
- **THEN** the database SHALL contain `Organization`, `Member`, and `Invitation` tables with proper foreign key relationships

### Requirement: Internal token surface isolation
The auth service SHALL keep `/api/auth/token` available for same-origin/internal workflows and SHALL enforce explicit security isolation from external/public OAuth attack surface. Isolation is ensured by enforcing HttpOnly sessions and prohibiting external OAuth clients from obtaining session context.

#### Scenario: External/public misuse attempt on internal token surface
- **WHEN** a request violates internal token-surface security policy
- **THEN** the service SHALL deny the request and SHALL return a deterministic authentication/authorization error response
