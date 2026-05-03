## ADDED Requirements

### Requirement: RealmExtra contract defines two well-known ordered ID list keys

`@rezics/contract` SHALL export a `RealmExtraSchema` Typebox object describing the typed shape of `Realm.extra`. The schema SHALL declare two optional well-known string-array keys:

- `pinboard?: string[]` — an ordered list of Unit IDs pinned within the realm.
- `announcement?: string[]` — an ordered list of Unit IDs serving as announcements.

The schema SHALL allow additional unspecified properties (`additionalProperties: true`), preserving the "loose extra" philosophy: any other JSON-serializable key may coexist on `Realm.extra` without contract enforcement.

#### Scenario: A realm carries both well-known keys plus an unrelated extra

- GIVEN a Realm with `extra = { pinboard: ["u1", "u2"], announcement: ["a1"], filterTagIds: ["t1", "t2"] }`
- WHEN the Realm is loaded and validated against `RealmExtraSchema`
- THEN validation SHALL pass
- AND all four keys SHALL be readable via the contract's typed accessors (the well-known ones with type safety, the unspecified ones via the loose accessor)

#### Scenario: Wrong-typed value is rejected for a well-known key

- GIVEN a Realm with `extra.pinboard = "not-an-array"`
- WHEN the Realm is validated against `RealmExtraSchema`
- THEN validation SHALL fail with a type error on `pinboard`

### Requirement: Each well-known key has a JSDoc comment whose English text matches a locale entry

The contract source for each well-known key SHALL carry a JSDoc comment documenting its intended use. The English text of that comment SHALL be added (verbatim) as a locale entry under the convention key `realm.extra.<keyName>.note` in every locale file under `package/app/src/locale/`. The comment-and-locale duplication is maintained by convention; no automated extraction is required.

The `announcement` key's JSDoc and locale entry SHALL include guidance such as "Not for general forum notifications; reserved for special pages like the homepage announcement bar."

#### Scenario: Locale entry exists for each well-known key

- GIVEN the locale files `en.ts`, `zh-hans.ts`, `zh-hant.ts`, `ja.ts`, `de.ts` under `package/app/src/locale/`
- WHEN any of those files is loaded
- THEN it SHALL export a value at the path `realm.extra.pinboard.note` AND `realm.extra.announcement.note`
- AND each value SHALL be a non-empty string

#### Scenario: English locale text matches the contract JSDoc

- GIVEN the contract source for `RealmExtraSchema.announcement` carries a specific English JSDoc string
- WHEN the locale `en.ts` is read at `realm.extra.announcement.note`
- THEN the value SHALL equal the contract JSDoc string verbatim

### Requirement: Server-side append/reorder/remove primitives on Realm.extra well-known keys

The realm API SHALL expose primitive operations to manage well-known string-array keys on `Realm.extra` atomically:

- `POST /realms/:realmId/extra/:key/append` body `{ unitId: string }` — append the unit ID at the end of the list, deduplicating existing entries.
- `POST /realms/:realmId/extra/:key/reorder` body `{ unitIds: string[] }` — replace the array with the provided ordering; the new array MUST be a permutation of the existing array (modulo IDs being added/removed via the dedicated endpoints).
- `DELETE /realms/:realmId/extra/:key/:unitId` — remove the matching ID from the list.

These endpoints SHALL serialize concurrent writes per realm via a `SELECT ... FOR UPDATE` row lock on the realm, preventing lost updates.

The endpoints SHALL accept any string for `:key` (the trust strategy applies to keys; only the well-known keys carry typed contracts and locale hints).

Authorization SHALL require the caller to be a moderator (or higher) of the realm, OR `hasAuthorityOver(caller, realmUnit)` to be true.

#### Scenario: Append a unit id to the pinboard list

- GIVEN a Realm "R" with `extra.pinboard = ["u1"]`
- AND a caller with moderator role on "R"
- WHEN the caller invokes `POST /realms/R/extra/pinboard/append` with body `{ unitId: "u2" }`
- THEN `extra.pinboard` SHALL become `["u1", "u2"]`

#### Scenario: Append a duplicate unit id is a no-op

- GIVEN a Realm "R" with `extra.pinboard = ["u1", "u2"]`
- WHEN a moderator invokes `POST /realms/R/extra/pinboard/append` with body `{ unitId: "u1" }`
- THEN `extra.pinboard` SHALL remain `["u1", "u2"]`
- AND the response SHALL indicate idempotent success

#### Scenario: Reorder validates permutation

- GIVEN a Realm "R" with `extra.announcement = ["a1", "a2", "a3"]`
- WHEN a moderator invokes `POST /realms/R/extra/announcement/reorder` with body `{ unitIds: ["a3", "a1", "a2"] }`
- THEN `extra.announcement` SHALL become `["a3", "a1", "a2"]`

#### Scenario: Reorder rejects non-permutation

- GIVEN a Realm "R" with `extra.announcement = ["a1", "a2", "a3"]`
- WHEN a moderator invokes `POST /realms/R/extra/announcement/reorder` with body `{ unitIds: ["a1", "a4"] }`
- THEN the request SHALL be rejected with `400 Bad Request`
- AND `extra.announcement` SHALL remain `["a1", "a2", "a3"]`

#### Scenario: Concurrent appends are serialized

- GIVEN a Realm "R" with `extra.pinboard = []`
- WHEN two moderators concurrently invoke `POST /realms/R/extra/pinboard/append` with `{ unitId: "u1" }` and `{ unitId: "u2" }` respectively
- THEN the row lock SHALL serialize the writes
- AND the resulting `extra.pinboard` SHALL contain both `"u1"` and `"u2"` (order reflecting the order of acquisition)

### Requirement: Read-time stale-ID filtering

When the server returns the contents of a Realm's well-known list keys to a client (e.g., for rendering a pinboard or announcement strip), the system SHALL filter out IDs that:

- Reference no existing Unit, OR
- Reference a Unit with `status = DELETED`, OR
- Reference a Unit not visible to the requesting caller per existing visibility rules.

The stored `Realm.extra.<key>` value SHALL NOT be modified by this read-time filtering. Admin-facing views MAY surface the unfiltered list so moderators can clean up stale entries.

#### Scenario: Deleted unit is filtered from public read

- GIVEN a Realm "R" with `extra.pinboard = ["u1", "u2"]`
- AND Unit "u1" has `status = DELETED`
- WHEN a non-admin reader requests the realm's pinboard
- THEN the response SHALL contain only "u2"
- AND the stored `extra.pinboard` SHALL still be `["u1", "u2"]`

#### Scenario: Admin sees stale entries for cleanup

- GIVEN a Realm "R" with `extra.pinboard = ["u1", "u2"]`
- AND Unit "u1" no longer exists
- WHEN a moderator requests the admin-side view of the realm's pinboard
- THEN the response SHALL include "u1" with a stale-marker indicator alongside "u2"
- AND the moderator SHALL be able to issue `DELETE /realms/R/extra/pinboard/u1` to remove it
