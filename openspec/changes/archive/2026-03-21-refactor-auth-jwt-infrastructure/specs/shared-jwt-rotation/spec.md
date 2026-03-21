## ADDED Requirements

### Requirement: Shared JWT package provides storage-agnostic rotation contracts
The system SHALL provide a shared package at `package/jwt` that defines explicit type contracts for JWT rotation, signing-key lifecycle, JWKS publication, and verification without importing Prisma or any database client.

#### Scenario: Service composes rotation with injected persistence
- **WHEN** `package/auth` or `package/server` integrates the shared JWT package
- **THEN** the service SHALL provide persistence functions or adapters whose parameters and return values are typed by `package/jwt`

### Requirement: Shared JWT package enforces rotation defaults
The shared JWT package SHALL provide rotation configuration defaults of `rotation_interval = 90 days`, `check_interval = 60 seconds`, and `grace_period = token_ttl * 2`, while allowing explicit overrides for tests or service-specific tuning.

#### Scenario: Service uses default rotation settings
- **WHEN** a service creates a rotation engine without overriding defaults
- **THEN** the engine SHALL schedule rotation and key-retention behavior using the default intervals and grace-period formula

### Requirement: Rotation engine owns key lifecycle orchestration
The shared JWT package SHALL expose a rotation engine that determines the active signing key, schedules rotation, retains grace-period keys for verification, and serializes public JWKS documents without assuming a specific storage implementation.

#### Scenario: Rotation interval has elapsed
- **WHEN** the engine detects that the active key has exceeded the configured rotation interval
- **THEN** it SHALL create a new active signing key, mark the previous key as retiring, and continue publishing the previous public key until its grace period expires

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
