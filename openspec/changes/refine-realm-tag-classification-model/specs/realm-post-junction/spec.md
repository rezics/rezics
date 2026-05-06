## MODIFIED Requirements

### Requirement: RealmUnit is the single source of truth for post-realm membership

The system SHALL track post-realm membership exclusively through the `RealmUnit` junction table. The `Post` table SHALL NOT carry any direct foreign key to a realm. Specifically, the previously-existing column `Post.realmUnitId`, the relation `Post.realm` (`@relation("PostRealm")` on Post side), and the relation `Unit.realmPosts` (`@relation("PostRealm")` on Unit side) SHALL be removed from the Prisma schema. After removal, the only mechanism by which a post is associated with a realm feed/community SHALL be one or more `RealmUnit(realmUnitId, unitId)` rows.

`RealmUnit` has a junction-table shape similar to `UnitTag`, but its product meaning is feed/community membership, not semantic tagging. It SHALL NOT be used as a prerequisite or ownership relation for `RealmTagUnit`; realm-scoped tag applications remain independent classification/interpretation rows.

#### Scenario: Post schema has no direct realm column

- **GIVEN** the Prisma schema after this change is applied
- **WHEN** the `Post` model definition is read
- **THEN** there SHALL NOT be a field named `realmUnitId` on `Post`
- **AND** there SHALL NOT be a relation named `realm` on `Post`
- **AND** the `Unit` model SHALL NOT define a relation named `realmPosts` (`@relation("PostRealm")`)

#### Scenario: All post-realm associations live in RealmUnit

- **GIVEN** a post that conceptually belongs to one or more realms
- **WHEN** the system reads its realm memberships
- **THEN** the read SHALL go through `RealmUnit` rows where `RealmUnit.unitId` equals the post's unit id
- **AND** there SHALL be no other table or column consulted to determine realm membership

#### Scenario: RealmUnit does not constrain RealmTagUnit

- **GIVEN** no `RealmUnit(realm-1, unit-1)` row exists
- **AND** `realm-1` exists as a REALM Unit
- **AND** `tag-1` exists as a TAG Unit
- **WHEN** a current realm member creates `RealmTagUnit(realm-1, tag-1, unit-1)`
- **THEN** the write SHALL NOT fail merely because `unit-1` is absent from the realm feed
- **AND** no `RealmUnit(realm-1, unit-1)` row SHALL be created automatically

#### Scenario: RealmUnit documentation explains feed semantics

- **WHEN** a developer inspects schema-facing comments or service documentation for `RealmUnit`
- **THEN** the documentation SHALL state that RealmUnit represents community/feed membership
- **AND** the documentation SHALL state that it is not semantic tagging and not the owner relation for RealmTagUnit
