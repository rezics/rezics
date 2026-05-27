## MODIFIED Requirements

### Requirement: JWT service UI is part of platform security operations

JWT service admin UI SHALL present service health, active keys, rotation status, consumers, safe failure summaries, and audited activate/deactivate/rotate actions.

#### Scenario: Owner rotates JWT service

- **WHEN** an owner rotates a JWT service
- **THEN** the action SHALL require confirmation and SHALL not expose private key material in the browser
