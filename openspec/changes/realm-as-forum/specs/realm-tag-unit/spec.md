## ADDED Requirements

### Requirement: RealmTagUnit and extra.tagTree have independent purposes

`RealmTagUnit` and `Realm.extra.tagTree` SHALL serve distinct purposes that do not constrain each other:

- `RealmTagUnit(realmUnitId, unitId, tagUnitId)` SHALL track which tags have been applied to which units within a realm, with score, voteCount, pinned, and position fields. It is the data layer of realm-scoped tagging.
- `Realm.extra.tagTree` SHALL be a curation hint surfaced in the post-composer tag picker. It is purely a UX affordance for quick selection.

A tag id appearing in `extra.tagTree` SHALL NOT imply any `RealmTagUnit` row exists. A tag id NOT in `extra.tagTree` SHALL NOT be prevented from being applied via `RealmTagUnit`. The two layers SHALL evolve independently.

#### Scenario: tagTree advertises a tag with no RealmTagUnit rows yet

- **GIVEN** realm-1 with `extra.tagTree = [{ tagId: "action" }]`
- **AND** no `RealmTagUnit` rows exist for `(realm-1, *, action)`
- **WHEN** a member opens the composer in realm-post mode for realm-1
- **THEN** the picker SHALL show "action" as a quick-pick chip
- **AND** the absence of RealmTagUnit rows SHALL NOT prevent rendering or selection

#### Scenario: RealmTagUnit exists for a tag not in tagTree

- **GIVEN** realm-1 with `extra.tagTree = []`
- **AND** `RealmTagUnit(realm-1, post-A, "fantasy")` exists from a previous tagging
- **WHEN** the realm's tag-filter is rendered on the Feed tab
- **THEN** the filter SHALL NOT show "fantasy" as a chip (it sources from tagTree only)
- **AND** the existing RealmTagUnit row SHALL remain unaffected
- **AND** post-A SHALL still appear in the realm's feed

#### Scenario: User picks a tag outside tagTree at post time

- **GIVEN** realm-1 with `extra.tagTree = [{ tagId: "action" }]`
- **WHEN** a user composes a post in realm-1 and uses search to pick `tag-romance`
- **THEN** the post SHALL be created with `tagIds: ["tag-romance"]`
- **AND** a `UnitTag(postUnitId, "tag-romance")` row SHALL be written
- **AND** no validation SHALL reject the post for using a tag outside tagTree

### Requirement: Realm cannot create new tags

The system SHALL NOT permit a realm to create new tag Units. Tag creation SHALL be a global, realm-independent operation governed by whichever capability owns global tag lifecycle. Realm management endpoints (`PUT /realms/:realmId/extra/tagTree`, etc.) SHALL accept only tag ids referencing already-existing tag Units; references to nonexistent tag ids SHALL be rejected with 400.

This invariant ensures the global tag pool remains the single source of truth and prevents proliferation of duplicate or realm-specific tags.

#### Scenario: tagTree edit rejects nonexistent tagId

- **GIVEN** "tag-fictional" does not exist as a Unit
- **WHEN** a moderator submits `PUT /realms/realm-1/extra/tagTree` body `{ value: [{ tagId: "tag-fictional" }] }`
- **THEN** the request SHALL be rejected with `400 Bad Request`
- **AND** the realm SHALL NOT have created any new Unit

#### Scenario: No realm-side tag creation endpoint exists

- **WHEN** a developer audits the realm API surface
- **THEN** no endpoint SHALL allow creating a new tag Unit scoped to a realm
- **AND** all tag-creation paths SHALL go through the global tag system
