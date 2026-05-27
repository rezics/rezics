## ADDED Requirements

### Requirement: Admin account operations unify auth and main user state

The admin panel SHALL show auth user state, main user Unit/profile linkage, global roles, account enforcement, sessions, bans, and reconciliation warnings.

#### Scenario: Auth user missing main profile

- **WHEN** an auth user has no linked main-server user/profile
- **THEN** the admin panel SHALL show a reconciliation warning and available repair action when policy allows

### Requirement: Session and impersonation controls are guarded

Session revocation and impersonation SHALL require policy authorization, reason capture, and staff audit.

#### Scenario: Owner impersonates user

- **WHEN** an owner starts impersonation
- **THEN** the UI SHALL require reason confirmation
- **AND** the resulting audit row SHALL link actor, target, and duration

### Requirement: JWT services participate in security operations

JWT service management SHALL show active keys/services, rotation state, consumers, recent failures, and safe controls for activate/deactivate/rotate.

#### Scenario: Admin reviews JWT service

- **WHEN** an owner opens a JWT service detail page
- **THEN** the page SHALL show safe metadata and rotation controls without exposing private key material
