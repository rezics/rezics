## ADDED Requirements

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
