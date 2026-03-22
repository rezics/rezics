## MODIFIED Requirements

### Requirement: Rotation engine owns key lifecycle orchestration
The shared JWT package SHALL expose a rotation engine that determines the active signing key,
schedules rotation, retains grace-period keys for verification, and serializes public JWKS
documents without assuming a specific storage implementation. The rotation engine SHALL
receive only a `jwtServiceId` (or equivalent persistence scope) for key operations — it
SHALL NOT receive or depend on issuer, audience, or other service metadata.

#### Scenario: Rotation interval has elapsed
- **WHEN** the engine detects that the active key has exceeded the configured rotation interval
- **THEN** it SHALL create a new active signing key, mark the previous key as retiring, and
  continue publishing the previous public key until its grace period expires

#### Scenario: Rotation engine does not resolve metadata
- **WHEN** a signing or verification path needs issuer and audience values
- **THEN** the caller SHALL resolve metadata independently via `getJwtService(serviceKey)`;
  the rotation engine SHALL NOT provide or cache metadata values

### Requirement: Shared JWT package provides storage-agnostic rotation contracts
The system SHALL provide a shared package at `package/jwt` that defines explicit type
contracts for JWT rotation, signing-key lifecycle, JWKS publication, and verification
without importing Prisma or any database client. The persistence interface SHALL accept
a service scope identifier (e.g., `jwtServiceId`) rather than an issuer string for
key filtering.

#### Scenario: Service composes rotation with injected persistence
- **WHEN** `package/server` integrates the shared JWT package
- **THEN** the service SHALL provide persistence functions scoped by `jwtServiceId` whose
  parameters and return values are typed by `package/jwt`
