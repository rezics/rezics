# slug-validation Specification

## Purpose

Defines the shared `validateSlug` function in `@rezics/contract`
that is the single source of truth for slug validation across
auth, server, and other consumers. Owns the canonical format
(lowercase `[a-z0-9-]`, 6-36 characters, no leading / trailing /
consecutive hyphens), the reserved-word list, the auto-lowercase
normalization step, and the `{ ok, normalized }` /
`{ ok: false, reason }` response shape.

## Requirements

### Requirement: Shared slug validation in contract package

The `@rezics/contract` package SHALL export a `validateSlug` function that validates and normalizes slug input. This function SHALL be the single source of truth for slug validation across all packages (auth, server).

#### Scenario: Valid slug passes validation

- **WHEN** input `"science-fiction"` is validated
- **THEN** the result SHALL be `{ ok: true, normalized: "science-fiction" }`

#### Scenario: Uppercase input is auto-lowercased

- **WHEN** input `"Science-Fiction"` is validated
- **THEN** the result SHALL be `{ ok: true, normalized: "science-fiction" }`

#### Scenario: Whitespace is trimmed

- **WHEN** input `"  sci-fi  "` is validated
- **THEN** the result SHALL be `{ ok: true, normalized: "sci-fi" }`

### Requirement: Slug format rules

Slugs SHALL only contain lowercase letters (`a-z`), digits (`0-9`), and hyphens (`-`). The following format rules SHALL apply:

- Minimum length: 6 characters
- Maximum length: 36 characters
- No leading hyphen
- No trailing hyphen
- No consecutive hyphens (`--`)

#### Scenario: Too short

- **WHEN** input `"abc"` is validated
- **THEN** the result SHALL be `{ ok: false, reason: "too_short" }` (or similar message indicating minimum 6 characters)

#### Scenario: Too long (over 36 characters)

- **WHEN** input with 37 characters is validated
- **THEN** the result SHALL indicate the slug exceeds the maximum length

#### Scenario: Leading hyphen rejected

- **WHEN** input `"-sci-fi"` is validated
- **THEN** the result SHALL indicate a leading hyphen error

#### Scenario: Trailing hyphen rejected

- **WHEN** input `"sci-fi-"` is validated
- **THEN** the result SHALL indicate a trailing hyphen error

#### Scenario: Consecutive hyphens rejected

- **WHEN** input `"sci--fi"` is validated
- **THEN** the result SHALL indicate a double hyphen error

#### Scenario: Invalid characters rejected

- **WHEN** input `"sci_fi!"` is validated
- **THEN** the result SHALL indicate invalid characters

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

### Requirement: Typebox slug schema

The `@rezics/contract` package SHALL export a Typebox schema (`slugSchema`) that encodes the format constraints (pattern, minLength, maxLength) for use in Elysia route definitions.

#### Scenario: Route uses slug schema for input validation

- **WHEN** an Elysia endpoint uses `slugSchema` in its body/query definition
- **THEN** requests with invalid slug format SHALL be rejected at the framework level before reaching service code

### Requirement: Configurable validation options

The `validateSlug` function SHALL accept optional configuration for `minLen`, `maxLen`, and `reserved` set, with defaults of 6, 36, and the platform reserved set respectively. This allows individual consumers to tighten or relax constraints if needed.

#### Scenario: Custom min length

- **WHEN** `validateSlug("abc", { minLen: 3 })` is called
- **THEN** the result SHALL be `{ ok: true, normalized: "abc" }` (passes with custom minimum)

#### Scenario: Default options used when none provided

- **WHEN** `validateSlug("science-fiction")` is called without options
- **THEN** validation SHALL use min=6, max=36, and the full platform reserved set

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
