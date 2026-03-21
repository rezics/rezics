## ADDED Requirements

### Requirement: Independent auth service boundary
The system SHALL provide a standalone authentication service in `package/auth` where Better Auth owns session handling, JWT and JWKS concerns are modularized under session ownership, and downstream services depend on published contracts and public endpoints rather than auth-internal verification helpers.

#### Scenario: Auth service boots with session-owned JWT modules
- **WHEN** the auth service boots in development or production
- **THEN** session handling SHALL be owned by Better Auth while JWT/JWKS route ownership and adapter composition remain isolated inside `package/auth`

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
The auth service SHALL keep internal or same-origin session token surfaces isolated from external/public OAuth surfaces, SHALL make JWKS verification endpoints publicly reachable where required, and SHALL avoid exposing legacy verify-only compatibility paths.

#### Scenario: Public verifier requests JWKS while internal session routes stay protected
- **WHEN** a public verifier fetches JWKS and an unrelated caller requests a protected session-only route
- **THEN** the JWKS request SHALL succeed without session credentials and the protected route SHALL continue enforcing its intended auth boundary

### Requirement: Auth service exposes one auth-owned signing surface
The auth service SHALL issue all of its JWT token types from one active private signing key and SHALL publish one auth-owned JWKS surface that covers all retained public keys needed to verify auth-issued tokens.

#### Scenario: Auth issues identity and context tokens
- **WHEN** the auth service issues both identity and context JWTs
- **THEN** both JWTs SHALL be signed by the same active auth-private key and SHALL be verifiable from the same auth JWKS document

### Requirement: Services persist JWT service metadata locally
Each service SHALL persist JWT service metadata for itself and trusted peer issuers in its own database, including issuer, audience, and canonical JWKS location, rather than treating those values as ad hoc runtime-only configuration.

#### Scenario: Auth service stores its local JWT metadata
- **WHEN** the auth service starts after migrations or bootstrap
- **THEN** it SHALL have a local persisted record describing its own issuer, audience, and canonical session-owned JWKS endpoint

#### Scenario: Resource server stores trusted auth metadata
- **WHEN** `package/server` verifies auth-issued JWTs offline
- **THEN** it SHALL load the trusted auth issuer, audience, and JWKS location from its local persisted JWT service metadata rather than auth-owned helper code
