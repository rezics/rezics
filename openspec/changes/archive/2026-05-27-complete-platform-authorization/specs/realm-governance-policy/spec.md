## ADDED Requirements

### Requirement: Realm policy is scoped to one realm

Realm governance actions SHALL be authorized by a realm-scoped policy that considers global staff role, actor account state, realm membership role, member state, target content state, and target realm id.

#### Scenario: Moderator acts only within their realm

- **GIVEN** a user is moderator of realm A and member of realm B
- **WHEN** they attempt to lock content in realm B
- **THEN** realm policy SHALL deny the action

### Requirement: Realm role hierarchy is explicit

Realm roles SHALL be ordered as owner, admin, moderator, member. Role changes SHALL prevent a user from removing the last owner or escalating themselves beyond policy.

#### Scenario: Last owner cannot be removed

- **WHEN** a realm admin attempts to demote the last owner
- **THEN** the server SHALL reject the request with a safe invariant error

### Requirement: Global staff override is audited

Global staff MAY act in any realm according to site policy, but such actions SHALL create staff audit entries and realm event entries.

#### Scenario: Site admin removes a harmful realm pin

- **WHEN** global staff unpins content in a realm where they are not a member
- **THEN** the action SHALL be allowed only by global policy
- **AND** audit/event records SHALL identify the global override
