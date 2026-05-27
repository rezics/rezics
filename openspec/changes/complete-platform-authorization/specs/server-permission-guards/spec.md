## MODIFIED Requirements

### Requirement: Privileged route guards use policy decisions

Server routes that mutate shared content, realm roles, reports, account enforcement, roles, audit-sensitive resources, or operational repair state SHALL call a named policy action before executing the mutation.

#### Scenario: Route records denied privileged action

- **WHEN** a caller fails a privileged policy check
- **THEN** the route SHALL return a consistent authorization error
- **AND** security-sensitive denied attempts SHALL be eligible for audit or abuse-rate tracking
