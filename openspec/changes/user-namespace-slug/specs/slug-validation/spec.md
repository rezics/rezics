## ADDED Requirements

### Requirement: Unified reserved-word list across all slug scopes

Slug validation SHALL apply a **single unified reserved-word list** across every scope (`user`, `realm`, `tag`, `zone`, `entity`, and any owner-scope identified by an owner Unit id). A word reserved in any scope is reserved in every scope. The list SHALL live in `@rezics/contract` as a single exported constant and SHALL be the only reserved-word source consulted by `validateSlug`.

The unified list SHALL include:

1. Platform navigation and route keywords.
2. Auth, account, and role identifiers.
3. Technical and brand terms.
4. Common confusable words.
5. **Owner-path segments** (`profile`, `settings`, `shelf`, `post`, `list`, and any future owner sub-resource type-prefix). These were previously modeled as a separate per-owner layer; they are now part of the same flat list.
6. **System slug values** that the platform mints on behalf of users (`favorites`, `backlog`, `active`, `completed`, and any future contract-defined system slug). Users SHALL NOT be able to manually claim these slugs in any scope.

`validateSlug` SHALL accept a `scope` argument and apply the same unified list regardless of which scope is passed. The `scope` argument continues to drive **uniqueness lookup** against `(slugScope, slug)`, but it does NOT drive reserved-word selection.

#### Scenario: System slug name rejected in any scope

- **WHEN** `validateSlug("favorites", { scope: 'user' })` is called
- **THEN** the result SHALL fail with `reserved`
- **AND** `validateSlug("favorites", { scope: 'realm' })` SHALL also fail with `reserved`
- **AND** `validateSlug("favorites", { scope: <ownerUserUnitId> })` SHALL also fail with `reserved`

#### Scenario: Owner-path segment rejected in any scope

- **WHEN** `validateSlug("profile", { scope: 'user' })` is called
- **THEN** the result SHALL fail with `reserved`
- **AND** `validateSlug("profile", { scope: 'tag' })` SHALL also fail with `reserved`

#### Scenario: Non-reserved word passes in every scope

- **WHEN** `validateSlug("my-book-club", { scope: 'user' })` is called
- **THEN** the result SHALL pass (assuming format is valid)
- **AND** `validateSlug("my-book-club", { scope: 'tag' })` SHALL also pass

### Requirement: System slug minting bypasses validateSlug

Service code that mints a contract-defined system slug (e.g., the four system shelf slugs `favorites` / `backlog` / `active` / `completed` written during user bootstrap, or any other code path whose slug value is read directly from a `@rezics/contract` constant) SHALL NOT route the write through `validateSlug`. The unified reserved-word list (which includes these very slugs) would otherwise reject the slug it is itself responsible for installing.

System slug writes SHALL read the canonical string from the contract constant and persist it directly. The format and reserved-word checks are unnecessary because the input is not user-supplied.

#### Scenario: Bootstrap mints the `favorites` system shelf slug

- **WHEN** the system shelf bootstrap path mints a shelf with slug `"favorites"` for a new user
- **THEN** the write SHALL NOT call `validateSlug`
- **AND** the slug value SHALL be read from the `@rezics/contract` system-slug constant
- **AND** the write SHALL succeed despite `"favorites"` being on the reserved list

#### Scenario: User-facing slug write still goes through validateSlug

- **WHEN** a user submits a slug value via any user-facing API surface (tag creation, realm creation, admin entity slug assignment, etc.)
- **THEN** the write path SHALL call `validateSlug` first
- **AND** the unified reserved-word list SHALL be enforced

### Requirement: ENTITY slug writes are gated at the service layer

The `validateSlug` function SHALL succeed for well-formed ENTITY slug inputs (so substrate paths can canonicalize the value), but every service entry point that would persist a slug on an ENTITY-typed Unit SHALL reject the write with a typed error such as `ENTITY_SLUG_DISABLED` until the `entity-slug-activation` change flips the gate. The gate SHALL be a single source of truth (e.g., an `ENTITY_SLUG_WRITES_ENABLED` constant or feature flag) so the future change touches one location.

#### Scenario: Format-valid ENTITY slug passes validation but fails write

- **WHEN** a caller submits `validateSlug("haruki-murakami", { scope: 'entity' })` followed by an entity-slug write attempt
- **THEN** validation SHALL return `{ ok: true, normalized: "haruki-murakami" }`
- **AND** the write SHALL be rejected with a typed `ENTITY_SLUG_DISABLED` error

## MODIFIED Requirements

### Requirement: Platform-wide reserved words list

The `@rezics/contract` package SHALL export a **single unified reserved-word list** consulted by `validateSlug` for every scope. The list SHALL be flat (no per-scope or per-owner partitioning) and SHALL contain at minimum:

- Platform route keywords (tag, tags, realm, realms, book, books, shelf, search, explore, feed, trending, discover, browse)
- Auth/account terms (login, logout, signup, register, account, settings, password, profile)
- Role identifiers (admin, administrator, moderator, staff, support, official, system, root, owner, security)
- Technical terms (api, graphql, assets, static, cdn, webhook, callback, oauth, auth)
- Navigation pages (help, docs, about, terms, privacy, contact, pricing, billing, status, blog, news)
- Common confusable words (me, you, null, undefined, test, example, anonymous, deleted, unknown, nobody, everyone)
- Brand terms (rezics)
- Owner-path segments (profile, settings, shelf, post, list) — the type-prefix segments under owner-scope URLs
- System slug values (favorites, backlog, active, completed) — slugs the platform mints automatically and SHALL NOT be user-claimable

New entries (additional owner sub-resource types, additional system slugs) SHALL be added to this unified list. There SHALL NOT be parallel per-scope lists.

#### Scenario: Reserved word rejected in every scope

- **WHEN** `validateSlug("administrator", { scope: 'user' })` is called
- **THEN** the result SHALL fail with `reserved`
- **AND** `validateSlug("administrator", { scope: 'tag' })` SHALL also fail with `reserved`

#### Scenario: Non-reserved word passes

- **WHEN** `validateSlug("my-book-club", { scope: 'user' })` is called
- **THEN** the result SHALL pass (assuming format is valid)

#### Scenario: System slug value rejected as user-claimable

- **WHEN** `validateSlug("backlog", { scope: 'user' })` is called by a user-facing surface
- **THEN** the result SHALL fail with `reserved`
- **AND** the system-shelf bootstrap path (which bypasses `validateSlug` per the dedicated requirement) is unaffected
