## MODIFIED Requirements

### Requirement: User identity and unit identity are distinct

The system SHALL treat `userId` and `unitId` as distinct identifiers with no implicit equality. The main `User.userId` is the primary key of the `User` table and the sole authenticated actor identifier; it has no FK to `Unit.id`. Code, contracts, session claims, route params, and API payloads SHALL use `userId` for actor references and `unitId` for content references, and SHALL NOT rely on `userId` being equal to `unitId`. The legacy column name `User.unitId` SHALL NOT exist; the primary key column is `User.userId`.

#### Scenario: Actor identity is required
- **WHEN** a service needs the authenticated actor
- **THEN** it SHALL use `userId` from main session state or main DB lookup
- **AND** it SHALL NOT substitute a content `unitId` as the actor identity

#### Scenario: User table primary key is named userId
- **WHEN** any service queries the main `User` table
- **THEN** the lookup field SHALL be `userId`
- **AND** the legacy column name `unitId` on the `User` table SHALL NOT exist

### Requirement: Main session claims identify the actor by userId

`rezics-session-token` claims SHALL use `sub` and an explicit `userId` field to represent the authenticated actor. `sub === userId`. The token SHALL NOT contain a `unitId` claim under any circumstances.

#### Scenario: Session token is issued
- **WHEN** main issues a `rezics-session-token`
- **THEN** the `sub` claim SHALL equal the authenticated `userId`
- **AND** an explicit `userId` claim SHALL also be present and equal to `sub`
- **AND** there SHALL be no `unitId` claim

### Requirement: User/unit misuse is audited across packages

The implementation SHALL audit existing usages of route variables, props, contracts, token claims, Prisma queries, and service inputs where names or values imply `userId = unitId` or `userSlug = unitSlug`. Each confirmed misuse SHALL be corrected in the same change. No transitional exceptions SHALL be retained — the rename is a single cutover.

#### Scenario: Misnamed route parameter is found
- **WHEN** audit finds a route parameter named `unitId` that addresses a user resource
- **THEN** the route contract and implementation SHALL be renamed to `userId`
- **AND** dependent frontend/API code SHALL use the corrected identifier name

#### Scenario: Stray reference to User.unitId is found
- **WHEN** audit finds a Prisma query, mapper, or contract field reading `user.unitId`
- **THEN** it SHALL be renamed to `user.userId`
- **AND** no dual-read or alias shim SHALL be left behind

### Requirement: Authorization checks use explicit owner identity

Ownership and permission checks SHALL compare the authenticated actor `userId` against explicit owner user identifiers or permission records. Unit IDs SHALL only be used to identify protected domain resources.

#### Scenario: User updates a unit
- **WHEN** a user requests an update to a unit
- **THEN** the system SHALL load the unit resource by `unitId`
- **AND** it SHALL compare the unit owner user identifier against the authenticated `userId`
