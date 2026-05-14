## ADDED Requirements

### Requirement: Scope-aware reserved-word layers

Slug validation SHALL apply reserved-word checks in two layers:

1. **Per-scope reserved words.** Each `SlugScope` (`user`, `realm`, `tag`, `zone`, `entity`) SHALL have its own reserved set declared in `@rezics/contract`. The five sets MAY overlap but SHALL be independently maintained so a word that is reserved in one scope (e.g., `admin` in user scope) need not be reserved in another (e.g., a tag named `admin` MAY be admissible if product wants it).
2. **Per-owner reserved words.** When validating a slug whose `slugScope` is an owner Unit (not a `SlugScope` placeholder), the reserved set SHALL additionally include the type-prefix path segments used under that owner's URL family (e.g., `profile`, `settings`, `shelf`, `post`, `list`). This prevents an owner sub-resource slug from colliding with the owner's reserved path segments.

`validateSlug` SHALL accept a `scope` argument (named scope or owner unit id) and SHALL pull the appropriate layered reserved set when validating. Callers that omit `scope` SHALL fall back to a conservative "union of all reserved sets" check.

#### Scenario: User-scope reserved word rejected

- **WHEN** `validateSlug("admin", { scope: 'user' })` is called
- **THEN** the result SHALL indicate the slug is reserved under the user scope

#### Scenario: Word reserved in user scope is admissible in tag scope

- **GIVEN** the tag-scope reserved set does not contain `"profile"`
- **WHEN** `validateSlug("profile", { scope: 'tag' })` is called
- **THEN** the result SHALL pass (assuming format is valid)
- **AND** `validateSlug("profile", { scope: 'user' })` SHALL fail with `reserved`

#### Scenario: Owner-scoped slug rejects type-prefix segments

- **WHEN** `validateSlug("settings", { scope: <ownerUserUnitId> })` is called
- **THEN** the result SHALL indicate the slug collides with a reserved owner path segment

### Requirement: ENTITY slug writes are gated at the service layer

The `validateSlug` function SHALL succeed for well-formed ENTITY slug inputs (so substrate paths can canonicalize the value), but every service entry point that would persist a slug on an ENTITY-typed Unit SHALL reject the write with a typed error such as `ENTITY_SLUG_DISABLED` until the `entity-slug-activation` change flips the gate. The gate SHALL be a single source of truth (e.g., a `ENTITY_SLUG_WRITES_ENABLED` constant or feature flag) so the future change touches one location.

#### Scenario: Format-valid ENTITY slug passes validation but fails write

- **WHEN** a caller submits `validateSlug("haruki-murakami", { scope: 'entity' })` followed by an entity-slug write attempt
- **THEN** validation SHALL return `{ ok: true, normalized: "haruki-murakami" }`
- **AND** the write SHALL be rejected with a typed `ENTITY_SLUG_DISABLED` error

## MODIFIED Requirements

### Requirement: Platform-wide reserved words list

The `@rezics/contract` package SHALL export per-scope reserved sets that compose into a platform-wide reserved surface. The user-scope reserved set SHALL inherit the legacy flat list as its starting contents:

- Platform route keywords (tag, tags, realm, realms, book, books, shelf, search, explore, feed, trending, discover, browse)
- Auth/account terms (login, logout, signup, register, account, settings, password, profile)
- Role identifiers (admin, administrator, moderator, staff, support, official, system, root, owner, security)
- Technical terms (api, graphql, assets, static, cdn, webhook, callback, oauth, auth)
- Navigation pages (help, docs, about, terms, privacy, contact, pricing, billing, status, blog, news)
- Common confusable words (me, you, null, undefined, test, example, anonymous, deleted, unknown, nobody, everyone)
- Brand terms (rezics)

The realm-scope set SHALL inherit the same list for v1. The tag, zone, and entity scopes SHALL start with smaller scope-relevant sets to be tuned per scope as needed. Owner-scope reserved sets SHALL be derived from the live URL convention (currently `profile`, `settings`, `shelf`, `post`, `list`) and SHALL be auto-augmented when new owner sub-resource types are introduced.

#### Scenario: Reserved word rejected in user scope

- **WHEN** `validateSlug("administrator", { scope: 'user' })` is called
- **THEN** the result SHALL indicate the slug is reserved

#### Scenario: Non-reserved word passes in user scope

- **WHEN** `validateSlug("my-book-club", { scope: 'user' })` is called
- **THEN** the result SHALL pass (assuming format is valid)

#### Scenario: Scope-relevant reserved word in tag scope

- **GIVEN** the tag-scope reserved set includes `"system"` but not `"login"`
- **WHEN** `validateSlug("login", { scope: 'tag' })` is called
- **THEN** the result SHALL pass (login is not reserved in the tag scope)
- **AND** `validateSlug("system", { scope: 'tag' })` SHALL fail with `reserved`
