# identity-claim-consistency Specification

## Purpose

Defines invariants that keep user identity and unit identity distinct across the system. User and unit identifiers, slugs, session claims, route params, and API payloads SHALL not be conflated, and authorization checks SHALL compare actor `userId` against explicit owner identifiers rather than relying on accidental `userId == unitId` equivalence. This spec also requires an audit of existing usages and a migration path for any confirmed misuse.

## Requirements

### Requirement: User identity and unit identity are distinct

The system SHALL treat `userId` and `unitId` as distinct identifiers. Code, contracts, session claims, route params, and API payloads SHALL NOT rely on `userId` being equal to `unitId`.

#### Scenario: Actor identity is required
- **WHEN** a service needs the authenticated actor
- **THEN** it SHALL use `userId` from main session state or main DB lookup
- **AND** it SHALL NOT substitute a content `unitId` as the actor identity

### Requirement: User slug and unit slug are distinct

The system SHALL treat `userSlug` and `unitSlug` as distinct fields with distinct lookup semantics. Routes and components SHALL name slug params according to the entity being addressed.

#### Scenario: User profile route is resolved
- **WHEN** a route resolves a user profile by slug
- **THEN** it SHALL use a `userSlug` lookup
- **AND** it SHALL NOT query the Unit slug namespace unless the route explicitly addresses a unit

### Requirement: Main session claims identify the actor by userId

`rezics-session-token` claims SHALL use `sub` and explicit actor fields to represent `userId`. The token SHALL NOT use `unitId` as the authenticated actor subject.

#### Scenario: Session token is issued
- **WHEN** main issues a `rezics-session-token`
- **THEN** the `sub` claim SHALL equal the authenticated `userId`
- **AND** any `unitId` value, if present for compatibility during migration, SHALL NOT be trusted as the actor identity

### Requirement: User/unit misuse is audited across packages

The implementation SHALL audit existing usages of route variables, props, contracts, token claims, Prisma queries, and service inputs where names or values imply `userId = unitId` or `userSlug = unitSlug`. Each confirmed misuse SHALL be corrected or documented as a deliberate transitional exception.

#### Scenario: Misnamed route parameter is found
- **WHEN** audit finds a route parameter named `userId` that is populated from a unit identifier
- **THEN** the route contract and implementation SHALL be renamed or corrected
- **AND** dependent frontend/API code SHALL use the corrected identifier name

### Requirement: Authorization checks use explicit owner identity

Ownership and permission checks SHALL compare the authenticated actor `userId` against explicit owner user identifiers or permission records. Unit IDs SHALL only be used to identify protected domain resources.

#### Scenario: User updates a unit
- **WHEN** a user requests an update to a unit
- **THEN** the system SHALL load the unit resource by `unitId`
- **AND** it SHALL compare the unit owner user identifier against the authenticated `userId`
