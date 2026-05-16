# account-identity-boundary Specification

## Purpose

Defines ownership and synchronization rules for auth login email, main email, canonical slug, auth slug login alias, auth technical name, and main display name. The auth service owns login credentials and login identifiers; the main server owns Rezics product identity (display name, canonical slug, product email). Auth-side slug/name fields exist only as one-way projections from main and SHALL NOT be treated as product authority.

## Requirements

### Requirement: Auth login email and main email have separate ownership
The system SHALL treat `auth.User.email` as the auth login email and `server.User.email` as the main-owned Rezics product email. The two fields MAY be initialized to the same value during account materialization, but they SHALL NOT be automatically synchronized after that point.

#### Scenario: Main email is initialized from verified auth login email
- **WHEN** auth returns verified registration facts for a new registrant
- **THEN** main MAY initialize `server.User.email` from the verified auth login email
- **AND** main SHALL record the email as main-owned product data

#### Scenario: Auth login email changes later
- **WHEN** the auth login email changes after a main user exists
- **THEN** main SHALL NOT automatically update `server.User.email`
- **AND** any main email change SHALL use the main email verification contract flow

#### Scenario: Main email changes later
- **WHEN** the user changes the Rezics product email in main settings
- **THEN** auth SHALL NOT automatically change the login email
- **AND** login, recovery, and provider linking SHALL continue using auth-owned email state

### Requirement: Main owns product display name
The system SHALL treat `server.User.name` as the Rezics product display name. Auth-side `User.name`, if required by better-auth, SHALL be a technical auth label and SHALL NOT be rendered as the product display name.

#### Scenario: Auth requires a user name
- **WHEN** auth must persist a `User.name` value for a Rezics user
- **THEN** the value SHALL be populated from the canonical main slug or another documented technical label
- **AND** product UI SHALL render `server.User.name`, not `auth.User.name`

#### Scenario: User changes display name
- **WHEN** a user changes their Rezics display name
- **THEN** main SHALL update `server.User.name`
- **AND** auth SHALL NOT treat that display name as an auth profile authority

### Requirement: Main slug is canonical and auth slug is a login alias projection

The system SHALL treat the Rezics canonical slug as `Unit.slug` on the USER Unit (with `slugScope = <user-scope-unit-id>`), not `server.User.slug` (the `User.slug` column was removed by this change). Auth MAY store the slug as a login alias or technical name, but that auth-side value SHALL be a one-way projection from the canonical Unit slug. User slugs are immutable in v1 (see "User slugs are immutable in v1").

#### Scenario: User completes profile setup with slug

- **WHEN** main accepts a new canonical slug during profile setup
- **THEN** main SHALL persist `Unit.slug` on the USER Unit with `slugScope = <user-scope-unit-id>`
- **AND** main SHALL project the slug to auth only for login alias or technical label purposes

#### Scenario: Slug projection to auth at first set

- **WHEN** a canonical slug is first persisted for a user
- **THEN** main SHALL notify auth to set the login alias / technical name
- **AND** auth SHALL NOT independently choose a slug

#### Scenario: Auth slug projection fails at first set

- **WHEN** main commits a canonical slug change but auth projection fails
- **THEN** main SHALL retain canonical slug authority
- **AND** the system SHALL expose or retry the projection failure without rolling back to auth as source of truth

#### Scenario: Slug change after first set is rejected in v1

- **WHEN** any path attempts to change a user's canonical slug after it is set
- **THEN** the request SHALL be rejected per the v1 immutability rule

### Requirement: User identity is unified with Unit identity

The system SHALL hold the invariant `User.unitId ≡ Unit.id where type = USER`. Every `User` row SHALL have a corresponding `Unit` row whose `id` equals `User.unitId` and whose `type` is `USER`. The User table SHALL act as a type-extension row of the Unit graph, analogous to other unit-type extensions (`Book`, `Game`, `Realm`, …).

The User PK SHALL be named `unitId` (the rename from `userId` was completed by this change). FK columns on related tables (e.g., `Unit.userId`, `ApiToken.userId`, `Follow.followerId`) MAY retain their existing column names; their `references: [...]` target SHALL be `User.unitId`.

#### Scenario: Schema inspection confirms unified identity

- **WHEN** the Prisma schema is inspected
- **THEN** `User` SHALL declare `unitId String @id @db.Uuid`
- **AND** for every `User` row, a `Unit` row with the same id and `type = USER` SHALL exist

#### Scenario: User-shaped DTO exposes unitId

- **WHEN** a consumer imports a user-shaped schema from `@rezics/contract`
- **THEN** the schema SHALL declare `unitId: string`
- **AND** there SHALL be no `userId` field on user-shaped DTOs

#### Scenario: Frontend reads unitId everywhere

- **WHEN** any frontend component renders a user object
- **THEN** it SHALL read `user.unitId`
- **AND** it SHALL NOT read `user.userId`

### Requirement: User slug is canonical under the user scope

The Rezics canonical user slug SHALL live as `Unit.slug` on the USER Unit, with `slugScope = <user-scope-unit-id>`. The `User.slug` column SHALL NOT exist. Auth-side technical name or login-alias MAY mirror the canonical slug as a one-way projection, as previously specified.

#### Scenario: Canonical user slug lives on Unit

- **WHEN** a user has slug `"alice"`
- **THEN** the USER Unit with that user's id SHALL have `slug = "alice"` and `slugScope = <user-scope-unit-id>`
- **AND** there SHALL be no `User.slug` column

#### Scenario: Auth projection target

- **WHEN** main commits a canonical user slug
- **THEN** main SHALL project the slug to auth as a login alias or technical name
- **AND** auth SHALL treat that value as a one-way projection of `Unit.slug` under the user scope

### Requirement: User slugs are immutable in v1

Once a USER Unit's slug is set, no surface SHALL accept a slug change in v1. This includes:

- `userService.update` and any profile-edit path SHALL reject `slug` fields with a typed error.
- Admin tools SHALL NOT expose a user-slug change action; if one is implemented for operational need, it SHALL be an explicit follow-on change that also defines the alias / 301 / 410 surface.
- No `UserSlugAlias` table, no redirect surface, no 410 gone is provided in v1.

This is a v1 product decision, not a substrate limitation. The composite `(slugScope, slug)` unique on `Unit` fully supports a future rename when product signals demand it.

#### Scenario: userService rejects slug update

- **WHEN** any caller submits a profile update payload containing a `slug` field for a USER Unit
- **THEN** the request SHALL be rejected with a typed error indicating user slugs are immutable in v1
- **AND** the existing slug value SHALL remain unchanged

#### Scenario: Admin operation does not provide a user-slug change path

- **WHEN** an administrator inspects available user-management actions
- **THEN** no action SHALL change a USER Unit's slug
- **AND** any attempt SHALL be rejected with the same typed error
