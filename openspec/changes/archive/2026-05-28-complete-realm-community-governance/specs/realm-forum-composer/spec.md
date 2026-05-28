## MODIFIED Requirements

### Requirement: Realm composer enforces rules and lifecycle

The realm composer SHALL check posting capability, rules acknowledgement, locked/archive state, member state, and account enforcement before submitting.

#### Scenario: Composer blocks unacknowledged rules

- **WHEN** a user who has not accepted required realm rules attempts to submit
- **THEN** the composer SHALL show the rules acknowledgement flow
- **AND** no post mutation SHALL be sent until acknowledgement succeeds
