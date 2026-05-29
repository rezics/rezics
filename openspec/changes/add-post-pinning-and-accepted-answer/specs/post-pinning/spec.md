## ADDED Requirements

### Requirement: PostPin overlay promotes a post within a scope

The system SHALL store post promotions in a `PostPin` overlay with fields `scopeUnitId`, `postUnitId`, `kind`, `position`, `byUserId`, and `createdAt`. The primary key SHALL be `(scopeUnitId, postUnitId)` so a post is promoted at most once per scope, and an index SHALL exist on `(scopeUnitId, kind, position)` for render-time grouping and ordering. `scopeUnitId` SHALL be a Unit id that is either the thread root post (in-thread promotion) or a realm (cross-thread moderator promotion).

#### Scenario: Pin a post within a thread scope

- **WHEN** an authorized actor pins post `X` with `scopeUnitId = X.rootPostUnitId` and `kind = PINNED`
- **THEN** a `PostPin` row SHALL be created with `byUserId` set to the actor
- **AND** a second pin of `X` in the same scope SHALL be rejected by the primary key

#### Scenario: A post may be promoted in more than one scope

- **GIVEN** post `X` already pinned with `scopeUnitId = X.rootPostUnitId`
- **WHEN** a realm moderator pins `X` with `scopeUnitId = <realmUnitId>`
- **THEN** both `PostPin` rows SHALL coexist as distinct scope promotions

### Requirement: PinKind classifies why a post is promoted

The `PostPin.kind` field SHALL be a `PinKind` enum with values `ACCEPTED_ANSWER` and `PINNED` (with `HIGHLIGHT` reserved for future use). The `kind` SHALL be carried through to the rendered post so the UI can show the reason for promotion.

#### Scenario: Pin kind surfaces on the rendered post

- **WHEN** a promoted post is returned in a thread view
- **THEN** its DTO SHALL carry a `pinKind` reflecting the `PostPin.kind` for the rendered scope

#### Scenario: Unknown kind is rejected

- **WHEN** a pin is requested with a `kind` outside the `PinKind` enum
- **THEN** the request SHALL be rejected with a validation error

### Requirement: Pin position uses fractional indexing

The `PostPin.position` field SHALL be a fractional-index string consistent with the existing `position` convention used by `ShelfUnit`, `RealmTagApplication`, and `UnitTag`. Reordering a promoted post SHALL update only its own `position` row and SHALL NOT renumber sibling pins. Concurrent inserts that compute the same position SHALL be resolved by the `(scopeUnitId, postUnitId)` primary key with retry, matching the existing tables.

#### Scenario: Reorder a pin without touching others

- **GIVEN** three pins in one scope ordered by `position`
- **WHEN** the middle pin is moved to the top
- **THEN** only that pin's `position` SHALL change
- **AND** the other two pins' `position` values SHALL remain unchanged

### Requirement: Pin and unpin are authorized by scope role

The pin (`kind = PINNED`) and unpin operations SHALL be authorized as follows: a realm moderator or owner MAY pin/unpin a post in a realm scope or in a thread scope of that realm; the thread author (OP) MAY pin/unpin within their own thread scope. Actors without one of these roles SHALL be rejected. The target post SHALL belong to the scope: for a root-post scope the target's `rootPostUnitId` SHALL equal `scopeUnitId`; for a realm scope the target SHALL be a member of that realm.

#### Scenario: OP pins within their own thread

- **GIVEN** thread root `R` authored by user `U`
- **WHEN** `U` pins a reply whose `rootPostUnitId = R.unitId` with `kind = PINNED`
- **THEN** the pin SHALL be created

#### Scenario: Non-owner non-moderator cannot pin

- **WHEN** a user who is neither the OP nor a realm moderator/owner attempts to pin a post
- **THEN** the request SHALL be rejected with an authorization error

#### Scenario: Target outside the scope is rejected

- **WHEN** an actor attempts to pin a post whose `rootPostUnitId` differs from a root-post `scopeUnitId`
- **THEN** the request SHALL be rejected with a validation error

### Requirement: Promoted posts render ahead of ordinary siblings

When rendering a sibling group, the system SHALL place promoted posts ahead of ordinary replies. Promoted posts SHALL be grouped by `kind` with `ACCEPTED_ANSWER` ahead of `PINNED`, each group ordered by `position` ascending; ordinary replies SHALL follow in the chosen base sort order. This ordering SHALL be composed on top of the database-ordered base without altering any post `path`.

#### Scenario: Accepted answers and pins lead the group

- **GIVEN** a sibling group with one `ACCEPTED_ANSWER`, one `PINNED`, and several ordinary replies
- **WHEN** the group is rendered
- **THEN** the order SHALL be the accepted answer, then the pinned reply, then ordinary replies in the base sort
- **AND** no post `path` SHALL be modified to achieve this order
