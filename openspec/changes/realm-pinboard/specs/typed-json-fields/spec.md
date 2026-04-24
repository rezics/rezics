## MODIFIED Requirements

### Requirement: Unconsumed Json fields use t.Any

Any `Json`/`Json?` field in the Prisma schema that has no known frontend consumer SHALL use `t.Optional(t.Any())` in the Contract schema. This includes: `UnitTranslation.extra`, `Game.extra`, `Media.extra`, `Link.extra`, `ShelfItem.extra`, `Person.extra`, `Organization.extra`.

`Realm.extra` is NOT in this list. It SHALL be typed in the contract (see the new `Realm.extra typed shape` requirement).

#### Scenario: Unconsumed extra field does not constrain frontend

- **WHEN** a new feature needs to read `Game.extra.someField`
- **THEN** the developer adds a concrete schema to `gameExtraSchema` in contract before consuming it

#### Scenario: Realm.extra is not a t.Any field

- **WHEN** a contributor reviews the list of `t.Optional(t.Any())` extra fields
- **THEN** `Realm.extra` SHALL NOT appear
- **AND** `realmExtraSchema` SHALL be the authoritative shape

## ADDED Requirements

### Requirement: Realm.extra typed shape

The contract SHALL define a `realmExtraSchema` Typebox schema in `package/contract/src/realm.ts` describing the known shape of `Realm.extra`:

- `announcementPostIds`: optional `Array<string>`
- `pinnedPostIds`: optional `Array<string>`
- `filterTagIds`: optional `Array<string>`

The `RealmDTO` schema SHALL use `realmExtraSchema` for its `extra` field instead of `t.Any()` or `t.Record(t.String(), t.Any())`. Unknown keys present in database rows SHALL be ignored by the DTO (the schema SHALL be permissive to extra keys for backward compatibility, but SHALL NOT surface them as typed fields).

#### Scenario: Frontend reads realm.extra.announcementPostIds without cast

- **WHEN** a component reads `realm.extra?.announcementPostIds`
- **THEN** TypeScript SHALL infer the type as `string[] | undefined` without requiring `as any`

#### Scenario: Legacy unknown keys do not cause validation failure

- **GIVEN** a database row with `Realm.extra = { announcementPostIds: ["u1"], legacyKey: 42 }`
- **WHEN** the realm DTO is serialized
- **THEN** `extra.announcementPostIds` SHALL equal `["u1"]`
- **AND** serialization SHALL NOT fail due to the `legacyKey` being unknown to the schema
