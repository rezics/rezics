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

The `@rezics/contract` package SHALL export a `RESERVED_SLUGS` set containing words that SHALL NOT be used as slugs by any user. The list SHALL include at minimum:

- Platform route keywords (tag, tags, realm, realms, book, books, shelf, search, explore, feed, trending, discover, browse)
- Auth/account terms (login, logout, signup, register, account, settings, password, profile)
- Role identifiers (admin, administrator, moderator, staff, support, official, system, root, owner, security)
- Technical terms (api, graphql, assets, static, cdn, webhook, callback, oauth, auth)
- Navigation pages (help, docs, about, terms, privacy, contact, pricing, billing, status, blog, news)
- Common confusable words (me, you, null, undefined, test, example, anonymous, deleted, unknown, nobody, everyone)
- Brand terms (rezics)

#### Scenario: Reserved word is rejected

- **WHEN** input `"admin"` is validated (assuming min length were satisfied, or using a longer reserved word like `"administrator"`)
- **THEN** the result SHALL indicate the slug is reserved

#### Scenario: Non-reserved word passes

- **WHEN** input `"my-book-club"` is validated
- **THEN** the result SHALL pass (assuming format is valid)

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
