## MODIFIED Requirements

### Requirement: Realm tag curation is governed and audited

Realm tag association creation, removal, and score-sensitive curation SHALL require realm policy authorization and SHALL write realm event/audit records.

#### Scenario: Moderator removes misleading tag

- **WHEN** a moderator removes a realm tag association
- **THEN** the action SHALL be policy-authorized
- **AND** a realm governance event SHALL record actor, target, tag, and reason when provided
