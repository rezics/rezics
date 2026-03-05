## ADDED Requirements

### Requirement: Independent auth service boundary
The system SHALL provide a standalone authentication service in `package/auth` implemented with Elysia, Better Auth, and Prisma, and SHALL keep auth modules organized directly under `/src/<module>` names instead of a nested `feature/` directory.

#### Scenario: Auth service starts with independent routing surface
- **WHEN** the auth service boots in development or production
- **THEN** authentication endpoints SHALL be served by `package/auth` without relying on `package/server` auth route handlers

### Requirement: Explicit runtime configuration
The auth service SHALL validate environment configuration through t3-env and SHALL explicitly configure Better Auth `baseURL`, `basePath` (`/api/auth`), and `BETTER_AUTH_SECRET`.

#### Scenario: Missing required auth env
- **WHEN** a required auth env value is absent or invalid at startup
- **THEN** the service SHALL fail fast with a validation error and SHALL NOT boot in a partially configured state

### Requirement: Auth database identity schema
The auth service SHALL use Prisma against database `rezics_auth` and SHALL define user identity with exactly one primary key field `id` using DB-generated UUIDv7 and a unique `slug` field.

#### Scenario: Create user record in auth DB
- **WHEN** a new user is created through auth flows
- **THEN** Prisma SHALL persist a user with `id` generated as UUIDv7 by database default and SHALL enforce `slug` uniqueness

### Requirement: Internal token surface isolation
The auth service SHALL keep `/api/auth/token` available for same-origin/internal workflows and SHALL enforce explicit security isolation from external/public OAuth attack surface.

#### Scenario: External/public misuse attempt on internal token surface
- **WHEN** a request violates internal token-surface security policy
- **THEN** the service SHALL deny the request and SHALL return a deterministic authentication/authorization error response
