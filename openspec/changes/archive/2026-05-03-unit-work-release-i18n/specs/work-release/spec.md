## MODIFIED Requirements

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

## ADDED Requirements

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
