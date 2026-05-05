# realm-extra-pinboard-keys Specification

## Purpose

Defines the typed contract on `Realm.extra` for well-known JSON keys: list-form keys (`pinboard`, `announcement`) and single-valued keys (`rule`, `about`, `banner`, `tagTree`). Covers the Typebox schema, JSDoc/locale convention, server endpoints (append/reorder/remove for lists; PUT/DELETE for single-valued), authorization, row-level concurrency, and read-time stale-ID filtering.

## Requirements

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

### Requirement: RealmExtra contract defines rule, about, banner, and tagTree well-known keys

`@rezics/contract` SHALL extend `RealmExtraSchema` to declare four additional well-known keys, in addition to the existing `pinboard` and `announcement`:

- `rule?: string` — a single Unit ID referencing a Post that holds the realm's rule content.
- `about?: string` — a single Unit ID referencing a Post that holds the realm's about/sidebar content.
- `banner?: { kind: "post"; unitId: string } | { kind: "url"; url: string }` — either a Post reference (`kind: "post"`) for a banner image stored as a Post, or a direct URL (`kind: "url"`) for a hosted image. The discriminator field `kind` SHALL be present and required when `banner` is set.
- `tagTree?: TagTreeNode[]` — an ordered list of tag-tree nodes defined by the schema below.

The `TagTreeNode` shape SHALL be:

```ts
type TagTreeNode = {
  tagId?: string;       // a global tag Unit id, when this node is selectable
  label?: string;       // optional display label override (e.g., for grouping headers)
  disabled?: boolean;   // when true, this node is a header/grouping only — not selectable
  children?: TagTreeNode[];
};
```

`tagId` and `children` are NOT mutually exclusive — a node MAY have both, meaning it is selectable AND has nested sub-nodes. When `disabled` is `true`, `tagId` (if present) SHALL be ignored for selection purposes; the node renders as a header label only.

The schema SHALL continue to allow additional unspecified properties (`additionalProperties: true`).

#### Scenario: Realm carries all well-known keys

- **GIVEN** a Realm with `extra = { pinboard: ["u1"], announcement: ["a1"], rule: "p-rule", about: "p-about", banner: { kind: "url", url: "/banner.jpg" }, tagTree: [{ tagId: "t1" }] }`
- **WHEN** the Realm is validated against `RealmExtraSchema`
- **THEN** validation SHALL pass

#### Scenario: rule must be a single unitId string

- **GIVEN** a Realm with `extra.rule = ["p1", "p2"]` (array form)
- **WHEN** the Realm is validated
- **THEN** validation SHALL fail with a type error on `rule`

#### Scenario: banner discriminator is required

- **GIVEN** a Realm with `extra.banner = { url: "/img.jpg" }` (missing `kind`)
- **WHEN** the Realm is validated
- **THEN** validation SHALL fail
- **AND** when `extra.banner = { kind: "url", url: "/img.jpg" }`, validation SHALL pass

#### Scenario: tagTree disabled node renders as header only

- **GIVEN** a tagTree node `{ disabled: true, label: "Genre", children: [{ tagId: "action" }] }`
- **WHEN** the renderer processes it
- **THEN** the node SHALL be rendered as a non-selectable label "Genre"
- **AND** its child `{ tagId: "action" }` SHALL be rendered as a selectable item

#### Scenario: tagTree node with both tagId and children

- **GIVEN** a tagTree node `{ tagId: "long-running", children: [{ tagId: "100-plus-eps" }] }`
- **WHEN** the renderer processes it
- **THEN** the node SHALL be selectable as `long-running`
- **AND** ALSO render its children as nested selectable items

### Requirement: Read-time stale-ID filtering applies to rule, about, and banner (post form) keys

The existing read-time stale-ID filtering rule (which removes IDs referencing nonexistent or deleted Units, or Units not visible to the caller) SHALL also apply to the new `rule`, `about`, and `banner.unitId` (when `banner.kind = "post"`) keys. When the referenced Unit cannot be displayed to the caller, the server SHALL return the corresponding key as `null` (or omit it) in the public read response. Admin-side reads SHALL include the original ID along with a stale-marker for cleanup.

#### Scenario: Deleted rule Unit is filtered from public read

- **GIVEN** realm-1 with `extra.rule = "post-rule-1"` and post-rule-1's Unit has `status = DELETED`
- **WHEN** a non-admin reader requests the realm's extra
- **THEN** the response SHALL surface `rule = null` (or omit `rule`)
- **AND** the stored `extra.rule` SHALL still be `"post-rule-1"`

#### Scenario: Admin sees stale rule for cleanup

- **GIVEN** realm-1 with `extra.rule = "post-rule-1"` and post-rule-1 no longer exists
- **WHEN** a moderator requests the admin-side extra view
- **THEN** the response SHALL include the stored `rule = "post-rule-1"` with a stale-marker indicator
- **AND** the moderator SHALL be able to clear it via the admin endpoint

### Requirement: Server endpoints support setting and clearing single-valued extra keys

The realm API SHALL expose endpoints to set or clear the new single-valued keys (`rule`, `about`, `banner`):

- `PUT /realms/:realmId/extra/:key` body `{ value: <key-shape> }` — set the key to the supplied value, replacing any prior value.
- `DELETE /realms/:realmId/extra/:key` — clear (remove) the key from `Realm.extra`.

These endpoints SHALL serialize concurrent writes per realm via the same row-lock mechanism as the existing list-key endpoints. Authorization SHALL require moderator role or higher on the realm, OR `hasAuthorityOver(caller, realmUnit)` to be true. The endpoints SHALL accept the four well-known single-valued keys (`rule`, `about`, `banner`); they MAY also accept arbitrary string keys with the same trust model as the list endpoints.

The list-form endpoints (`pinboard`, `announcement`) defined by the existing `realm-extra-pinboard-keys` capability SHALL remain unchanged.

#### Scenario: Set realm rule

- **GIVEN** realm-1 with no `extra.rule`
- **AND** a caller with moderator role on realm-1
- **WHEN** the caller invokes `PUT /realms/realm-1/extra/rule` body `{ value: "post-r1" }`
- **THEN** `extra.rule` SHALL become `"post-r1"`

#### Scenario: Replace realm about

- **GIVEN** realm-1 with `extra.about = "post-old"`
- **WHEN** a moderator invokes `PUT /realms/realm-1/extra/about` body `{ value: "post-new" }`
- **THEN** `extra.about` SHALL become `"post-new"`

#### Scenario: Clear realm banner

- **GIVEN** realm-1 with `extra.banner = { kind: "url", url: "/old.jpg" }`
- **WHEN** a moderator invokes `DELETE /realms/realm-1/extra/banner`
- **THEN** `extra.banner` SHALL be removed from the JSON

#### Scenario: Non-moderator denied set

- **GIVEN** a caller with regular member role on realm-1
- **WHEN** the caller invokes `PUT /realms/realm-1/extra/rule`
- **THEN** the request SHALL be rejected with `403 Forbidden`

### Requirement: Server endpoints support replacing tagTree

The realm API SHALL expose:

- `PUT /realms/:realmId/extra/tagTree` body `{ value: TagTreeNode[] }` — replace `tagTree` with the supplied array.
- `DELETE /realms/:realmId/extra/tagTree` — clear `tagTree`.

Validation SHALL recursively check each node's shape per the `TagTreeNode` schema. Validation SHALL reject a node whose `tagId` references a Unit that does not exist, has a non-tag UnitType, or has `status = DELETED`. Validation SHALL allow nodes with no `tagId` only when `disabled` is `true` and a `label` is provided.

#### Scenario: Replace tagTree with valid tree

- **WHEN** a moderator invokes `PUT /realms/realm-1/extra/tagTree` body `{ value: [{ disabled: true, label: "Genre", children: [{ tagId: "action" }, { tagId: "drama" }] }] }`
- **AND** "action" and "drama" reference existing tag Units
- **THEN** `extra.tagTree` SHALL be replaced with the supplied array

#### Scenario: Reject tagTree with nonexistent tagId

- **GIVEN** "tag-bogus" does not exist
- **WHEN** a moderator submits `PUT /realms/realm-1/extra/tagTree` body `{ value: [{ tagId: "tag-bogus" }] }`
- **THEN** the request SHALL be rejected with `400 Bad Request`
- **AND** `extra.tagTree` SHALL remain unchanged

#### Scenario: Reject node with no tagId and not disabled

- **WHEN** a moderator submits a tree containing `{ label: "Random" }` (no tagId, not disabled)
- **THEN** the request SHALL be rejected with `400 Bad Request`

### Requirement: Locale entries and JSDoc maintained for new well-known keys

Each new well-known key (`rule`, `about`, `banner`, `tagTree`) SHALL carry a JSDoc comment in the contract source describing its intended use. The English text of each comment SHALL be added (verbatim) as a locale entry under the convention key `realm.extra.<keyName>.note` in every locale file under `package/app/src/locale/`. This continues the convention established for `pinboard` and `announcement`.

#### Scenario: Locale entries exist for all new keys

- **WHEN** any locale file under `package/app/src/locale/` is loaded
- **THEN** values SHALL be exported at `realm.extra.rule.note`, `realm.extra.about.note`, `realm.extra.banner.note`, and `realm.extra.tagTree.note`
- **AND** each value SHALL be a non-empty string

#### Scenario: English JSDoc matches en locale

- **GIVEN** the contract source for `RealmExtraSchema.rule` carries a specific English JSDoc string
- **WHEN** `en.ts` is read at `realm.extra.rule.note`
- **THEN** the value SHALL equal the JSDoc string verbatim
