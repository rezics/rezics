## REMOVED Requirements

### Requirement: UserType enum values AUTHOR, PRESS, PRODUCER

**Reason**: The `UserType` enum values `AUTHOR`, `PRESS`, and `PRODUCER` conflate platform identity with content attribution. An author does not need a REZICS account to be credited on a book. A publisher credited on a book is not a platform user. Attribution is now handled by the independent `Person`/`Organization` entities with `PersonCredit`/`OrgCredit` junction tables using flexible `roleKey` strings.

**Migration**: The `UserType` enum is reduced to contain only `USER` (or removed entirely if the enum becomes single-valued). Existing users with `type = AUTHOR`, `PRESS`, or `PRODUCER` are migrated to `type = USER`. Their attribution data is migrated to `Person`/`Organization` records with corresponding `PersonCredit`/`OrgCredit` entries preserving the original role information.

### Requirement: User.authorBook, User.pressBook, User.producerBook relations

**Reason**: The M2M relations `authorBook`, `pressBook`, and `producerBook` on the User model tied book attribution directly to platform accounts. This prevented crediting non-users (deceased authors, foreign publishers) and conflated the concepts of "platform account" and "credited contributor." Attribution is now decoupled via `Person` + `PersonCredit` and `Organization` + `OrgCredit` tables with flexible `roleKey` values (`author`, `translator`, `illustrator`, `publisher`, `developer`, etc.).

**Migration**: For each existing `authorBook` relation, create a `Person` record (if the user does not already have a corresponding Person) and a `PersonCredit` with `roleKey = "author"`. For each `pressBook` relation, create an `Organization` record and an `OrgCredit` with `roleKey = "publisher"`. For each `producerBook` relation, create a `Person` or `Organization` record (based on context) and a credit with `roleKey = "producer"`. The M2M junction tables (`_BookAuthor`, `_BookPress`, `_BookProducer`) are dropped after migration.

## ADDED Requirements

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

The User model SHALL have a stable actor `userId` that is distinct from any associated Unit identifier. The Unit owner field SHALL reference the creating User's `userId` for ownership and authorization checks. Any profile or identity Unit associated with a User SHALL be modeled as a related domain Unit and SHALL NOT be treated as the user's primary actor identifier.

#### Scenario: User has distinct actor id

- **WHEN** inspecting the User model and its related Unit records
- **THEN** the User SHALL expose a stable `userId` for authentication and authorization
- AND any related `unitId` SHALL remain a separate domain resource identifier

#### Scenario: Content ownership queries use explicit userId

- **WHEN** the system checks whether a user owns a specific Unit
- **THEN** it SHALL compare the Unit owner user identifier against the authenticated actor `userId`
- AND this check SHALL NOT assume the actor `userId` equals the Unit's own `id`

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
