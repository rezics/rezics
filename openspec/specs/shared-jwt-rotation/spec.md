# shared-jwt-rotation Specification

## Purpose

Defines the `package/jwt` shared package contract: storage-agnostic
type definitions for key rotation (scoped by `jwtServiceId`), the
default rotation/check/grace-period intervals, the rotation engine
that orchestrates active-key selection and JWKS publication, the
jose-based verification helpers (with explicit configuration, no
env reads), and the framework-adapter separation that keeps Elysia /
Better Auth integration out of the core rotation logic.

## Requirements

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

### Requirement: Shared JWT package enforces rotation defaults
The shared JWT package SHALL provide rotation configuration defaults of `rotation_interval = 90 days`, `check_interval = 60 seconds`, and `grace_period = token_ttl * 2`, while allowing explicit overrides for tests or service-specific tuning.

#### Scenario: Service uses default rotation settings
- **WHEN** a service creates a rotation engine without overriding defaults
- **THEN** the engine SHALL schedule rotation and key-retention behavior using the default intervals and grace-period formula

### Requirement: Rotation engine owns key lifecycle orchestration
The shared JWT package SHALL expose a rotation engine that determines the active signing key,
schedules rotation, retains grace-period keys for verification, and serializes public JWKS
documents without assuming a specific storage implementation. The rotation engine SHALL
receive only a `jwtServiceId` (or equivalent persistence scope) for key operations - it
SHALL NOT receive or depend on issuer, audience, or other service metadata.

#### Scenario: Rotation interval has elapsed
- **WHEN** the engine detects that the active key has exceeded the configured rotation interval
- **THEN** it SHALL create a new active signing key, mark the previous key as retiring, and
  continue publishing the previous public key until its grace period expires

#### Scenario: Rotation engine does not resolve metadata
- **WHEN** a signing or verification path needs issuer and audience values
- **THEN** the caller SHALL resolve metadata independently via `getJwtService(serviceKey)`;
  the rotation engine SHALL NOT provide or cache metadata values

### Requirement: Shared verification helpers remain env-free and jose-based
The shared JWT package SHALL expose jose-based verification helpers that validate `alg`, `kid`, `iss`, `aud`, `exp`, and `nbf`, support remote JWKS refresh on unknown `kid`, and require callers to provide all runtime configuration explicitly.

#### Scenario: Service verifies a remote token
- **WHEN** a service creates a verifier from the shared package
- **THEN** verification SHALL succeed or fail based only on the provided issuer, audience, transport, and JWKS inputs rather than hidden env access

### Requirement: Framework adapters stay outside core rotation logic
The shared JWT package SHALL separate framework adapters from core rotation logic so Elysia or Better Auth integration can be added without leaking framework-specific APIs into the core contracts and engine modules.

#### Scenario: Elysia server consumes shared JWT abstractions
- **WHEN** an Elysia-based service wires `@elysiajs/jwt` to the shared package
- **THEN** the service SHALL depend on adapter-facing helpers while the rotation engine and persistence contracts remain framework-agnostic
