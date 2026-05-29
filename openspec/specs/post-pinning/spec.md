# post-pinning Specification

## Purpose
TBD - created by archiving change add-post-pinning-and-accepted-answer. Update Purpose after archive.
## Requirements
### Requirement: PostPin overlay promotes a post within a scope

The system SHALL store post promotions in a `PostPin` overlay with fields `scopeUnitId`, `postUnitId`, `kind`, `position`, `byUserId`, and `createdAt`. The primary key SHALL be `(scopeUnitId, postUnitId)` so a post is promoted at most once per scope, and an index SHALL exist on `(scopeUnitId, kind, position)` for render-time grouping and ordering. `scopeUnitId` SHALL always be the thread **root post** id; a realm SHALL NOT be a `PostPin` scope. The target `postUnitId` SHALL be a **reply** within that thread (`depth ≥ 1` and `rootPostUnitId == scopeUnitId`), never a thread root. Realm-level featuring of whole units is `Realm.extra.pinboard`'s responsibility, not `PostPin`.

#### Scenario: Pin a reply within its thread scope

- **WHEN** an authorized actor pins reply `X` (with `X.rootPostUnitId = R`) with `scopeUnitId = R` and `kind = PINNED`
- **THEN** a `PostPin` row SHALL be created with `byUserId` set to the actor
- **AND** a second pin of `X` in the same scope SHALL be rejected by the primary key

#### Scenario: A realm id is rejected as a scope

- **WHEN** an actor attempts to create a `PostPin` whose `scopeUnitId` is a realm Unit id
- **THEN** the request SHALL be rejected with a validation error
- **AND** the actor SHALL be directed to `Realm.extra.pinboard` for realm-level featuring

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

The pin (`kind = PINNED`) and unpin operations SHALL be authorized as follows: a realm moderator or owner MAY pin/unpin a reply within any thread of that realm; the thread author (OP) MAY pin/unpin within their own thread. Actors without one of these roles SHALL be rejected. The target SHALL belong to the scope thread: the target's `rootPostUnitId` SHALL equal `scopeUnitId` and the target SHALL be a reply (`depth ≥ 1`).

#### Scenario: OP pins within their own thread

- **GIVEN** thread root `R` authored by user `U`
- **WHEN** `U` pins a reply whose `rootPostUnitId = R.unitId` with `kind = PINNED`
- **THEN** the pin SHALL be created

#### Scenario: Non-owner non-moderator cannot pin

- **WHEN** a user who is neither the OP nor a realm moderator/owner attempts to pin a post
- **THEN** the request SHALL be rejected with an authorization error

#### Scenario: Target outside the scope thread is rejected

- **WHEN** an actor attempts to pin a post whose `rootPostUnitId` differs from `scopeUnitId`
- **THEN** the request SHALL be rejected with a validation error

### Requirement: Promoted posts render ahead of ordinary siblings

When rendering a sibling group, the system SHALL place promoted posts ahead of ordinary replies. Promoted posts SHALL be grouped by `kind` with `ACCEPTED_ANSWER` ahead of `PINNED`, each group ordered by `position` ascending; ordinary replies SHALL follow in the chosen base sort order. This ordering SHALL be composed on top of the database-ordered base without altering any post `path`.

#### Scenario: Accepted answers and pins lead the group

- **GIVEN** a sibling group with one `ACCEPTED_ANSWER`, one `PINNED`, and several ordinary replies
- **WHEN** the group is rendered
- **THEN** the order SHALL be the accepted answer, then the pinned reply, then ordinary replies in the base sort
- **AND** no post `path` SHALL be modified to achieve this order

