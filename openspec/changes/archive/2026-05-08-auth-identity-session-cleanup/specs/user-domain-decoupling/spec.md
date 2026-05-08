## ADDED Requirements

### Requirement: User table primary key is `userId`

The main `User` table's primary key SHALL be named `userId` (not `unitId`). The `User` row SHALL NOT participate in any FK relationship to `Unit.id` and SHALL NOT be modeled as a `Unit` subtype. User identity is first-class and independent of Unit identity.

#### Scenario: Schema inspection confirms userId primary key

- **WHEN** the Prisma schema for `User` is inspected
- **THEN** the model declares `userId String @id` (not `unitId String @id`)
- **AND** there is no FK from `User.userId` to `Unit.id`

#### Scenario: All tables that reference User point at userId

- **WHEN** any FK on a table references the `User` primary key (`Unit.userId`, `WorkLinkClaim.claimerUserId`, `WorkLinkClaim.resolvedBy`, `UserUnitProgress.userId`, `Follow.followerId`, `Follow.followingId`, `ApiToken.userId`, etc.)
- **THEN** the `references: [...]` target SHALL be `User.userId`

### Requirement: User DTOs expose `userId`, never `unitId`

Every shared user-shaped DTO (`User`, `UserBrief`, `UserSummary`, profile responses) in `@rezics/contract` SHALL expose the field as `userId`. No user-shaped contract SHALL expose `unitId` as a user identifier. Frontend and admin packages SHALL read `user.userId` everywhere they previously read `user.unitId`.

#### Scenario: Contract user DTOs use userId

- **WHEN** a consumer imports a user-shaped schema from `@rezics/contract`
- **THEN** the schema SHALL declare `userId: string`
- **AND** there SHALL be no `unitId` field on user-shaped DTOs

#### Scenario: Frontend reads userId

- **WHEN** any frontend component renders a user object
- **THEN** it SHALL read `user.userId`
- **AND** it SHALL NOT read `user.unitId`

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
