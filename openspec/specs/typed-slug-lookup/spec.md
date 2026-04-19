## ADDED Requirements

### Requirement: Typed by-slug endpoint for realm

The server SHALL expose `GET /realm/by-slug/:slug` returning a `RealmDTO`. The endpoint SHALL resolve the slug against `Unit.slug` and return 404 if no unit exists, or if the resolved unit's `type` is not `REALM`.

#### Scenario: Resolving an existing realm slug

- **WHEN** a client requests `GET /realm/by-slug/rezics`
- **AND** a `Unit` with `slug = "rezics"` and `type = REALM` exists
- **THEN** the response SHALL be 200 with the full `RealmDTO` including `unitId`, `slug`, `isPublic`, `isOfficial`, `memberCount`, and any requested translations

#### Scenario: Slug exists but resolves to a non-realm unit

- **WHEN** a client requests `GET /realm/by-slug/book`
- **AND** a `Unit` with `slug = "book"` exists but has `type = TAG`
- **THEN** the response SHALL be 404 not found

#### Scenario: Slug does not exist

- **WHEN** a client requests `GET /realm/by-slug/nonexistent`
- **AND** no `Unit` has `slug = "nonexistent"`
- **THEN** the response SHALL be 404 not found

### Requirement: Typed by-slug endpoint for tag

The server SHALL expose `GET /tag/by-slug/:slug` returning a tag DTO. The endpoint SHALL resolve the slug against `Unit.slug` and return 404 if no unit exists, or if the resolved unit's `type` is not `TAG`.

#### Scenario: Resolving a seed tag by its slug

- **WHEN** a client requests `GET /tag/by-slug/book`
- **AND** the seed tag `Unit` with `slug = "book"` and `type = TAG` exists
- **THEN** the response SHALL be 200 with the tag DTO including `unitId`, `slug`, and translations

#### Scenario: Slug resolves to a non-tag unit

- **WHEN** a client requests `GET /tag/by-slug/rezics`
- **AND** a `Unit` with `slug = "rezics"` exists but has `type = REALM`
- **THEN** the response SHALL be 404 not found

### Requirement: Typed by-slug endpoint for zone

The server SHALL expose `GET /zone/by-slug/:slug` returning a zone DTO. The endpoint SHALL resolve the slug against `Unit.slug` and return 404 if no unit exists, or if the resolved unit's `type` is not `ZONE`.

#### Scenario: Resolving a zone by slug

- **WHEN** a client requests `GET /zone/by-slug/featured-this-week`
- **AND** a `Unit` with `slug = "featured-this-week"` and `type = ZONE` exists
- **THEN** the response SHALL be 200 with the zone DTO including `unitId`, `slug`, `template`, `filters`, and `styling`

#### Scenario: Slug resolves to a non-zone unit

- **WHEN** a client requests `GET /zone/by-slug/book`
- **AND** a `Unit` with `slug = "book"` exists but has `type = TAG`
- **THEN** the response SHALL be 404 not found

### Requirement: Infra bootstrap endpoint

The server SHALL expose `GET /infra/bootstrap` returning the resolved unitIds for infrastructure content whose slugs are declared in `@rezics/contract`.

The response body SHALL be:

```json
{
  "seedTags": { "book": "<uuid>", "game": "<uuid>", "media": "<uuid>", "post": "<uuid>", "link": "<uuid>" },
  "defaultRealmId": "<uuid>"
}
```

The endpoint SHALL return only unitIds — not full DTOs. Consumers needing full objects SHALL fetch them through the typed by-slug endpoints or by-id endpoints separately.

The endpoint SHALL be publicly cacheable (no auth required).

#### Scenario: Fully seeded database

- **WHEN** a client requests `GET /infra/bootstrap`
- **AND** all five seed tags and the default realm exist with their contract-defined slugs
- **THEN** the response SHALL be 200 with all five tag IDs and the default realm ID populated

#### Scenario: Partially seeded database

- **WHEN** a client requests `GET /infra/bootstrap`
- **AND** the default realm exists but seed tags have not yet been created
- **THEN** the response SHALL be 200 with `defaultRealmId` populated and missing tag entries omitted (not present in the `seedTags` object)

#### Scenario: Empty database

- **WHEN** a client requests `GET /infra/bootstrap`
- **AND** no infra content exists
- **THEN** the response SHALL be 200 with `seedTags: {}` and `defaultRealmId` omitted or null

### Requirement: Bootstrap response shape is stable

The `/infra/bootstrap` response SHALL NOT include translations, user references, counters, timestamps, or any metadata beyond unitIds. Adding such fields constitutes a breaking change requiring a new endpoint path or versioning.

#### Scenario: Client expects ID-only shape

- **WHEN** a client parses the `/infra/bootstrap` response
- **THEN** no field other than `seedTags` (a string-to-string map) and `defaultRealmId` (a string) SHALL be present
