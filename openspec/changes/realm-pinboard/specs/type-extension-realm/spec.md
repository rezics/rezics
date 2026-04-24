## ADDED Requirements

### Requirement: Realm.extra pinboard fields and invariants

The `Realm.extra` JSON field SHALL recognize the following optional keys:

- `announcementPostIds: string[]` — ordered list of root post unit ids exposed as the realm's `announcement` pinboard.
- `pinnedPostIds: string[]` — ordered list of root post unit ids exposed as the realm's `pinned` pinboard.
- `filterTagIds: string[]` — reserved for future realm feed filter curation. The shape SHALL be recognized but SHALL NOT be writable by any endpoint introduced in this release.

All three fields SHALL be treated as authoritative arrays when present: insertion order is meaningful and MUST be preserved by writes. Reads MUST filter out ids referring to missing or soft-deleted units.

#### Scenario: Pinboard fields default to absent

- **WHEN** a realm is created without any pinboard writes
- **THEN** `Realm.extra` MAY be `null` or an empty object
- **AND** reading the `announcement` pinboard SHALL return an empty list without error

#### Scenario: Arrays preserve insertion order

- **GIVEN** a realm where a moderator pins posts in the order `[u2, u1, u3]`
- **WHEN** the `pinned` pinboard is read
- **THEN** entries SHALL be returned in the order `[u2, u1, u3]` (after stale filtering)

### Requirement: Realm.extra writes are restricted to pinboard endpoints

Realm metadata update endpoints (for example the existing realm update / settings endpoint) MUST NOT accept writes to `announcementPostIds`, `pinnedPostIds`, or `filterTagIds` in `Realm.extra`. Those fields SHALL be mutated exclusively by the pinboard capability's endpoints. Other keys in `Realm.extra` MAY remain writable via existing flows (if any) and SHALL NOT be clobbered by pinboard writes.

#### Scenario: Realm settings update cannot change pinboard arrays

- **GIVEN** a realm with `extra.announcementPostIds = ["u1"]`
- **WHEN** an owner calls the realm settings update endpoint with `extra.announcementPostIds = []`
- **THEN** the API SHALL either ignore the field or respond with HTTP 400 indicating the field is read-only here
- **AND** `extra.announcementPostIds` SHALL remain `["u1"]`

#### Scenario: Pinboard writes preserve unrelated extra keys

- **GIVEN** a realm with `extra = { announcementPostIds: [], someOtherKey: "x" }`
- **WHEN** a moderator appends a post id via the pinboard pin endpoint
- **THEN** `extra.announcementPostIds` SHALL be updated
- **AND** `extra.someOtherKey` SHALL remain `"x"`

### Requirement: Realm.extra read-time tolerance of stale ids

When a pinboard id array references a unit that is missing or has `deletedAt != null`, the stale id SHALL be filtered out at read time. Public read endpoints SHALL NOT expose stale ids. Admin-view read endpoints MAY expose stale ids in a separate `staleIds` field so moderators can trigger cleanup. Stale-id cleanup MUST NOT happen implicitly on every read.

#### Scenario: Stale ids do not break the public read path

- **GIVEN** a realm with `pinnedPostIds = ["live1", "dead1", "live2"]` where `dead1` is soft-deleted
- **WHEN** a non-admin user reads the `pinned` pinboard
- **THEN** the response SHALL contain entries for `live1` and `live2` only
- **AND** the underlying `Realm.extra.pinnedPostIds` SHALL NOT be modified by this read
