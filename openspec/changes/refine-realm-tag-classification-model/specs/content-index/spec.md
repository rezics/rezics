## MODIFIED Requirements

### Requirement: Document contains three independent realm/tag fields

Each document SHALL contain three independent fields derived from three distinct relation families:
- `tagIds`: array of tag Unit UUIDs from `UnitTag`
- `realmIds`: array of realm Unit UUIDs from `RealmUnit`
- `realmTagKeys`: array of compound machine keys from `RealmTagUnit`, formatted as `"{realmUnitId}:{tagUnitId}"`

`realmTagKeys` SHALL be a machine-facing search/filter representation of realm-scoped tag application. It SHALL NOT imply that the target Unit is present in the realm feed, and it SHALL NOT be used as a human-readable display label. Display surfaces that need readable realm/tag text SHALL resolve the realm and tag Units separately.

#### Scenario: Unit with global tags and realm membership

- **GIVEN** a Unit associated with UnitTag rows for tag-A and tag-B, and a RealmUnit row for realm-X
- **WHEN** the unit is synced
- **THEN** the document SHALL have `tagIds` containing tag-A and tag-B UUIDs
- **AND** `realmIds` containing realm-X UUID
- **AND** `realmTagKeys` SHALL be empty (no RealmTagUnit rows exist)

#### Scenario: Unit with realm-scoped tag classification

- **GIVEN** a Unit with a RealmTagUnit row (realm-X, tag-A, this-unit)
- **WHEN** the unit is synced
- **THEN** the document's `realmTagKeys` SHALL contain `"{realm-X-uuid}:{tag-A-uuid}"`

#### Scenario: Realm tag key can exist without realm membership

- **GIVEN** a Unit has `RealmTagUnit(realm-X, tag-A, this-unit)`
- **AND** no `RealmUnit(realm-X, this-unit)` row exists
- **WHEN** the unit is synced
- **THEN** the document's `realmTagKeys` SHALL contain `"{realm-X-uuid}:{tag-A-uuid}"`
- **AND** the document's `realmIds` SHALL NOT contain `realm-X` unless a separate RealmUnit row exists

#### Scenario: Realm tag key is not a display label

- **WHEN** a search response contains `realmTagKeys = ["realm-X:tag-A"]`
- **THEN** the frontend-facing response layer SHALL treat the key as a filter value
- **AND** any user-visible badge or section title SHALL be built from resolved realm and tag display data rather than the raw compound key
