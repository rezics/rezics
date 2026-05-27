## ADDED Requirements

### Requirement: A work is a Unit with no parent and a type that supports the work/release pattern

A work Unit SHALL have `workUnitId = null` and a `type` from the set that supports the work/release pattern. The supported set SHALL be `{BOOK, GAME, MEDIA, POST}`. The work role is derived from this state — there is no explicit role enum.

#### Scenario: Create a work unit (BOOK)

- GIVEN an authenticated user
- WHEN the user creates a Unit with `type = BOOK` and `workUnitId = null`
- THEN the Unit SHALL be persisted as a work
- AND querying for works SHALL include this unit

#### Scenario: Create a work unit (POST)

- GIVEN an authenticated user
- WHEN the user creates a Unit with `type = POST` and `workUnitId = null`
- THEN the Unit SHALL be persisted as a standalone POST that MAY later become a work by having releases linked to it
- AND any subsequent Unit with `workUnitId` referencing this POST SHALL be accepted (subject to release-side type-match and authorization rules)

#### Scenario: Unsupported types cannot be works with releases

- GIVEN a Unit of a type that is not in `{BOOK, GAME, MEDIA, POST}` (e.g., `TAG` or `SHELF`)
- WHEN another Unit attempts to set `workUnitId` to this unit's id
- THEN the system SHALL reject the operation because that type does not support the work/release pattern

### Requirement: A release is a Unit with workUnitId set to its parent work

A release Unit SHALL have `workUnitId` set to the id of an existing work Unit. The release's `type` MUST match the parent work's `type`. A work MAY have zero or more releases.

#### Scenario: Create a release for a work

- GIVEN a work Unit "work-1" with `type = BOOK` and `workUnitId = null`
- WHEN the user creates a new Unit with `type = BOOK` and `workUnitId = "work-1"`
- THEN the release Unit SHALL be persisted with `workUnitId = "work-1"`
- AND querying releases for "work-1" SHALL include this unit

#### Scenario: Multiple releases under one work

- GIVEN a work Unit "work-1" of type `GAME`
- WHEN three release Units are created with `workUnitId = "work-1"` and `type = GAME`
- THEN all three releases SHALL be associated with "work-1"
- AND querying `Unit WHERE workUnitId = "work-1"` SHALL return all three

### Requirement: Release type MUST match its parent work type

The system SHALL enforce that a release Unit's `type` is identical to the `type` of the Unit referenced by `workUnitId`. This invariant MUST be validated at creation time.

#### Scenario: Matching types accepted

- GIVEN a work Unit "work-1" with `type = MEDIA`
- WHEN a release Unit is created with `type = MEDIA` and `workUnitId = "work-1"`
- THEN the release SHALL be created successfully

#### Scenario: Mismatched types rejected

- GIVEN a work Unit "work-1" with `type = BOOK`
- WHEN a caller attempts to create a release Unit with `type = GAME` and `workUnitId = "work-1"`
- THEN the system SHALL reject the creation with a validation error
- AND no release Unit SHALL be persisted

### Requirement: workUnitId MUST reference an existing unit that is itself a work

The `workUnitId` field, when set, SHALL reference an existing Unit whose own `workUnitId` is null (i.e., a work, not another release). A release cannot be nested under another release.

#### Scenario: workUnitId points to a valid work

- GIVEN a work Unit "work-1" with `workUnitId = null`
- WHEN a release is created with `workUnitId = "work-1"`
- THEN the creation SHALL succeed

#### Scenario: workUnitId points to a release (rejected)

- GIVEN a release Unit "release-1" with `workUnitId = "work-1"`
- WHEN a caller attempts to create a Unit with `workUnitId = "release-1"`
- THEN the system SHALL reject the creation because "release-1" is itself a release, not a work

#### Scenario: workUnitId points to a non-existent unit (rejected)

- GIVEN no Unit exists with `id = "nonexistent"`
- WHEN a caller attempts to create a Unit with `workUnitId = "nonexistent"`
- THEN the system SHALL reject the creation with a not-found or foreign key error

### Requirement: Releases for a work are discovered by querying workUnitId

To find all releases belonging to a work, the system SHALL query `Unit WHERE workUnitId = workId`. There is no separate join table or relationship model for work-release associations.

#### Scenario: Query releases for a work

- GIVEN a work Unit "work-1" with releases "release-a", "release-b", and "release-c"
- WHEN the system queries `Unit WHERE workUnitId = "work-1"`
- THEN the result set SHALL contain exactly "release-a", "release-b", and "release-c"

#### Scenario: Work with no releases

- GIVEN a work Unit "work-2" with no releases
- WHEN the system queries `Unit WHERE workUnitId = "work-2"`
- THEN the result set SHALL be empty

### Requirement: Standalone units are neither works nor releases

A standalone unit is a Unit with `workUnitId = null` that has no other units referencing it via `workUnitId`. Standalone units operate independently without work/release semantics. Any UnitType may exist as a standalone unit.

#### Scenario: Standalone POST unit

- GIVEN a Unit of type `POST` with `workUnitId = null`
- AND no other Unit has `workUnitId` pointing to this unit
- THEN this unit SHALL be treated as a standalone unit
- AND it SHALL not participate in work/release queries

#### Scenario: BOOK unit without releases is standalone

- GIVEN a Unit of type `BOOK` with `workUnitId = null`
- AND no other Unit has `workUnitId` pointing to this unit
- THEN this unit is structurally a standalone unit (it could become a work if releases are later added)

### Requirement: Deleting a work sets releases' workUnitId to null via onDelete SetNull

When a work Unit is deleted (or its record is removed), the database SHALL set `workUnitId = null` on all release Units that referenced it, via Prisma's `onDelete: SetNull` referential action. This converts former releases into standalone units rather than cascade-deleting them.

#### Scenario: Work deletion orphans its releases

- GIVEN a work Unit "work-1" with releases "release-a" and "release-b"
- WHEN "work-1" is deleted (soft-delete to `status = DELETED` or hard-delete)
- THEN "release-a" and "release-b" SHALL have their `workUnitId` set to null
- AND both SHALL continue to exist as standalone units

#### Scenario: Orphaned releases retain their own data

- GIVEN releases "release-a" and "release-b" that were orphaned after their work was deleted
- WHEN querying "release-a" and "release-b"
- THEN all their own fields (type, status, visibility, translations, support languages) SHALL remain intact
- AND only `workUnitId` SHALL have changed to null

### Requirement: PATCH /units/:releaseId/work-link sets or clears workUnitId

The `unit` API SHALL expose a `PATCH /units/:releaseId/work-link` endpoint that accepts a body of `{ workUnitId: string | null }` and atomically sets or clears `Unit.workUnitId` on the addressed unit. The endpoint SHALL never modify any other field of the addressed unit.

#### Scenario: Clear an existing work link

- GIVEN a release Unit "release-1" with `workUnitId = "work-1"`
- AND the caller has authority over "release-1"
- WHEN the caller invokes `PATCH /units/release-1/work-link` with body `{ workUnitId: null }`
- THEN `release-1.workUnitId` SHALL be set to null
- AND the response status SHALL be `UNLINKED`

#### Scenario: Set a work link with bilateral authority

- GIVEN a Unit "unit-y" owned by the caller
- AND a Work Unit "work-x" of type `POST` also owned by the caller
- WHEN the caller invokes `PATCH /units/unit-y/work-link` with body `{ workUnitId: "work-x" }`
- THEN `unit-y.workUnitId` SHALL be set to `"work-x"` immediately
- AND the response status SHALL be `LINKED`

### Requirement: work-link authorization requires release-side authority

For both setting and clearing operations on `PATCH /units/:releaseId/work-link`, the system SHALL require `hasAuthorityOver(caller, release)` to be true. A caller without release-side authority SHALL receive a `403 Forbidden` response, regardless of any authority over the target work.

#### Scenario: Caller lacks release-side authority

- GIVEN a Unit "unit-y" owned by user A
- AND a Work Unit "work-x" owned by user B (the caller)
- WHEN user B invokes `PATCH /units/unit-y/work-link` with body `{ workUnitId: "work-x" }`
- AND user B has no admin role and is not a moderator of any realm containing "unit-y"
- THEN the request SHALL be rejected with `403 Forbidden`
- AND no link SHALL be established

### Requirement: work-link grants immediate set when caller has work-side authority

When release-side authority is satisfied AND `hasAuthorityOver(caller, work)` is true, the system SHALL set `Unit.workUnitId` immediately and return `{ status: "LINKED" }`. No `WorkLinkClaim` SHALL be created in this path.

#### Scenario: Realm moderator wires a release for a work in their realm

- GIVEN a Work Unit "work-x" of type `POST` referenced by `RealmUnit` of realm "R"
- AND a Unit "unit-y" referenced by `RealmUnit` of realm "R"
- AND the caller is a moderator of realm "R" (mod role grants authority over both units)
- WHEN the caller invokes `PATCH /units/unit-y/work-link` with body `{ workUnitId: "work-x" }`
- THEN `unit-y.workUnitId` SHALL be set to `"work-x"` immediately
- AND no `WorkLinkClaim` record SHALL be created
- AND the response SHALL be `{ status: "LINKED" }`

### Requirement: work-link grants immediate set when target work type is in WIKI_TYPES

When release-side authority is satisfied AND the target work's `type` is a member of `WIKI_TYPES` (defined in `@rezics/contract` as `{BOOK, GAME, MEDIA}`), the system SHALL set `Unit.workUnitId` immediately and return `{ status: "LINKED", autoApproved: true }`. No `WorkLinkClaim` SHALL be created. This implements the "wiki contribution" short-circuit.

#### Scenario: User contributes a translated release to a BOOK without book-side approval

- GIVEN a BOOK Work Unit "book-x" owned by user A
- AND a BOOK Unit "book-y-zh" owned by user B (the caller), with `type = BOOK`
- WHEN user B invokes `PATCH /units/book-y-zh/work-link` with body `{ workUnitId: "book-x" }`
- THEN `book-y-zh.workUnitId` SHALL be set to `"book-x"` immediately
- AND the response SHALL include `autoApproved: true`
- AND no `WorkLinkClaim` SHALL be created

### Requirement: work-link defers to a claim when neither short-circuit applies

When release-side authority is satisfied, but neither `hasAuthorityOver(caller, work)` nor `work.type ∈ WIKI_TYPES` is true, the system SHALL create a new `WorkLinkClaim` with `status = PENDING`, leave `Unit.workUnitId` unchanged, and return `{ status: "PENDING", claimId }`. The system SHALL trigger the side-effect notification described by the `notify-system-email` capability for the work owner.

#### Scenario: Translator submits a Release request for someone else's POST

- GIVEN a POST Work Unit "post-x" owned by user A
- AND a POST Unit "post-y-en" owned by user B (the caller)
- AND user B has no admin role and no realm-mod authority over "post-x"
- WHEN user B invokes `PATCH /units/post-y-en/work-link` with body `{ workUnitId: "post-x" }`
- THEN `post-y-en.workUnitId` SHALL remain null
- AND a `WorkLinkClaim` SHALL be created with `releaseUnitId = "post-y-en"`, `workUnitId = "post-x"`, `claimerUserId = userB`, `status = PENDING`
- AND a system notification with email SHALL be dispatched to user A
- AND the response SHALL be `{ status: "PENDING", claimId: <id> }`

### Requirement: work-link clear cascades pending claims to WITHDRAWN

When `PATCH /units/:releaseId/work-link` is called with `{ workUnitId: null }` and the release has any associated `WorkLinkClaim` records with `status = PENDING`, the system SHALL set those claims' `status = WITHDRAWN` and `resolvedAt = now()` in the same transaction.

#### Scenario: Claimer withdraws by clearing the implicit pending link

- GIVEN a Unit "unit-y" with no `workUnitId` set
- AND a `WorkLinkClaim` exists with `releaseUnitId = "unit-y"`, `status = PENDING`
- WHEN the release-side caller invokes `PATCH /units/unit-y/work-link` with body `{ workUnitId: null }`
- THEN the claim's `status` SHALL be set to `WITHDRAWN`
- AND `resolvedAt` SHALL be set
- AND the response SHALL be `{ status: "UNLINKED" }`

### Requirement: Work/Release Semantics Are Release-First

For release-aware domains, the system SHALL treat visible releases as the normal
user-facing catalog and interaction targets. Hidden work Units SHALL provide
grouping and inherited semantics through `UnitWork`; they SHALL NOT be the
ordinary book detail or reading destination.

#### Scenario: User opens release page

- **WHEN** a user opens a book release Unit
- **THEN** the page SHALL render release-specific metadata and content controls
- **AND** the page MAY show work-domain tags and community content inherited through `UnitWork`

#### Scenario: Work unit is not the default reading page

- **WHEN** a user-facing route receives a hidden work Unit id for a release-aware book
- **THEN** the route SHALL resolve an appropriate visible release or render a work-domain maintenance/selection surface
- **AND** it SHALL NOT pretend that the hidden work Unit itself has release content

### Requirement: UnitWork Supersedes Direct Work-Link Semantics

The existing direct work-link behavior SHALL be migrated so that `UnitWork` is
the canonical membership model. `Unit.workUnitId` MAY remain as a denormalized
shortcut during migration, but work/release queries and new features SHALL
resolve membership through `UnitWork`.

#### Scenario: Existing work link is backfilled

- **GIVEN** release Unit `release-a` currently has `workUnitId = work-x`
- **WHEN** the migration/backfill runs
- **THEN** `UnitWork(unitId = release-a, workUnitId = work-x)` SHALL be created
- **AND** repeated backfill runs SHALL NOT create duplicate membership rows

#### Scenario: Work query reads UnitWork

- **WHEN** the system lists releases for hidden work Unit `work-x`
- **THEN** it SHALL read active `UnitWork` rows for `work-x`
- **AND** it SHALL include `position`, role, display policy, and language metadata from `UnitWork`

### Requirement: Release Nesting Remains Forbidden For Work Membership

`UnitWork.workUnitId` SHALL reference a hidden work Unit, not another visible
release member. A release SHALL NOT become the work domain for another release
through `UnitWork`.

#### Scenario: UnitWork points to visible member rejected

- **GIVEN** `UnitWork(unitId = release-a, workUnitId = work-x)` exists
- **WHEN** a caller attempts to create `UnitWork(unitId = release-b, workUnitId = release-a)`
- **THEN** the system SHALL reject the membership because `release-a` is a visible member, not a hidden work Unit

### Requirement: Work Creation Is Release-Led For Ordinary Users

For release-aware domains, ordinary creation flows SHALL create visible release
Units and attach them to work domains. They SHALL NOT treat hidden work Units as
ordinary content users create directly. A new work domain MAY be created as part
of creating the first visible release for a work.

#### Scenario: First release creates hidden work domain

- **WHEN** a user confirms they are adding the first release/original version of
  a work
- **THEN** the system MAY create a hidden work Unit for grouping
- **AND** it SHALL also create or attach the visible release Unit in the same
  release-led flow

#### Scenario: Translation attaches to existing work

- **GIVEN** an existing release belongs to work `work-x`
- **WHEN** a user creates a translation release and selects that existing
  release as the match
- **THEN** the new translation release SHALL be attached to `work-x`
- **AND** the flow SHALL NOT create a separate standalone work for the
  translation

### Requirement: Admin Work Merge Canonicalizes Releases Without Deleting Source Work

Admin work merge SHALL canonicalize source-work releases under a target work
without deleting the source work Unit. The operation SHALL preserve source-work
non-membership metadata by default and SHALL update canonical work resolution so
release pages, search grouping, work-domain content membership, and library DTO
metadata use the target work after merge completion.

#### Scenario: Source work redirects to target for public resolution

- **GIVEN** source work `work-old` has been merged into target work `work-new`
- **WHEN** public or library DTO resolution encounters `work-old`
- **THEN** it SHALL resolve the canonical work as `work-new`
- **AND** it SHALL not expose `work-old` as the current work for ordinary
  release display
