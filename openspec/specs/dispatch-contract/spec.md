## ADDED Requirements

### Requirement: Dispatch type enum defined in contract

The `@rezics/contract` package SHALL export a `DispatchType` const enum with values `rezics:book`, `rezics:game`, and `rezics:media`. The enum SHALL be defined using Typebox literals for runtime validation.

#### Scenario: Dispatch type is validated at runtime

- **WHEN** a result payload is received with a `type` field
- **THEN** the value is validated against the `DispatchType` union schema, rejecting any value not in the enum

### Requirement: Dispatch result envelope schema defined in contract

The `@rezics/contract` package SHALL export a `dispatchResultSchema` Typebox schema for the result envelope:
- `taskId: string` — the dispatch task identifier
- `project: string` — the project identifier (e.g., "rezics")
- `type: DispatchType` — the dispatch type discriminant
- `unitId?: string` — present for updates, absent for creates
- `data: object` — partial entity data, validated per type on the server

#### Scenario: Result envelope validates required fields

- **WHEN** a result payload is missing `taskId`, `project`, or `type`
- **THEN** validation fails with a descriptive error

#### Scenario: Result envelope allows optional unitId

- **WHEN** a result payload omits `unitId`
- **THEN** validation passes (this indicates a create operation)

### Requirement: Dispatch scope permissions defined in contract

The `@rezics/contract` package SHALL export constants for the dispatch scope domain and its permissions:
- Domain: `"dispatch"`
- Permissions: `"rezics-server-session"`, `"unit:update"`, `"unit:create"`

These SHALL be usable with the existing `hasScope(scopes, domain, permission)` pattern.

#### Scenario: Scope constants match server enforcement

- **WHEN** an API token is created with `{ dispatch: ["rezics-server-session", "unit:update"] }`
- **THEN** the scope values match the constants exported by the contract, ensuring type-safe scope checks
