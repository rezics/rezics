## ADDED Requirements

### Requirement: Typed by-slug endpoint for user

The server SHALL expose `GET /user/by-slug/:slug` returning a user DTO keyed by `unitId`. The endpoint SHALL resolve the slug against `(slugScope = <user-scope-unit-id>, slug)` on `Unit`, fetch the matching `User` extension row, and return 404 if no such Unit exists, or if the Unit's `type` is not `USER`.

#### Scenario: Resolving an existing user slug

- **WHEN** a client requests `GET /user/by-slug/alice`
- **AND** a `Unit` with `slug = "alice"` and `type = USER` under the user scope exists
- **THEN** the response SHALL be 200 with the user DTO including `unitId`, `slug`, `name`, `avatar`, and other public user fields

#### Scenario: Slug exists but resolves to a non-user unit

- **WHEN** a client requests `GET /user/by-slug/book`
- **AND** a `Unit` with `slug = "book"` exists under the tag scope (type = TAG)
- **THEN** the response SHALL be 404 not found

#### Scenario: Slug does not exist

- **WHEN** a client requests `GET /user/by-slug/nonexistent`
- **AND** no USER-scope `Unit` has `slug = "nonexistent"`
- **THEN** the response SHALL be 404 not found

### Requirement: Typed by-slug endpoint for entity

The server SHALL expose `GET /entity/by-slug/:slug` returning an entity DTO. The endpoint SHALL resolve the slug against `(slugScope = <entity-scope-unit-id>, slug)` on `Unit` and return 404 if no such Unit exists, or if the resolved unit's `type` is not `ENTITY`.

Until the `entity-slug-activation` change ships, no ENTITY slugs SHALL exist; the endpoint SHALL be live but SHALL return 404 for every request in v1.

#### Scenario: Endpoint returns 404 for any slug pre-activation

- **WHEN** a client requests `GET /entity/by-slug/haruki-murakami` before `entity-slug-activation` ships
- **AND** no ENTITY Unit carries a slug
- **THEN** the response SHALL be 404 not found

### Requirement: Owner-scoped shelf by-slug endpoint

The server SHALL expose `GET /shelf/by-slug/:userSlug/:slug` returning a shelf DTO. The endpoint SHALL:

1. Resolve `:userSlug` against the user scope to obtain the owner USER unit's id.
2. Resolve `:slug` against `(slugScope = <ownerUserUnitId>, slug)` on `Unit`.
3. Return 404 if either step fails to resolve, or if the resolved unit's `type` is not `SHELF`.

In v1, only contract-defined system shelf slugs (`favorites`, `backlog`, `active`, `completed`) are mintable. The endpoint SHALL therefore return 404 for any other slug under any user owner in v1, until additional shelf-slug surfaces are opened by follow-on changes.

#### Scenario: Resolving a system shelf under a user

- **WHEN** a client requests `GET /shelf/by-slug/alice/favorites`
- **AND** a SHELF Unit with `slug = "favorites"` and `slugScope = <alice-user-unit-id>` exists
- **THEN** the response SHALL be 200 with the shelf DTO

#### Scenario: User exists but shelf slug does not

- **WHEN** a client requests `GET /shelf/by-slug/alice/my-private-list`
- **AND** the user `alice` exists but no SHELF Unit with `slug = "my-private-list"` and `slugScope = <alice-user-unit-id>` exists
- **THEN** the response SHALL be 404 not found

#### Scenario: User slug does not exist

- **WHEN** a client requests `GET /shelf/by-slug/nonexistent/favorites`
- **AND** no USER unit with `slug = "nonexistent"` exists
- **THEN** the response SHALL be 404 not found

### Requirement: Generic slug resolver endpoint

The server SHALL expose `POST /slug/resolve` accepting `{ scope: 'user' | 'realm' | 'tag' | 'zone' | 'entity' | string, slug: string }` and returning `{ unitId: string, type: UnitType }`. When `scope` is one of the five named values, the resolver SHALL look up the corresponding `SlugScope` row's unit id and query by `(slugScope, slug)`. When `scope` is any other string, it SHALL be interpreted as an owner unit id and used directly as `slugScope`.

The resolver SHALL return 404 when no matching Unit exists. It SHALL be publicly cacheable.

#### Scenario: Named-scope resolution

- **WHEN** a client posts `{ scope: 'tag', slug: 'sci-fi' }`
- **AND** a TAG Unit with that slug exists
- **THEN** the response SHALL be 200 with `{ unitId: <uuid>, type: 'TAG' }`

#### Scenario: Owner-scope resolution

- **WHEN** a client posts `{ scope: '<alice-user-unit-id>', slug: 'favorites' }`
- **AND** a SHELF Unit with that `(slugScope, slug)` exists
- **THEN** the response SHALL be 200 with `{ unitId: <uuid>, type: 'SHELF' }`

#### Scenario: Unknown scope-and-slug pair

- **WHEN** a client posts `{ scope: 'realm', slug: 'does-not-exist' }`
- **THEN** the response SHALL be 404 not found

#### Scenario: Client never passes raw SlugScope UUIDs for named scopes

- **GIVEN** the client documentation
- **WHEN** a client wants to resolve a named-scope slug
- **THEN** the client SHALL pass the named-scope string (`'user' | 'realm' | 'tag' | 'zone' | 'entity'`) and SHALL NOT pass the `SlugScope.unitId` UUID directly

## MODIFIED Requirements

### Requirement: Infra bootstrap endpoint

The server SHALL expose `GET /infra/bootstrap` returning resolved unitIds for infrastructure content whose slugs are declared in `@rezics/contract`, plus the five named slug scope unit ids.

The response body SHALL be:

```json
{
  "seedTags": { "book": "<uuid>", "game": "<uuid>", "media": "<uuid>", "post": "<uuid>", "link": "<uuid>" },
  "defaultRealmId": "<uuid>",
  "slugScopes": {
    "user":   "<uuid>",
    "realm":  "<uuid>",
    "tag":    "<uuid>",
    "zone":   "<uuid>",
    "entity": "<uuid>"
  }
}
```

The endpoint SHALL return only unitIds — not full DTOs. Consumers needing full objects SHALL fetch them through the typed by-slug endpoints or by-id endpoints separately.

The endpoint SHALL be publicly cacheable (no auth required).

#### Scenario: Fully seeded database

- **WHEN** a client requests `GET /infra/bootstrap`
- **AND** all five seed tags, the default realm, and the five slug scope placeholder Units exist
- **THEN** the response SHALL be 200 with all five tag IDs, the default realm ID, and all five slug scope IDs populated

#### Scenario: Partially seeded database

- **WHEN** a client requests `GET /infra/bootstrap`
- **AND** the default realm and slug scopes exist but seed tags have not yet been created
- **THEN** the response SHALL be 200 with `defaultRealmId` populated, `slugScopes` populated, and missing tag entries omitted (not present in the `seedTags` object)

#### Scenario: Empty database

- **WHEN** a client requests `GET /infra/bootstrap`
- **AND** no infra content exists
- **THEN** the response SHALL be 200 with `seedTags: {}`, `defaultRealmId` omitted or null, and `slugScopes: {}` (or omitted)

### Requirement: Bootstrap response shape evolves only by named extension

The `/infra/bootstrap` response SHALL NOT include translations, user references, counters, timestamps, or any metadata beyond unitIds and the named scope map. Adding a new top-level key (such as `slugScopes` introduced by this change) SHALL be considered an additive evolution and SHALL NOT require a new endpoint path; clients SHALL tolerate unknown top-level keys. Removing or restructuring existing keys SHALL still constitute a breaking change requiring a new endpoint path or versioning.

#### Scenario: Client tolerates unknown additive keys

- **WHEN** a client parses the `/infra/bootstrap` response
- **AND** the response contains a key the client does not yet recognize
- **THEN** the client SHALL ignore the unknown key without erroring

#### Scenario: Client expects ID-only shape

- **WHEN** a client parses the `/infra/bootstrap` response
- **THEN** every value present SHALL be a string UUID or a string-to-UUID map
- **AND** no nested object beyond the named maps SHALL be present
