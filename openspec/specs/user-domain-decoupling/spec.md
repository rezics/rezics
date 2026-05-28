# user-domain-decoupling Specification

## Purpose

Defines the boundary between platform identity and content
attribution. Owns the rule that `User.type` collapses to `USER`
(or is removed), the removal of book-specific
`authorBook` / `pressBook` / `producerBook` relations in favor of
`Person` / `Organization` plus `PersonCredit` / `OrgCredit`, the
stable `User.unitId` actor identifier used by all
`userId`-typed FKs, and the absence of an `accountStatus` column
or DTO field — readiness is conveyed by `slug !== null`.

## Requirements

### Requirement: User type field simplified to platform identity only

The User model's `type` field SHALL either contain only the value `USER` or be removed entirely from the schema. The User model SHALL NOT carry any attribution-related type distinctions. A User represents a platform identity — someone who has a REZICS account, can log in, create content, and interact with the platform.

#### Scenario: Existing AUTHOR user migrated to USER

- **WHEN** inspecting a User record that previously had `type = AUTHOR`
- **THEN** the User's `type` SHALL be `USER` (or the `type` field SHALL not exist)
- AND the user's authorship credits SHALL be represented as `PersonCredit` records on the relevant units

#### Scenario: Existing PRESS user migrated to USER

- **WHEN** inspecting a User record that previously had `type = PRESS`
- **THEN** the User's `type` SHALL be `USER` (or the `type` field SHALL not exist)
- AND the user's publisher credits SHALL be represented as `OrgCredit` records on the relevant units

#### Scenario: Existing PRODUCER user migrated to USER

- **WHEN** inspecting a User record that previously had `type = PRODUCER`
- **THEN** the User's `type` SHALL be `USER` (or the `type` field SHALL not exist)
- AND the user's production credits SHALL be represented as `PersonCredit` or `OrgCredit` records on the relevant units

#### Scenario: New user creation has no attribution type

- **WHEN** a new User record is created via lazy provisioning
- **THEN** the User SHALL have `type = USER` (or no `type` field)
- AND no attribution-related fields SHALL be set on the User record

### Requirement: User model has no book-specific relations

The User model SHALL NOT contain `authorBook`, `pressBook`, `producerBook`, or any other content-type-specific attribution relations. The User model's relations SHALL be limited to platform concerns: owned Units through explicit owner user identifiers, follows, reactions, API tokens, and similar platform-level associations.

#### Scenario: User schema has no book attribution relations

- **WHEN** inspecting the User model in the Prisma schema
- **THEN** it SHALL NOT contain relations named `authorBook`, `pressBook`, or `producerBook`
- AND no implicit M2M junction tables (`_BookAuthor`, `_BookPress`, `_BookProducer`) SHALL exist in the schema

#### Scenario: User still owns units via explicit owner user identifier

- **WHEN** a User creates a Unit (book, post, shelf, etc.)
- **THEN** the Unit's owner field SHALL reference the creating User's `userId`
- AND the User's ownership relation SHALL include all units whose owner user identifier matches

#### Scenario: User profile does not expose attribution roles

- **WHEN** a client fetches a User profile via the User API
- **THEN** the response SHALL NOT include `authorBook`, `pressBook`, or `producerBook` arrays
- AND attribution information for content the user is credited on SHALL be retrievable through the PersonCredit/OrgCredit query path, not through the User model

### Requirement: User relationship with Unit preserved for ownership tracking

The User model SHALL have a stable actor identifier exposed as `User.unitId` (the unified Unit identity established by this change). The Unit owner field SHALL reference the creating User's `unitId` for ownership and authorization checks. Where related tables retain a column named `userId` (for example, `Unit.userId`, `WorkLinkClaim.claimerUserId`), the column SHALL reference `User.unitId` as its FK target.

#### Scenario: User has stable actor id

- **WHEN** inspecting the User model and its related Unit records
- **THEN** the User SHALL expose `unitId` as its stable identifier for authentication and authorization
- **AND** the User row SHALL share that id with the matching `Unit` row where `type = USER`

#### Scenario: Content ownership queries use the user's unitId

- **WHEN** the system checks whether a user owns a specific Unit
- **THEN** it SHALL compare the Unit owner identifier (typically a column named `userId`) against the authenticated actor's `unitId`
- **AND** this check SHALL resolve correctly because `User.unitId` is the FK target

### Requirement: User has no `accountStatus` column or DTO field

The `User` table SHALL NOT carry an `accountStatus` column, and no user-shaped DTO SHALL expose an `accountStatus` field. The `UserAccountStatus` enum SHALL NOT exist in the Prisma schema or in `@rezics/contract`. Member readiness is conveyed by `slug !== null`, as defined under `main-owned-account-registration`.

#### Scenario: Schema has no accountStatus column

- **WHEN** the Prisma schema for `User` is inspected
- **THEN** there is no `accountStatus` field
- **AND** there is no `UserAccountStatus` enum in the schema

#### Scenario: Contract has no accountStatus field

- **WHEN** any user-shaped contract is inspected
- **THEN** there is no `accountStatus` field
- **AND** consumers SHALL derive readiness from `slug !== null`
