## RENAMED Requirements

### Requirement: RealmUnit is the single source of truth for post-realm membership

FROM: `RealmUnit is the single source of truth for post-realm membership`

TO: `UnitRealm is the single source of truth for post-realm membership`

## ADDED Requirements

### Requirement: UnitRealm Replaces RealmUnit Naming

The realm membership relationship SHALL be named `UnitRealm` in schema, server
code, contract DTOs, API parameters, frontend query keys, and documentation.
The relationship semantics remain the same: it represents Unit membership in a
realm feed/community and does not represent semantic tagging.

#### Scenario: Schema uses UnitRealm

- **WHEN** the Prisma schema is inspected after the migration
- **THEN** the realm membership model SHALL be named `UnitRealm`
- **AND** no model named `RealmUnit` SHALL remain

#### Scenario: API uses unitRealm naming

- **WHEN** a developer reads realm feed or cross-posting API contracts
- **THEN** parameter and DTO names SHALL use `unitRealm` / `unitRealms` terminology where the relationship is named
- **AND** behavior SHALL remain equivalent to the previous `RealmUnit` relationship

#### Scenario: No behavior change from rename

- **GIVEN** a post belongs to realm `realm-a` through the renamed relationship
- **WHEN** the realm feed is queried
- **THEN** the post SHALL appear exactly as it did before the rename
