# realm-post-junction Specification

## Purpose

Defines that `RealmUnit` is the single source of truth for post-realm membership. The `Post` table SHALL NOT carry any direct foreign key to a realm; `Post.realmUnitId`, `Post.realm`, and `Unit.realmPosts` are removed. Cross-posting is supported by writing multiple `RealmUnit` rows. The `createPost` service accepts `realmUnitIds: string[]` and writes both the `Post` and the `RealmUnit` rows in one transaction. A four-phase migration (dual-write, backfill, drop-legacy-write, drop-column) preserves data through the transition.

## Requirements

### Requirement: UnitRealm is the single source of truth for post-realm membership

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

### Requirement: Cross-posting is supported by writing multiple RealmUnit rows

A single post SHALL be allowed to belong to any number of realms simultaneously by writing one `RealmUnit(realmUnitId, unitId)` row per realm. There SHALL NOT be a "primary realm" concept at the schema level; all `RealmUnit` rows for a given `unitId` SHALL be treated equally as realm memberships.

#### Scenario: Post in three realms

- **GIVEN** a post with unit id `p1`
- **AND** `RealmUnit` rows `(realm-A, p1)`, `(realm-B, p1)`, `(realm-C, p1)`
- **WHEN** the system queries the realms `p1` belongs to
- **THEN** the response SHALL list all three realms
- **AND** removing any one row SHALL leave the other two associations intact

#### Scenario: Removing one cross-post leaves others

- **GIVEN** post `p1` is in realms A and B via `RealmUnit`
- **WHEN** the row `(realm-A, p1)` is deleted
- **THEN** `p1` SHALL no longer appear in realm A's content feed
- **AND** `p1` SHALL still appear in realm B's content feed
- **AND** the post itself SHALL remain unchanged (body, target, parent, score)

### Requirement: createPost writes RealmUnit rows transactionally

The `createPost` service SHALL accept an optional `realmUnitIds: string[]` field on its input. When non-empty, the service SHALL, in the same database transaction that creates the `Unit` and `Post` rows, insert one `RealmUnit(realmUnitId, unitId)` row per id in `realmUnitIds`. If any insert fails (for example, a referenced realm does not exist or the caller lacks permission to post in it), the entire transaction SHALL roll back and no `Post` SHALL be created.

The previously-accepted singular field `realmUnitId: string?` SHALL be removed from the `createPostSchema`.

#### Scenario: Create post in two realms

- **WHEN** a caller invokes `createPost` with body and `realmUnitIds: ["realm-A", "realm-B"]`
- **THEN** within one transaction, the system SHALL create the Unit, the Post, a `RealmUnit("realm-A", postUnitId)` row, and a `RealmUnit("realm-B", postUnitId)` row
- **AND** the response SHALL succeed

#### Scenario: Create post with no realm

- **WHEN** a caller invokes `createPost` without `realmUnitIds` (or with empty array)
- **THEN** the system SHALL create the Unit and Post
- **AND** SHALL NOT create any `RealmUnit` row
- **AND** the post SHALL not appear in any realm feed

#### Scenario: Failed realm insert rolls back post creation

- **GIVEN** `realm-X` does not exist
- **WHEN** a caller invokes `createPost` with `realmUnitIds: ["realm-A", "realm-X"]`
- **THEN** the transaction SHALL fail
- **AND** no `Post` row SHALL persist
- **AND** no `RealmUnit("realm-A", *)` row SHALL persist for this attempt

### Requirement: Migration backfills RealmUnit from legacy Post.realmUnitId

A one-shot Prisma migration SHALL run before the `Post.realmUnitId` column is dropped. It SHALL insert a `RealmUnit(realmUnitId, unitId, createdAt)` row for every existing `Post` row where `Post.realmUnitId IS NOT NULL`, using the post's `realmUnitId` as `RealmUnit.realmUnitId`, the post's unit id as `RealmUnit.unitId`, and the post's `createdAt` as the junction's `createdAt`. The migration SHALL use `ON CONFLICT DO NOTHING` to be idempotent against any rows already populated by Phase A dual-write.

#### Scenario: Backfill creates junction rows for legacy posts

- **GIVEN** Post `p1` with `realmUnitId = "realm-A"` and Post `p2` with `realmUnitId = "realm-B"`
- **AND** no pre-existing `RealmUnit` rows for these posts
- **WHEN** the backfill migration runs
- **THEN** `RealmUnit("realm-A", p1)` SHALL exist
- **AND** `RealmUnit("realm-B", p2)` SHALL exist

#### Scenario: Backfill is idempotent

- **GIVEN** Post `p1` with `realmUnitId = "realm-A"` and a pre-existing `RealmUnit("realm-A", p1)` row from Phase A dual-write
- **WHEN** the backfill migration runs
- **THEN** the existing `RealmUnit` row SHALL remain unchanged
- **AND** no duplicate row SHALL be inserted
- **AND** the migration SHALL not error

### Requirement: Phased migration preserves data through Post.realmUnitId removal

The schema migration SHALL be applied in four phases, each shipping as a separate code drop:

- **Phase A** — server dual-writes: `createPost` writes both `Post.realmUnitId` (when supplied) and `RealmUnit` rows; reads switch to `RealmUnit`-backed queries; `byTarget` continues to fall back for realm-typed targets, logging a deprecation warning.
- **Phase B** — backfill: the one-shot migration described above runs in production after Phase A is verified stable.
- **Phase C** — drop legacy writes: server stops writing `Post.realmUnitId` on new posts; `byTarget` no longer falls back for realm-typed targets; the `realmUnitId` (singular) field is removed from `createPostSchema`.
- **Phase D** — drop column: the Prisma migration that drops `Post.realmUnitId`, the `Post.realm` relation, and the `Unit.realmPosts` relation runs after Phase C is verified stable in production.

The change SHALL NOT skip phases. Phase D SHALL be irreversible without re-introducing data loss.

#### Scenario: Phase A leaves Post.realmUnitId column intact

- **GIVEN** Phase A is deployed
- **WHEN** a developer inspects the production database schema
- **THEN** `Post.realmUnitId` SHALL still exist as a nullable column
- **AND** new posts created with `realmUnitIds: ["r1"]` SHALL produce both a `Post.realmUnitId = "r1"` write and a `RealmUnit("r1", unitId)` row

#### Scenario: Phase D removes Post.realmUnitId column

- **GIVEN** Phases A through C have been deployed and verified
- **WHEN** the Phase D migration runs
- **THEN** `Post.realmUnitId` SHALL be dropped
- **AND** the `@relation("PostRealm")` Prisma relation SHALL be removed from both `Post` and `Unit` models
- **AND** all production reads after this point SHALL go exclusively through `RealmUnit`

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
