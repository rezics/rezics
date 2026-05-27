## ADDED Requirements

### Requirement: Auth admin enforcement integrates with main-server governance

Auth admin ban, unban, session revocation, role change, and impersonation flows SHALL emit or be wrapped by main-server governance audit events when initiated from Rezics staff workflows.

#### Scenario: Session revocation from case decision is linked

- **WHEN** a moderation decision revokes a user's sessions
- **THEN** the auth operation SHALL complete through the auth boundary
- **AND** the moderation case and staff audit log SHALL link to the auth-side action result
