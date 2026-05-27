## MODIFIED Requirements

### Requirement: Permission remains canonical but policy owns authorization

`Permission` SHALL remain the canonical global role representation, but privileged server authorization SHALL be expressed as policy actions that use `Permission` as one input rather than as the complete authorization model.

#### Scenario: Admin role alone is not sufficient

- **WHEN** an admin attempts an action blocked by a higher-priority account enforcement or resource invariant
- **THEN** the policy SHALL deny the action even though `permission.role` is `ADMIN`
