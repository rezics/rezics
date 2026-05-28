## ADDED Requirements

### Requirement: Entity admin participates in content operations

Entity admin index and detail pages SHALL follow the shared admin content operation patterns for filters, table density, authority actions, audit reason capture, and repair links.

#### Scenario: Entity authority action requires reason

- **WHEN** an admin changes verified status or canonical slug
- **THEN** the UI SHALL capture a reason when audit policy requires it
